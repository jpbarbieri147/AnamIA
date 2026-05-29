// /api/list.js — Lista as consultas do medico autenticado (fetch puro, sem SDK)
// Valida o token server-side; retorna apenas as consultas do dono do token.

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
    const { access_token } = req.body || {};
    if (!access_token) {
      return res.status(401).json({ error: 'Missing access_token' });
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

    // 2. Busca as consultas desse medico, mais recentes primeiro.
    //    Traz so colunas leves para a lista (sem transcricao/anamnese completas).
    const cols = 'id,paciente_nome,paciente_idade,paciente_sexo,duracao_segundos,created_at';
    const url = SUPA_URL + '/rest/v1/consultas'
      + '?select=' + encodeURIComponent(cols)
      + '&medico_id=eq.' + encodeURIComponent(user.id)
      + '&order=created_at.desc';

    const listResp = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SECRET_KEY,
        'Authorization': 'Bearer ' + SECRET_KEY
      }
    });

    if (!listResp.ok) {
      const errText = await listResp.text();
      return res.status(500).json({ error: 'List failed: ' + errText });
    }

    const rows = await listResp.json();
    return res.status(200).json({ consultas: rows });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
