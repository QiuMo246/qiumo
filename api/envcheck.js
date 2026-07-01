const https = require('https');

function supabaseRequest(path) {
  return new Promise((resolve) => {
    const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const key = process.env.SUPABASE_SERVICE_KEY || '';
    if (!url || !key) return resolve({ status: 'SKIP', message: '环境变量未完整配置' });
    
    const u = new URL(url + '/rest/v1/' + path);
    const opts = {
      hostname: u.hostname, port: 443, path: u.pathname + u.search,
      method: 'GET',
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    };
    
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, message: `HTTP ${res.statusCode}: ${data.slice(0, 100)}` }));
    });
    req.on('error', (e) => resolve({ status: 'ERROR', message: e.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 'TIMEOUT', message: '请求超时' }); });
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const su = process.env.SUPABASE_URL ? '已设置 (' + process.env.SUPABASE_URL.slice(0, 25) + '...)' : '未设置';
  const sk = process.env.SUPABASE_SERVICE_KEY ? '已设置 (长度: ' + process.env.SUPABASE_SERVICE_KEY.length + ')' : '未设置';
  const as = process.env.ADMIN_SECRET ? '已设置' : '未设置';

  const result = await supabaseRequest('comments?select=count');

  res.status(200).json({
    SUPABASE_URL: su,
    SUPABASE_SERVICE_KEY: sk,
    ADMIN_SECRET: as,
    supabase_test: result,
    node_version: process.version,
  });
};
