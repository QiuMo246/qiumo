// ============================================
// CORS & 安全中间件
// ============================================

/**
 * 生成 CORS 响应头
 */
export function corsHeaders(env) {
    return {
        'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };
}

/**
 * JSON 响应工具函数
 */
export function jsonResponse(data, status = 200, env = null) {
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
    };
    if (env) Object.assign(headers, corsHeaders(env));
    // GET 请求结果缓存 30s，减少重复请求
    if (status === 200) {
        headers['Cache-Control'] = 'public, max-age=30, s-maxage=60';
    }
    return new Response(JSON.stringify(data), { status, headers });
}

/**
 * IP 限流中间件
 * @param {Request} request
 * @param {object} env - Worker 环境变量
 * @param {string} action - 操作类型 (comment / like / delete)
 * @param {number} maxRequests - 窗口期内最大请求数
 * @param {number} windowSeconds - 时间窗口（秒）
 * @returns {boolean} 是否允许通过
 */
export async function rateLimit(request, env, action, maxRequests, windowSeconds) {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

    // 查询窗口期内的请求数
    const { results } = await env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM rate_limits
         WHERE ip_address = ? AND action = ? AND created_at > ?`
    ).bind(ip, action, windowStart).all();

    const count = results[0]?.cnt || 0;
    if (count >= maxRequests) {
        return false;
    }

    // 记录本次请求
    await env.DB.prepare(
        `INSERT INTO rate_limits (ip_address, action, created_at) VALUES (?, ?, datetime('now'))`
    ).bind(ip, action).run();

    // 概率性清理 24 小时前的旧记录（1/20 概率）
    if (Math.random() < 0.05) {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await env.DB.prepare(
            `DELETE FROM rate_limits WHERE created_at < ?`
        ).bind(cutoff).run();
    }

    return true;
}

/**
 * 管理员认证中间件（预留）
 */
export async function checkAdminAuth(request, env) {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) return false;
    const token = auth.slice(7);
    // 常量时间比较
    if (token.length !== env.ADMIN_SECRET.length) return false;
    let diff = 0;
    for (let i = 0; i < token.length; i++) {
        diff |= token.charCodeAt(i) ^ env.ADMIN_SECRET.charCodeAt(i);
    }
    return diff === 0;
}

/**
 * 防重复提交检查
 * 同一 IP 在 5 秒内提交相同内容则拒绝
 */
export async function checkDuplicate(ip, content, env) {
    const { results } = await env.DB.prepare(
        `SELECT id FROM comments
         WHERE ip_address = ? AND content = ? AND created_at > datetime('now', '-5 seconds')
         LIMIT 1`
    ).bind(ip, content).all();
    return results.length > 0;
}

/**
 * 敏感词过滤接口（预留）
 * @returns {boolean} 是否包含敏感词
 */
export function checkSensitiveWords(content, filterWords = []) {
    if (!filterWords.length) return false;
    const lower = content.toLowerCase();
    return filterWords.some(word => lower.includes(word.toLowerCase()));
}

/**
 * HTML 转义
 */
export function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * 生成随机 Token (32 字节 = 64 位 hex)
 */
export function generateToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
