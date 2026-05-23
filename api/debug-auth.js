module.exports = async function handler(req, res) {
  const raw = process.env.USERS_JSON || '(no configurado)';
  let parsed = null;
  let parseError = null;
  try { parsed = JSON.parse(raw); } catch(e) { parseError = e.message; }

  return res.status(200).json({
    raw_length: raw.length,
    first_50_chars: raw.substring(0, 50),
    parse_ok: parseError === null,
    parse_error: parseError,
    user_count: Array.isArray(parsed) ? parsed.length : null,
    first_user_email: Array.isArray(parsed) && parsed[0] ? parsed[0].email : null
  });
};
