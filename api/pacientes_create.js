// /api/pacientes_create.js — Cria uma pasta (paciente) para o medico autenticado.
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
    const { access_token, nome } = req.body || {};
    if (!access_token) return res.status(401).json({ error: 'Missing access_token' });
    const nomeLimpo = nome ? String(nome).trim() : '';
    if (!nomeLimpo) return res.status(400).json({ error: 'Nome da pasta vazio' });

    const userResp = await fetch(SUPA_URL + '/auth/v1/user', {
      method: 'GET', headers: { 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + access_token }
    });
    if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' });
    const user = await userResp.json();
    if (!user || !user.id) return res.status(401).json({ error: 'Could not resolve user from token' });

    const nomeNorm = normalizar(nomeLimpo);

    // Evita duplicada: ja existe pasta com esse nome?
    const findUrl = SUPA_URL + '/rest/v1/pacientes'
      + '?select=id&medico_id=eq.' + encodeURIComponent(user.id)
      + '&nome_normalizado=eq.' + encodeURIComponent(nomeNorm) + '&limit=1';
    const findResp = await fetch(findUrl, { method: 'GET', headers: H });
    if (findResp.ok) {
      const found = await findResp.json();
      if (found && found.length > 0) {
        return res.status(409).json({ error: 'Ja existe uma pasta com esse nome', id: found[0].id });
      }
    }

    const createResp = await fetch(SUPA_URL + '/rest/v1/pacientes', {
      method: 'POST',
      headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
      body: JSON.stringify({ medico_id: user.id, nome: nomeLimpo, nome_normalizado: nomeNorm })
    });
    if (!createResp.ok) {
      const errText = await createResp.text();
      return res.status(500).json({ error: 'Create failed: ' + errText });
    }
    const created = await createResp.json();
    return res.status(200).json({ id: created[0] && created[0].id, nome: nomeLimpo });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
