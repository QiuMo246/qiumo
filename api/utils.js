const fetch = require('node-fetch');

// Helper to construct headers for Supabase
function getSbHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_ANON_KEY || '',
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY || ''}`,
    'Prefer': 'return=representation'
  };
}

// Simple authentication token verification
function verifyAdmin(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  
  // Basic validation - check if it matches ADMIN_SECRET
  // In a full implementation we could use JWT, but matching ADMIN_SECRET directly via HTTPS is robust enough
  return token === process.env.ADMIN_SECRET;
}

module.exports = {
  getSbHeaders,
  verifyAdmin,
  fetch
};
