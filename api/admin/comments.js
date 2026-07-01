const { getSbHeaders, verifyAdmin, fetch } = require('../utils');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!verifyAdmin(req)) {
    return res.status(401).json({ error: '未授权' });
  }

  try {
    if (req.method === 'GET') {
      // List all comments (including soft-deleted if we want, but let's list all for admin, sorted by created_at desc)
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/comments?order=created_at.desc`, {
        method: 'GET',
        headers: getSbHeaders()
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch comments' });
      }

      const comments = await response.json();
      return res.status(200).json(comments);
    } else if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: '缺少评论ID' });
      }

      // Hard or soft delete - let's do a soft delete just like the user's frontend, but via admin, OR hard delete?
      // Soft delete is safer: sets is_deleted = true. Let's do update is_deleted = true.
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/comments?id=eq.${id}`, {
        method: 'PATCH',
        headers: getSbHeaders(),
        body: JSON.stringify({ is_deleted: true })
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to delete comment' });
      }

      return res.status(200).json({ success: true });
    } else {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (err) {
    return res.status(500).json({ error: '内部错误' });
  }
};
