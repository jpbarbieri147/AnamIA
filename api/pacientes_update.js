// /api/pacientes_update.js — Renomeia uma pasta (paciente) do medico.
function normalizar(nome){
  if(!nome) return '';
  return String(nome).trim().toLowerCase().replace(/\s+/g, ' ');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPA_URL = process.env.SUPABASE_URL;
  const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
  if (!SUPA_URL || !SECRET_KEY) return res.status(500).json({ error: 'Supabase env vars missing' });

  const H = { 'Content-Type': 'application/json', 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + SECRET_KEY };

  try {
    const { access_token, id, nome } = req.body || {};
    if (!access_token) return res.status(401).json({ error: 'Missing access_token' });
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const nomeLimpo = nome ? String(nome).trim() : '';
    if (!nomeLimpo) return res.status(400).json({ error: 'Nome vazio' });

    const userResp = await fetch(SUPA_URL + '/auth/v1/user', {
      method: 'GET', headers: { 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + access_token }
    });
    if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' });
    const user = await userResp.json();
    if (!user || !user.id) return res.status(401).json({ error: 'Could not resolve user from token' });

    // Atualiza filtrando por id E medico_id (garante propriedade)
    const updUrl = SUPA_URL + '/rest/v1/pacientes'
      + '?id=eq.' + encodeURIComponent(id)
      + '&medico_id=eq.' + encodeURIComponent(user.id);
    const updResp = await fetch(updUrl, {
      method: 'PATCH',
      headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
      body: JSON.stringify({ nome: nomeLimpo, nome_normalizado: normalizar(nomeLimpo) })
    });
    if (!updResp.ok) {
      const errText = await updResp.text();
      return res.status(500).json({ error: 'Update failed: ' + errText });
    }
    const updated = await updResp.json();
    if (!updated || updated.length === 0) return res.status(404).json({ error: 'Pasta nao encontrada' });
    return res.status(200).json({ id: id, nome: nomeLimpo });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
