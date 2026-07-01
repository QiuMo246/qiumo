const { verifyAdmin } = require('./utils');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: '请输入密码' });
    }

    if (password === process.env.ADMIN_SECRET) {
      // Return the secret itself as a simple token (transferred over HTTPS)
      return res.status(200).json({ success: true, token: process.env.ADMIN_SECRET });
    } else {
      return res.status(401).json({ error: '密码错误' });
    }
  } catch (err) {
    return res.status(500).json({ error: '内部错误' });
  }
};
