// /api/pacientes_delete.js — Exclui uma pasta (paciente). As consultas dentro
// sao excluidas automaticamente pelo ON DELETE CASCADE configurado no banco.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPA_URL = process.env.SUPABASE_URL;
  const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
  if (!SUPA_URL || !SECRET_KEY) return res.status(500).json({ error: 'Supabase env vars missing' });

  const H = { 'Content-Type': 'application/json', 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + SECRET_KEY };

  try {
    const { access_token, id } = req.body || {};
    if (!access_token) return res.status(401).json({ error: 'Missing access_token' });
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const userResp = await fetch(SUPA_URL + '/auth/v1/user', {
      method: 'GET', headers: { 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + access_token }
    });
    if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' });
    const user = await userResp.json();
    if (!user || !user.id) return res.status(401).json({ error: 'Could not resolve user from token' });

    // Exclui filtrando por id E medico_id
    const delUrl = SUPA_URL + '/rest/v1/pacientes'
      + '?id=eq.' + encodeURIComponent(id)
      + '&medico_id=eq.' + encodeURIComponent(user.id);
    const delResp = await fetch(delUrl, {
      method: 'DELETE',
      headers: Object.assign({}, H, { 'Prefer': 'return=representation' })
    });
    if (!delResp.ok) {
      const errText = await delResp.text();
      return res.status(500).json({ error: 'Delete failed: ' + errText });
    }
    const deleted = await delResp.json();
    if (!deleted || deleted.length === 0) return res.status(404).json({ error: 'Pasta nao encontrada' });
    return res.status(200).json({ ok: true, id: id });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
