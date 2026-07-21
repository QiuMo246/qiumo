async function createToken(secret) {
    var expiry = Date.now() + 24 * 60 * 60 * 1000;
    var payload = String(expiry);
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    var sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    var hmac = Array.from(new Uint8Array(sig)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    return btoa(payload + '.' + hmac);
}

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
            var token = await createToken(context.env.ADMIN_SECRET);
            return jsonResponse({ success: true, token: token });
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
