// Supabase REST helper using Node.js built-in https module
// Zero external dependencies

const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Prefer': 'return=representation'
  };
}

function request(fullPath, method, body = null) {
  if (!SUPABASE_URL) {
    return Promise.reject(new Error('SUPABASE_URL 环境变量未配置'));
  }
  const base = SUPABASE_URL.replace(/\/+$/, '');
  const u = new URL(base + fullPath);

  return new Promise((resolve, reject) => {
    const opts = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method,
      headers: getHeaders(),
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try {
          json = data ? JSON.parse(data) : null;
        } catch {
          json = { raw: data };
        }
        resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: json });
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  get:    (path) => request(`/rest/v1/${path}`, 'GET'),
  post:   (path, body) => request(`/rest/v1/${path}`, 'POST', body),
  patch:  (path, body) => request(`/rest/v1/${path}`, 'PATCH', body),
  del:    (path) => request(`/rest/v1/${path}`, 'DELETE'),
};
