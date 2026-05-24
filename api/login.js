const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET env var not set');
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function makeToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function getUsers() {
  try {
    return JSON.parse(process.env.USERS_JSON || '[]');
  } catch {
    return [];
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Faltan campos' });
  }

  const users = getUsers();
  const user = users.find(
    u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password
  );

  if (!user) {
    return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
  }

  const token = makeToken({
    sub: user.email,
    name: user.name,
    packs: user.packs || [],
    exp: Date.now() + TOKEN_TTL_MS
  });

  return res.status(200).json({ success: true, token, name: user.name, packs: user.packs || [] });
};
