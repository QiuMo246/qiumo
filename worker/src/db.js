// ============================================
// D1 数据库查询逻辑
// ============================================

import { jsonResponse, escapeHtml, generateToken, checkDuplicate, checkSensitiveWords } from './middleware.js';

// 敏感词列表（预留，按需添加）
const FILTER_WORDS = [];

export const db = {

    /**
     * GET /api/comments
     * 获取评论列表（游标分页）
     */
    async get(request, env) {
        const url = new URL(request.url);
        const sort = url.searchParams.get('sort') || 'latest';
        const cursor = url.searchParams.get('cursor') || '';
        const limit = Math.min(parseInt(url.searchParams.get('limit')) || 10, 20);
        const parentId = url.searchParams.get('parent_id');

        // 如果请求某个评论的回复
        if (parentId) {
            return this.getReplies(parseInt(parentId), env);
        }

        // 获取顶层评论
        let sql, params;
        if (sort === 'popular') {
            sql = `SELECT * FROM comments
                   WHERE parent_id IS NULL AND is_deleted = 0
                   ${cursor ? 'AND created_at <= ?' : ''}
                   ORDER BY likes DESC, id DESC
                   LIMIT ?`;
            params = cursor ? [cursor, limit + 1] : [limit + 1];
        } else {
            sql = `SELECT * FROM comments
                   WHERE parent_id IS NULL AND is_deleted = 0
                   ${cursor ? 'AND created_at < ?' : ''}
                   ORDER BY created_at DESC
                   LIMIT ?`;
            params = cursor ? [cursor, limit + 1] : [limit + 1];
        }

        const { results } = await env.DB.prepare(sql).bind(...params).all();

        const hasMore = results.length > limit;
        const comments = results.slice(0, limit);

        // 批量获取每条评论的回复（最多显示前 3 条，显示总数）
        const commentIds = comments.map(c => c.id);
        let repliesMap = {};
        let replyCountMap = {};

        if (commentIds.length > 0) {
            const placeholders = commentIds.map(() => '?').join(',');
            const { results: allReplies } = await env.DB.prepare(
                `SELECT * FROM comments
                 WHERE parent_id IN (${placeholders}) AND is_deleted = 0
                 ORDER BY created_at ASC`
            ).bind(...commentIds).all();

            // 统计回复总数
            for (const reply of allReplies) {
                replyCountMap[reply.parent_id] = (replyCountMap[reply.parent_id] || 0) + 1;
            }

            // 每个父评论只取前 3 条回复
            for (const reply of allReplies) {
                if (!repliesMap[reply.parent_id]) {
                    repliesMap[reply.parent_id] = [];
                }
                if (repliesMap[reply.parent_id].length < 3) {
                    repliesMap[reply.parent_id].push(this.formatComment(reply));
                }
            }
        }

        // 获取总数
        const { results: countResult } = await env.DB.prepare(
            `SELECT COUNT(*) as total FROM comments
             WHERE parent_id IS NULL AND is_deleted = 0`
        ).all();
        const total = countResult[0]?.total || 0;

        const formatted = comments.map(c => ({
            ...this.formatComment(c),
            replies: repliesMap[c.id] || [],
            reply_count: replyCountMap[c.id] || 0,
        }));

        return jsonResponse({
            comments: formatted,
            next_cursor: hasMore ? comments[comments.length - 1].created_at : null,
            has_more: hasMore,
            total,
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
            replies: results.map(r => this.formatComment(r)),
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
            return jsonResponse({ error: '请求格式错误' }, 400, env);
        }

        const nickname = (body.nickname || '').trim();
        const content = (body.content || '').trim();
        const parentId = body.parent_id || null;

        // 验证
        if (!nickname || nickname.length > 20) {
            return jsonResponse({ error: '昵称不能为空且不超过 20 个字符' }, 400, env);
        }
        if (!content || content.length > 1000) {
            return jsonResponse({ error: '评论内容不能为空且不超过 1000 个字符' }, 400, env);
        }

        // 敏感词过滤（预留）
        if (checkSensitiveWords(content, FILTER_WORDS)) {
            return jsonResponse({ error: '评论内容包含敏感词，请修改后重试' }, 400, env);
        }

        const ip = request.headers.get('cf-connecting-ip') || 'unknown';

        // 防重复提交
        if (await checkDuplicate(ip, content, env)) {
            return jsonResponse({ error: '请勿重复提交' }, 429, env);
        }

        // 验证父评论是否存在（如果是回复）
        if (parentId) {
            const { results: parent } = await env.DB.prepare(
                `SELECT id, parent_id FROM comments WHERE id = ? AND is_deleted = 0`
            ).bind(parentId).all();

            if (parent.length === 0) {
                return jsonResponse({ error: '父评论不存在' }, 400, env);
            }
            // 只允许一级嵌套
            if (parent[0].parent_id !== null) {
                return jsonResponse({ error: '只支持一级回复' }, 400, env);
            }
        }

        // 生成 Token
        const token = generateToken();

        // 插入评论
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
            created_at: new Date().toISOString(),
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
            return jsonResponse({ error: '请求格式错误' }, 400, env);
        }

        const { token } = body;
        if (!token) {
            return jsonResponse({ error: '缺少删除凭证' }, 400, env);
        }

        // 查询评论的 token
        const { results } = await env.DB.prepare(
            `SELECT token, parent_id FROM comments WHERE id = ?`
        ).bind(id).all();

        if (results.length === 0) {
            return jsonResponse({ error: '评论不存在' }, 404, env);
        }

        // 常量时间比较 token
        const storedToken = results[0].token;
        if (token.length !== storedToken.length) {
            return jsonResponse({ error: '凭证无效' }, 403, env);
        }
        let diff = 0;
        for (let i = 0; i < token.length; i++) {
            diff |= token.charCodeAt(i) ^ storedToken.charCodeAt(i);
        }
        if (diff !== 0) {
            return jsonResponse({ error: '凭证无效' }, 403, env);
        }

        // 软删除
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
            return jsonResponse({ error: '请求格式错误' }, 400, env);
        }

        const { client_id } = body;
        if (!client_id) {
            return jsonResponse({ error: '缺少客户端标识' }, 400, env);
        }

        // 检查评论是否存在
        const { results: comment } = await env.DB.prepare(
            `SELECT id, is_deleted FROM comments WHERE id = ?`
        ).bind(id).all();

        if (comment.length === 0 || comment[0].is_deleted) {
            return jsonResponse({ error: '评论不存在' }, 404, env);
        }

        // 检查是否已点赞
        const { results: existingLike } = await env.DB.prepare(
            `SELECT id FROM likes WHERE comment_id = ? AND client_id = ?`
        ).bind(id, client_id).all();

        let liked;
        if (existingLike.length > 0) {
            // 取消点赞
            await env.DB.prepare(
                `DELETE FROM likes WHERE comment_id = ? AND client_id = ?`
            ).bind(id, client_id).run();
            await env.DB.prepare(
                `UPDATE comments SET likes = MAX(0, likes - 1) WHERE id = ?`
            ).bind(id).run();
            liked = false;
        } else {
            // 添加点赞
            await env.DB.prepare(
                `INSERT INTO likes (comment_id, client_id) VALUES (?, ?)`
            ).bind(id, client_id).run();
            await env.DB.prepare(
                `UPDATE comments SET likes = likes + 1 WHERE id = ?`
            ).bind(id).run();
            liked = true;
        }

        // 获取最新点赞数
        const { results: updated } = await env.DB.prepare(
            `SELECT likes FROM comments WHERE id = ?`
        ).bind(id).all();

        return jsonResponse({
            liked,
            likes: updated[0]?.likes || 0,
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
            created_at: row.created_at,
        };
    },
};
