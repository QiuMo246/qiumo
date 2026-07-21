const crypto = require('crypto');

function createToken(secret) {
  var expiry = Date.now() + 24 * 60 * 60 * 1000;
  var payload = String(expiry);
  var hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(payload + '.' + hmac).toString('base64url');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    let body = '';
    await new Promise((resolve, reject) => {
      req.on('data', chunk => body += chunk);
      req.on('end', resolve);
      req.on('error', reject);
    });
    const parsed = JSON.parse(body);
    const { password } = parsed;

    if (!password) {
      return res.status(400).json({ error: '请输入密码' });
    }

    if (password === process.env.ADMIN_SECRET) {
      return res.status(200).json({ success: true, token: createToken(process.env.ADMIN_SECRET) });
    } else {
      return res.status(401).json({ error: '密码错误' });
    }
  } catch (err) {
    return res.status(500).json({ error: '内部错误: ' + err.message });
  }
};
