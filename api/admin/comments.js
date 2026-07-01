const sb = require('../_supabase');

function verifyAdmin(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return false;
  return auth.slice(7) === process.env.ADMIN_SECRET;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!verifyAdmin(req)) return res.status(401).json({ error: '未授权' });

  try {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET') {
      const result = await sb.get('comments?select=*&order=created_at.desc');
      if (!result.ok) return res.status(result.status).json({ error: '查询评论失败' });
      return res.status(200).json(result.data);
    } else if (req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return res.status(400).json({ error: '缺少评论ID' });

      const result = await sb.patch(`comments?id=eq.${encodeURIComponent(id)}`, { is_deleted: true });
      if (!result.ok) return res.status(result.status).json({ error: '删除评论失败' });
      return res.status(200).json({ success: true });
    } else {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (err) {
    return res.status(500).json({ error: '内部错误: ' + err.message });
  }
};
