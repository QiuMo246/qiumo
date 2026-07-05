const SILICONFLOW_BASE = 'https://api.siliconflow.cn/v1';
const SUPABASE_URL = 'https://gtockqpvcnwvkpkhqvdv.supabase.co';
const DAILY_LIMIT = 20;

export async function onRequest(context) {
  const req = context.request;
  const env = context.env;

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    const clientIP = req.headers.get('cf-connecting-ip')
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || 'unknown';

    const url = new URL(req.url);

    // GET ?action=check — return remaining count
    if (req.method === 'GET' && url.searchParams.get('action') === 'check') {
      const { remaining, debug } = await getRemaining(env, clientIP);
      return jsonResponse(url.searchParams.has('debug') ? { remaining, debug, clientIP } : { remaining });
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    // Check daily limit
    const { remaining } = await getRemaining(env, clientIP);
    if (remaining <= 0) {
      return jsonResponse({ error: '今日对话次数已用完，明天再来吧。' }, 429);
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: '请输入消息内容' }, 400);
    }

    const apiKey = env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'API 未配置' }, 500);
    }

    // Build SiliconFlow request
    const body = JSON.stringify({
      model: 'Qwen/Qwen3-8B',
      messages: [
        { role: 'system', content: '你是一个友好的AI助手，请用中文回答用户的问题。回答简洁准确。' },
        ...messages,
      ],
      stream: true,
      max_tokens: 2048,
      temperature: 0.7,
    });

    const sfRes = await fetch(SILICONFLOW_BASE + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body,
    });

    if (!sfRes.ok) {
      const errText = await sfRes.text();
      return jsonResponse({ error: '上游 API 错误: ' + sfRes.status }, 502);
    }

    // Increment counter (fire-and-forget)
    incrementCount(env, clientIP).catch(() => {});

    // Stream response back to client (passthrough)
    const { readable, writable } = new TransformStream();
    sfRes.body.pipeTo(writable).catch(() => {});

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders(),
      },
    });

  } catch (err) {
    return jsonResponse({ error: '内部错误: ' + err.message }, 500);
  }
}

async function getRemaining(env, clientIP) {
  if (!SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return { remaining: DAILY_LIMIT, debug: 'miss: SUPABASE_URL or SUPABASE_SERVICE_KEY not set' };
  }
  try {
    const today = new Date().toISOString().split('T')[0];
    const url = `${SUPABASE_URL}/rest/v1/chat_limits?client_ip=eq.${encodeURIComponent(clientIP)}&chat_date=eq.${today}&select=count`;
    const res = await fetch(url, {
      headers: supabaseHeaders(env),
    });
    if (!res.ok) {
      return { remaining: DAILY_LIMIT, debug: `Supabase status ${res.status}: ${await res.text()}` };
    }
    const data = await res.json();
    const count = Array.isArray(data) && data.length > 0 ? data[0].count : 0;
    return { remaining: Math.max(0, DAILY_LIMIT - count), debug: 'ok: count=' + count };
  } catch (e) {
    return { remaining: DAILY_LIMIT, debug: 'exception: ' + e.message };
  }
}

async function incrementCount(env, clientIP) {
  if (!SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return;
  try {
    const today = new Date().toISOString().split('T')[0];

    // Try upsert: insert or increment
    const url = `${SUPABASE_URL}/rest/v1/chat_limits`;
    const existingRes = await fetch(
      `${url}?client_ip=eq.${encodeURIComponent(clientIP)}&chat_date=eq.${today}&select=id,count`,
      { headers: supabaseHeaders(env) }
    );
    const existing = await existingRes.json();

    if (Array.isArray(existing) && existing.length > 0) {
      await fetch(`${url}?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        headers: { ...supabaseHeaders(env), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ count: existing[0].count + 1 }),
      });
    } else {
      await fetch(url, {
        method: 'POST',
        headers: { ...supabaseHeaders(env), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ client_ip: clientIP, chat_date: today, count: 1 }),
      });
    }
  } catch {}
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}
