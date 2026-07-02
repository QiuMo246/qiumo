export async function onRequest(context) {
    const req = context.request;

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (req.method !== 'POST') {
        return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    try {
        const { password } = await req.json();
        if (!password) return jsonResponse({ error: '请输入密码' }, 400);
        if (password === context.env.ADMIN_SECRET) {
            return jsonResponse({ success: true, token: context.env.ADMIN_SECRET });
        }
        return jsonResponse({ error: '密码错误' }, 401);
    } catch (err) {
        return jsonResponse({ error: '内部错误: ' + err.message }, 500);
    }
}

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
}
