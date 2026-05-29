// /api/save.js — Salva consulta no Supabase via REST API (fetch puro, sem SDK)
// Usa a Secret key server-side; valida o dono do token antes de inserir.

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
    const { access_token, payload } = req.body || {};

    if (!access_token) {
      return res.status(401).json({ error: 'Missing access_token' });
    }
    if (!payload || !payload.medico_id) {
      return res.status(400).json({ error: 'Missing payload or medico_id' });
    }

    // 1. Valida o token: pede o usuario dono dele a API de auth do Supabase
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
    if (user.id !== payload.medico_id) {
      return res.status(403).json({ error: 'Token does not match medico_id' });
    }

    // 2. Insere a consulta via REST, autenticando com a Secret key
    const insertResp = await fetch(SUPA_URL + '/rest/v1/consultas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SECRET_KEY,
        'Authorization': 'Bearer ' + SECRET_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        medico_id: user.id,
        paciente_nome: payload.paciente_nome || null,
        paciente_idade: payload.paciente_idade || null,
        paciente_sexo: payload.paciente_sexo || null,
        transcricao: payload.transcricao || null,
        anamnese: payload.anamnese || null,
        duracao_segundos: payload.duracao_segundos || null
      })
    });

    if (!insertResp.ok) {
      const errText = await insertResp.text();
      return res.status(500).json({ error: 'Insert failed: ' + errText });
    }

    const saved = await insertResp.json();
    return res.status(200).json({ id: saved[0] && saved[0].id });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
