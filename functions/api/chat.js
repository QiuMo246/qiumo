const SUPABASE_URL = 'https://gtockqpvcnwvkpkhqvdv.supabase.co';
const DAILY_LIMIT = 20;

const MODELS = {
  siliconflow: {
    name: '通义千问 (Qwen3-8B)',
    baseUrl: 'https://api.siliconflow.cn',
    modelId: 'Qwen/Qwen3-8B',
    apiKeyEnv: 'SILICONFLOW_API_KEY',
  },
  relay: {
    name: 'Claude Opus 4.5',
    baseUrl: null,
    modelId: 'claude-opus-4-5',
    apiKeyEnv: 'RELAY_API_KEY',
  },
};

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

    if (req.method === 'GET' && url.searchParams.get('action') === 'check') {
      const { remaining } = await getRemaining(env, clientIP);
      return jsonResponse({ remaining });
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    }

    const { remaining } = await getRemaining(env, clientIP);
    if (remaining <= 0) {
      return jsonResponse({ error: '今日对话次数已用完，明天再来吧。' }, 429);
    }

    const { messages, model: modelKey } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: '请输入消息内容' }, 400);
    }

    const cfg = MODELS[modelKey] || MODELS.siliconflow;
    const baseUrl = cfg.baseUrl || env.RELAY_BASE_URL;
    const apiKey = env[cfg.apiKeyEnv];

    if (!apiKey) {
      return jsonResponse({ error: cfg.name + ' API 未配置' }, 500);
    }
    if (!baseUrl) {
      return jsonResponse({ error: cfg.name + ' 地址未配置' }, 500);
    }

    const body = JSON.stringify({
      model: cfg.modelId,
      messages: [
        { role: 'system', content: '你是一个友好的AI助手，请用中文回答用户的问题。回答简洁准确。' },
        ...messages,
      ],
      stream: true,
      max_tokens: 4096,
      temperature: 0.7,
    });

    const aiRes = await fetch(baseUrl.replace(/\/+$/, '') + '/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body,
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return jsonResponse({ error: cfg.name + ' 错误: ' + aiRes.status }, 502);
    }

    incrementCount(env, clientIP).catch(() => {});

    const { readable, writable } = new TransformStream();
    aiRes.body.pipeTo(writable).catch(() => {});

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
  if (!SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return { remaining: DAILY_LIMIT };
  try {
    const today = new Date().toISOString().split('T')[0];
    const url = `${SUPABASE_URL}/rest/v1/chat_limits?client_ip=eq.${encodeURIComponent(clientIP)}&chat_date=eq.${today}&select=count`;
    const res = await fetch(url, { headers: supabaseHeaders(env) });
    if (!res.ok) return { remaining: DAILY_LIMIT };
    const data = await res.json();
    const count = Array.isArray(data) && data.length > 0 ? data[0].count : 0;
    return { remaining: Math.max(0, DAILY_LIMIT - count) };
  } catch {
    return { remaining: DAILY_LIMIT };
  }
}

async function incrementCount(env, clientIP) {
  if (!SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return;
  try {
    const today = new Date().toISOString().split('T')[0];
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
