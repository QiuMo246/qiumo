const SUPABASE_URL = 'https://gtockqpvcnwvkpkhqvdv.supabase.co';

export async function onRequest(context) {
    const req = context.request;

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (!checkAdminAuth(req, context.env)) {
        return jsonResponse({ error: '未授权' }, 401);
    }

    try {
        if (req.method === 'GET') {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/comments?select=*&order=created_at.desc`, {
                headers: supabaseHeaders(context.env),
            });
            const data = await res.json();
            return jsonResponse(data);
        }

        if (req.method === 'DELETE') {
            const url = new URL(req.url);
            const id = url.searchParams.get('id');
            if (!id) return jsonResponse({ error: '缺少 id' }, 400);

            const res = await fetch(`${SUPABASE_URL}/rest/v1/comments?id=eq.${encodeURIComponent(id)}`, {
                method: 'PATCH',
                headers: supabaseHeaders(context.env),
                body: JSON.stringify({ is_deleted: true }),
            });
            if (!res.ok) {
                const err = await res.text();
                return jsonResponse({ error: '删除失败: ' + err }, res.status);
            }
            return jsonResponse({ success: true });
        }

        return jsonResponse({ error: 'Method Not Allowed' }, 405);
    } catch (err) {
        return jsonResponse({ error: '内部错误: ' + err.message }, 500);
    }
}

function checkAdminAuth(req, env) {
    const auth = req.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) return false;
    return auth.slice(7) === env.ADMIN_SECRET;
}

function supabaseHeaders(env) {
    return {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation',
    };
}

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
}
