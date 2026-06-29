// ============================================
// Cloudflare Worker 入口 - 路由
// ============================================

import { db } from './db.js';
import { corsHeaders, jsonResponse, rateLimit, checkAdminAuth } from './middleware.js';

export default {
    async fetch(request, env) {
        // CORS 预检
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(env) });
        }

        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        try {
            // ---- 评论接口 ----

            // GET /api/comments - 获取评论列表
            if (path === '/api/comments' && method === 'GET') {
                return await db.get(request, env);
            }

            // POST /api/comments - 发表评论
            if (path === '/api/comments' && method === 'POST') {
                if (!await rateLimit(request, env, 'comment', 3, 60)) {
                    return jsonResponse({ error: '评论过于频繁，请稍后再试' }, 429, env);
                }
                return await db.create(request, env);
            }

            // DELETE /api/comments/:id - 删除评论
            const deleteMatch = path.match(/^\/api\/comments\/(\d+)$/);
            if (deleteMatch && method === 'DELETE') {
                if (!await rateLimit(request, env, 'delete', 5, 60)) {
                    return jsonResponse({ error: '操作过于频繁，请稍后再试' }, 429, env);
                }
                return await db.remove(parseInt(deleteMatch[1]), request, env);
            }

            // POST /api/comments/:id/like - 点赞/取消
            const likeMatch = path.match(/^\/api\/comments\/(\d+)\/like$/);
            if (likeMatch && method === 'POST') {
                if (!await rateLimit(request, env, 'like', 10, 60)) {
                    return jsonResponse({ error: '操作过于频繁' }, 429, env);
                }
                return await db.toggleLike(parseInt(likeMatch[1]), request, env);
            }

            // ---- 图片上传（预留） ----
            if (path === '/api/upload' && method === 'POST') {
                return jsonResponse({ error: '图片上传功能即将上线' }, 501, env);
            }

            // ---- 管理接口（预留） ----
            if (path.startsWith('/api/admin/')) {
                if (!await checkAdminAuth(request, env)) {
                    return jsonResponse({ error: '未授权' }, 401, env);
                }
                return jsonResponse({ message: '管理接口预留' }, 200, env);
            }

            // 404
            return jsonResponse({ error: 'Not Found' }, 404, env);

        } catch (err) {
            console.error('Worker error:', err);
            return jsonResponse({ error: '服务器内部错误' }, 500, env);
        }
    },
};
