const crypto = require('crypto');
const sb = require('../_supabase');

function verifyToken(token, secret) {
  try {
    var decoded = Buffer.from(token, 'base64url').toString();
    var parts = decoded.split('.');
    if (parts.length !== 2) return false;
    var expiry = parts[0], hmac = parts[1];
    var expected = crypto.createHmac('sha256', secret).update(expiry).digest('hex');
    if (hmac !== expected) return false;
    if (Date.now() > Number(expiry)) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function verifyAdmin(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return false;
  return verifyToken(auth.slice(7), process.env.ADMIN_SECRET);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!verifyAdmin(req)) return res.status(401).json({ error: '未授权' });

  try {
    const url = new URL(req.url, 'http://localhost');
    const id = url.searchParams.get('id');

    if (req.method === 'GET') {
      const result = await sb.get('posts?select=*&order=created_at.desc');
      if (!result.ok) return res.status(result.status).json({ error: '查询文章失败' });
      return res.status(200).json(result.data);
    } else if (req.method === 'POST') {
      let body = '';
      await new Promise((resolve, reject) => {
        req.on('data', chunk => body += chunk);
        req.on('end', resolve);
        req.on('error', reject);
      });
      const data = JSON.parse(body);
      if (!data.title || !data.slug || !data.content) {
        return res.status(400).json({ error: '标题、路径和内容不能为空' });
      }
      const result = await sb.post('posts', data);
      if (!result.ok) return res.status(result.status).json({ error: result.data?.message || '创建文章失败' });
      return res.status(201).json(Array.isArray(result.data) ? result.data[0] : result.data);
    } else if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: '缺少文章ID' });
      let body = '';
      await new Promise((resolve, reject) => {
        req.on('data', chunk => body += chunk);
        req.on('end', resolve);
        req.on('error', reject);
      });
      const data = JSON.parse(body);
      data.updated_at = new Date().toISOString();
      const result = await sb.patch(`posts?id=eq.${encodeURIComponent(id)}`, data);
      if (!result.ok) return res.status(result.status).json({ error: '更新文章失败' });
      return res.status(200).json(Array.isArray(result.data) ? result.data[0] : result.data);
    } else if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: '缺少文章ID' });
      const result = await sb.del(`posts?id=eq.${encodeURIComponent(id)}`);
      if (!result.ok) return res.status(result.status).json({ error: '删除文章失败' });
      return res.status(200).json({ success: true });
    } else {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (err) {
    return res.status(500).json({ error: '内部错误: ' + err.message });
  }
};
