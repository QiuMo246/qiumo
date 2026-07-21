const SUPABASE_URL = 'https://gtockqpvcnwvkpkhqvdv.supabase.co';

export async function onRequest(context) {
    const req = context.request;

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (req.method !== 'GET') {
        return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    try {
        const url = new URL(req.url);
        const slug = url.searchParams.get('slug');

        if (slug) {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/posts?select=*&slug=eq.${encodeURIComponent(slug)}&published=eq.true`,
                { headers: supabaseHeaders(context.env) }
            );
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
                return jsonResponse({ error: '文章不存在' }, 404);
            }
            return jsonResponse(data[0]);
        }

        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/posts?select=*&published=eq.true&order=created_at.desc`,
            { headers: supabaseHeaders(context.env) }
        );
        if (!res.ok) {
            const err = await res.text();
            return jsonResponse({ error: '查询失败: ' + err }, res.status);
        }
        const data = await res.json();
        return jsonResponse(data);
    } catch (err) {
        return jsonResponse({ error: '内部错误: ' + err.message }, 500);
    }
}

function supabaseHeaders(env) {
    return {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    };
}

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
}
