var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/middleware.js
function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function jsonResponse(data, status = 200, env = null) {
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  if (env)
    Object.assign(headers, corsHeaders(env));
  return new Response(JSON.stringify(data), { status, headers });
}
__name(jsonResponse, "jsonResponse");
async function rateLimit(request, env, action, maxRequests, windowSeconds) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const windowStart = new Date(Date.now() - windowSeconds * 1e3).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM rate_limits
         WHERE ip_address = ? AND action = ? AND created_at > ?`
  ).bind(ip, action, windowStart).all();
  const count = results[0]?.cnt || 0;
  if (count >= maxRequests) {
    return false;
  }
  await env.DB.prepare(
    `INSERT INTO rate_limits (ip_address, action, created_at) VALUES (?, ?, datetime('now'))`
  ).bind(ip, action).run();
  if (Math.random() < 0.05) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
    await env.DB.prepare(
      `DELETE FROM rate_limits WHERE created_at < ?`
    ).bind(cutoff).run();
  }
  return true;
}
__name(rateLimit, "rateLimit");
async function checkAdminAuth(request, env) {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer "))
    return false;
  const token = auth.slice(7);
  if (token.length !== env.ADMIN_SECRET.length)
    return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ env.ADMIN_SECRET.charCodeAt(i);
  }
  return diff === 0;
}
__name(checkAdminAuth, "checkAdminAuth");
async function checkDuplicate(ip, content, env) {
  const { results } = await env.DB.prepare(
    `SELECT id FROM comments
         WHERE ip_address = ? AND content = ? AND created_at > datetime('now', '-5 seconds')
         LIMIT 1`
  ).bind(ip, content).all();
  return results.length > 0;
}
__name(checkDuplicate, "checkDuplicate");
function checkSensitiveWords(content, filterWords = []) {
  if (!filterWords.length)
    return false;
  const lower = content.toLowerCase();
  return filterWords.some((word) => lower.includes(word.toLowerCase()));
}
__name(checkSensitiveWords, "checkSensitiveWords");
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}
__name(escapeHtml, "escapeHtml");
function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateToken, "generateToken");

// src/db.js
var FILTER_WORDS = [];
var db = {
  /**
   * GET /api/comments
   * 获取评论列表（游标分页）
   */
  async get(request, env) {
    const url = new URL(request.url);
    const sort = url.searchParams.get("sort") || "latest";
    const cursor = url.searchParams.get("cursor") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit")) || 10, 20);
    const parentId = url.searchParams.get("parent_id");
    if (parentId) {
      return this.getReplies(parseInt(parentId), env);
    }
    let sql, params;
    if (sort === "popular") {
      sql = `SELECT * FROM comments
                   WHERE parent_id IS NULL AND is_deleted = 0
                   ${cursor ? "AND created_at <= ?" : ""}
                   ORDER BY likes DESC, id DESC
                   LIMIT ?`;
      params = cursor ? [cursor, limit + 1] : [limit + 1];
    } else {
      sql = `SELECT * FROM comments
                   WHERE parent_id IS NULL AND is_deleted = 0
                   ${cursor ? "AND created_at < ?" : ""}
                   ORDER BY created_at DESC
                   LIMIT ?`;
      params = cursor ? [cursor, limit + 1] : [limit + 1];
    }
    const { results } = await env.DB.prepare(sql).bind(...params).all();
    const hasMore = results.length > limit;
    const comments = results.slice(0, limit);
    const commentIds = comments.map((c) => c.id);
    let repliesMap = {};
    let replyCountMap = {};
    if (commentIds.length > 0) {
      const placeholders = commentIds.map(() => "?").join(",");
      const { results: allReplies } = await env.DB.prepare(
        `SELECT * FROM comments
                 WHERE parent_id IN (${placeholders}) AND is_deleted = 0
                 ORDER BY created_at ASC`
      ).bind(...commentIds).all();
      for (const reply of allReplies) {
        replyCountMap[reply.parent_id] = (replyCountMap[reply.parent_id] || 0) + 1;
      }
      for (const reply of allReplies) {
        if (!repliesMap[reply.parent_id]) {
          repliesMap[reply.parent_id] = [];
        }
        if (repliesMap[reply.parent_id].length < 3) {
          repliesMap[reply.parent_id].push(this.formatComment(reply));
        }
      }
    }
    const { results: countResult } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM comments
             WHERE parent_id IS NULL AND is_deleted = 0`
    ).all();
    const total = countResult[0]?.total || 0;
    const formatted = comments.map((c) => ({
      ...this.formatComment(c),
      replies: repliesMap[c.id] || [],
      reply_count: replyCountMap[c.id] || 0
    }));
    return jsonResponse({
      comments: formatted,
      next_cursor: hasMore ? comments[comments.length - 1].created_at : null,
      has_more: hasMore,
      total
    }, 200, env);
  },
  /**
   * 获取某条评论的全部回复
   */
  async getReplies(parentId, env) {
    const { results } = await env.DB.prepare(
      `SELECT * FROM comments
             WHERE parent_id = ? AND is_deleted = 0
             ORDER BY created_at ASC`
    ).bind(parentId).all();
    return jsonResponse({
      replies: results.map((r) => this.formatComment(r))
    }, 200, env);
  },
  /**
   * POST /api/comments
   * 创建评论或回复
   */
  async create(request, env) {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF" }, 400, env);
    }
    const nickname = (body.nickname || "").trim();
    const content = (body.content || "").trim();
    const parentId = body.parent_id || null;
    if (!nickname || nickname.length > 20) {
      return jsonResponse({ error: "\u6635\u79F0\u4E0D\u80FD\u4E3A\u7A7A\u4E14\u4E0D\u8D85\u8FC7 20 \u4E2A\u5B57\u7B26" }, 400, env);
    }
    if (!content || content.length > 1e3) {
      return jsonResponse({ error: "\u8BC4\u8BBA\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A\u4E14\u4E0D\u8D85\u8FC7 1000 \u4E2A\u5B57\u7B26" }, 400, env);
    }
    if (checkSensitiveWords(content, FILTER_WORDS)) {
      return jsonResponse({ error: "\u8BC4\u8BBA\u5185\u5BB9\u5305\u542B\u654F\u611F\u8BCD\uFF0C\u8BF7\u4FEE\u6539\u540E\u91CD\u8BD5" }, 400, env);
    }
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (await checkDuplicate(ip, content, env)) {
      return jsonResponse({ error: "\u8BF7\u52FF\u91CD\u590D\u63D0\u4EA4" }, 429, env);
    }
    if (parentId) {
      const { results: parent } = await env.DB.prepare(
        `SELECT id, parent_id FROM comments WHERE id = ? AND is_deleted = 0`
      ).bind(parentId).all();
      if (parent.length === 0) {
        return jsonResponse({ error: "\u7236\u8BC4\u8BBA\u4E0D\u5B58\u5728" }, 400, env);
      }
      if (parent[0].parent_id !== null) {
        return jsonResponse({ error: "\u53EA\u652F\u6301\u4E00\u7EA7\u56DE\u590D" }, 400, env);
      }
    }
    const token = generateToken();
    const escapedNickname = escapeHtml(nickname);
    const escapedContent = escapeHtml(content);
    const { meta } = await env.DB.prepare(
      `INSERT INTO comments (parent_id, nickname, content, token, ip_address, created_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).bind(parentId, escapedNickname, escapedContent, token, ip).run();
    return jsonResponse({
      id: meta.last_row_id,
      token,
      nickname: escapedNickname,
      content: escapedContent,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    }, 201, env);
  },
  /**
   * DELETE /api/comments/:id
   * 软删除评论（需要 Token 验证）
   */
  async remove(id, request, env) {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF" }, 400, env);
    }
    const { token } = body;
    if (!token) {
      return jsonResponse({ error: "\u7F3A\u5C11\u5220\u9664\u51ED\u8BC1" }, 400, env);
    }
    const { results } = await env.DB.prepare(
      `SELECT token, parent_id FROM comments WHERE id = ?`
    ).bind(id).all();
    if (results.length === 0) {
      return jsonResponse({ error: "\u8BC4\u8BBA\u4E0D\u5B58\u5728" }, 404, env);
    }
    const storedToken = results[0].token;
    if (token.length !== storedToken.length) {
      return jsonResponse({ error: "\u51ED\u8BC1\u65E0\u6548" }, 403, env);
    }
    let diff = 0;
    for (let i = 0; i < token.length; i++) {
      diff |= token.charCodeAt(i) ^ storedToken.charCodeAt(i);
    }
    if (diff !== 0) {
      return jsonResponse({ error: "\u51ED\u8BC1\u65E0\u6548" }, 403, env);
    }
    await env.DB.prepare(
      `UPDATE comments SET is_deleted = 1 WHERE id = ?`
    ).bind(id).run();
    return jsonResponse({ success: true }, 200, env);
  },
  /**
   * POST /api/comments/:id/like
   * 点赞 / 取消点赞
   */
  async toggleLike(id, request, env) {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF" }, 400, env);
    }
    const { client_id } = body;
    if (!client_id) {
      return jsonResponse({ error: "\u7F3A\u5C11\u5BA2\u6237\u7AEF\u6807\u8BC6" }, 400, env);
    }
    const { results: comment } = await env.DB.prepare(
      `SELECT id, is_deleted FROM comments WHERE id = ?`
    ).bind(id).all();
    if (comment.length === 0 || comment[0].is_deleted) {
      return jsonResponse({ error: "\u8BC4\u8BBA\u4E0D\u5B58\u5728" }, 404, env);
    }
    const { results: existingLike } = await env.DB.prepare(
      `SELECT id FROM likes WHERE comment_id = ? AND client_id = ?`
    ).bind(id, client_id).all();
    let liked;
    if (existingLike.length > 0) {
      await env.DB.prepare(
        `DELETE FROM likes WHERE comment_id = ? AND client_id = ?`
      ).bind(id, client_id).run();
      await env.DB.prepare(
        `UPDATE comments SET likes = MAX(0, likes - 1) WHERE id = ?`
      ).bind(id).run();
      liked = false;
    } else {
      await env.DB.prepare(
        `INSERT INTO likes (comment_id, client_id) VALUES (?, ?)`
      ).bind(id, client_id).run();
      await env.DB.prepare(
        `UPDATE comments SET likes = likes + 1 WHERE id = ?`
      ).bind(id).run();
      liked = true;
    }
    const { results: updated } = await env.DB.prepare(
      `SELECT likes FROM comments WHERE id = ?`
    ).bind(id).all();
    return jsonResponse({
      liked,
      likes: updated[0]?.likes || 0
    }, 200, env);
  },
  /**
   * 格式化评论数据
   */
  formatComment(row) {
    return {
      id: row.id,
      parent_id: row.parent_id,
      nickname: row.nickname,
      content: row.content,
      likes: row.likes,
      created_at: row.created_at
    };
  }
};

// src/index.js
var src_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    try {
      if (path === "/api/comments" && method === "GET") {
        return await db.get(request, env);
      }
      if (path === "/api/comments" && method === "POST") {
        if (!await rateLimit(request, env, "comment", 3, 60)) {
          return jsonResponse({ error: "\u8BC4\u8BBA\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" }, 429, env);
        }
        return await db.create(request, env);
      }
      const deleteMatch = path.match(/^\/api\/comments\/(\d+)$/);
      if (deleteMatch && method === "DELETE") {
        if (!await rateLimit(request, env, "delete", 5, 60)) {
          return jsonResponse({ error: "\u64CD\u4F5C\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" }, 429, env);
        }
        return await db.remove(parseInt(deleteMatch[1]), request, env);
      }
      const likeMatch = path.match(/^\/api\/comments\/(\d+)\/like$/);
      if (likeMatch && method === "POST") {
        if (!await rateLimit(request, env, "like", 10, 60)) {
          return jsonResponse({ error: "\u64CD\u4F5C\u8FC7\u4E8E\u9891\u7E41" }, 429, env);
        }
        return await db.toggleLike(parseInt(likeMatch[1]), request, env);
      }
      if (path === "/api/upload" && method === "POST") {
        return jsonResponse({ error: "\u56FE\u7247\u4E0A\u4F20\u529F\u80FD\u5373\u5C06\u4E0A\u7EBF" }, 501, env);
      }
      if (path.startsWith("/api/admin/")) {
        if (!await checkAdminAuth(request, env)) {
          return jsonResponse({ error: "\u672A\u6388\u6743" }, 401, env);
        }
        return jsonResponse({ message: "\u7BA1\u7406\u63A5\u53E3\u9884\u7559" }, 200, env);
      }
      return jsonResponse({ error: "Not Found" }, 404, env);
    } catch (err) {
      console.error("Worker error:", err);
      return jsonResponse({ error: "\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF" }, 500, env);
    }
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
