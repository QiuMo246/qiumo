const sb = require('./_supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const url = new URL(req.url, 'http://localhost');
    const slug = url.searchParams.get('slug');

    if (slug) {
      const result = await sb.get(`posts?slug=eq.${encodeURIComponent(slug)}&published=eq.true&select=*`);
      if (!result.ok) return res.status(result.status).json({ error: '查询文章失败' });
      if (result.data.length === 0) return res.status(404).json({ error: '文章不存在' });
      return res.status(200).json(result.data[0]);
    } else {
      const result = await sb.get('posts?select=*&published=eq.true&order=created_at.desc');
      if (!result.ok) return res.status(result.status).json({ error: '查询文章列表失败' });
      return res.status(200).json(result.data);
    }
  } catch (err) {
    return res.status(500).json({ error: '内部错误: ' + err.message });
  }
};
