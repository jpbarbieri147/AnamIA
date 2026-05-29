// /api/get.js — Retorna UMA consulta completa (com anamnese e transcricao)
// Valida o token e confirma que a consulta pertence ao medico antes de devolver.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPA_URL = process.env.SUPABASE_URL;
  const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

  if (!SUPA_URL || !SECRET_KEY) {
    return res.status(500).json({ error: 'Supabase env vars missing' });
  }

  try {
    const { access_token, id } = req.body || {};
    if (!access_token) {
      return res.status(401).json({ error: 'Missing access_token' });
    }
    if (!id) {
      return res.status(400).json({ error: 'Missing id' });
    }

    // 1. Valida o token e descobre o dono
    const userResp = await fetch(SUPA_URL + '/auth/v1/user', {
      method: 'GET',
      headers: {
        'apikey': SECRET_KEY,
        'Authorization': 'Bearer ' + access_token
      }
    });
    if (!userResp.ok) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const user = await userResp.json();
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Could not resolve user from token' });
    }

    // 2. Busca a consulta filtrando por id E medico_id (dono).
    //    Se a consulta nao for desse medico, retorna vazio -> 404.
    const url = SUPA_URL + '/rest/v1/consultas'
      + '?select=*'
      + '&id=eq.' + encodeURIComponent(id)
      + '&medico_id=eq.' + encodeURIComponent(user.id);

    const getResp = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SECRET_KEY,
        'Authorization': 'Bearer ' + SECRET_KEY
      }
    });

    if (!getResp.ok) {
      const errText = await getResp.text();
      return res.status(500).json({ error: 'Get failed: ' + errText });
    }

    const rows = await getResp.json();
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Consulta nao encontrada' });
    }

    return res.status(200).json({ consulta: rows[0] });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
