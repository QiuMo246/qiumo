const { getSbHeaders, verifyAdmin, fetch } = require('../utils');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: '未授权' });
  }

  try {
    const { id } = req.query;

    if (req.method === 'GET') {
      // List all posts (including drafts) for admin dashboard
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/posts?order=created_at.desc`, {
        method: 'GET',
        headers: getSbHeaders()
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch posts' });
      }

      const posts = await response.json();
      return res.status(200).json(posts);
    } else if (req.method === 'POST') {
      const { title, slug, content, excerpt, cover_image, published } = req.body;
      
      if (!title || !slug || !content) {
        return res.status(400).json({ error: '标题、路径和内容不能为空' });
      }

      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/posts`, {
        method: 'POST',
        headers: getSbHeaders(),
        body: JSON.stringify({ title, slug, content, excerpt, cover_image, published })
      });

      const json = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ error: json.message || '创建文章失败' });
      }

      return res.status(201).json(json[0] || json);
    } else if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: '缺少文章ID' });

      const { title, slug, content, excerpt, cover_image, published } = req.body;

      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/posts?id=eq.${id}`, {
        method: 'PATCH',
        headers: getSbHeaders(),
        body: JSON.stringify({ title, slug, content, excerpt, cover_image, published, updated_at: new Date().toISOString() })
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: '更新文章失败' });
      }

      const json = await response.json();
      return res.status(200).json(json[0] || json);
    } else if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: '缺少文章ID' });

      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/posts?id=eq.${id}`, {
        method: 'DELETE',
        headers: getSbHeaders()
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: '删除文章失败' });
      }

      return res.status(200).json({ success: true });
    } else {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (err) {
    return res.status(500).json({ error: '内部错误' });
  }
};
