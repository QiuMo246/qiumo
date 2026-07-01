const { getSbHeaders, fetch } = require('./utils');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { slug } = req.query;

    if (slug) {
      // Get single post
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/posts?slug=eq.${slug}&published=eq.true`, {
        method: 'GET',
        headers: getSbHeaders()
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch post' });
      }

      const posts = await response.json();
      if (posts.length === 0) {
        return res.status(404).json({ error: '文章不存在' });
      }

      return res.status(200).json(posts[0]);
    } else {
      // Get published posts list
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/posts?published=eq.true&order=created_at.desc`, {
        method: 'GET',
        headers: getSbHeaders()
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch posts' });
      }

      const posts = await response.json();
      return res.status(200).json(posts);
    }
  } catch (err) {
    return res.status(500).json({ error: '内部错误' });
  }
};
