// /api/save.js — Salva consulta + agrupa automaticamente em pasta de paciente (pelo nome)
// fetch puro, sem SDK. Valida o dono do token antes de inserir.

function normalizar(nome){
  if(!nome) return '';
  return String(nome).trim().toLowerCase().replace(/\s+/g, ' ');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPA_URL = process.env.SUPABASE_URL;
  const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
  if (!SUPA_URL || !SECRET_KEY) {
    return res.status(500).json({ error: 'Supabase env vars missing' });
  }

  const H = {
    'Content-Type': 'application/json',
    'apikey': SECRET_KEY,
    'Authorization': 'Bearer ' + SECRET_KEY
  };

  try {
    const { access_token, payload } = req.body || {};
    if (!access_token) return res.status(401).json({ error: 'Missing access_token' });
    if (!payload || !payload.medico_id) return res.status(400).json({ error: 'Missing payload or medico_id' });

    // 1. Valida token -> dono
    const userResp = await fetch(SUPA_URL + '/auth/v1/user', {
      method: 'GET',
      headers: { 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + access_token }
    });
    if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' });
    const user = await userResp.json();
    if (!user || !user.id) return res.status(401).json({ error: 'Could not resolve user from token' });
    if (user.id !== payload.medico_id) return res.status(403).json({ error: 'Token does not match medico_id' });

    // 2. Agrupamento automatico por nome do paciente
    let paciente_id = null;
    const nome = payload.paciente_nome ? String(payload.paciente_nome).trim() : '';
    const nomeNorm = normalizar(nome);

    if (nomeNorm) {
      // 2a. Procura pasta existente desse medico com esse nome normalizado
      const findUrl = SUPA_URL + '/rest/v1/pacientes'
        + '?select=id'
        + '&medico_id=eq.' + encodeURIComponent(user.id)
        + '&nome_normalizado=eq.' + encodeURIComponent(nomeNorm)
        + '&limit=1';
      const findResp = await fetch(findUrl, { method: 'GET', headers: H });
      if (findResp.ok) {
        const found = await findResp.json();
        if (found && found.length > 0) {
          paciente_id = found[0].id;
        }
      }

      // 2b. Nao existe -> cria a pasta
      if (!paciente_id) {
        const createResp = await fetch(SUPA_URL + '/rest/v1/pacientes', {
          method: 'POST',
          headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
          body: JSON.stringify({ medico_id: user.id, nome: nome, nome_normalizado: nomeNorm })
        });
        if (createResp.ok) {
          const created = await createResp.json();
          if (created && created.length > 0) paciente_id = created[0].id;
        }
      }
    }

    // 3. Insere a consulta (com paciente_id quando houver)
    const insertResp = await fetch(SUPA_URL + '/rest/v1/consultas', {
      method: 'POST',
      headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
      body: JSON.stringify({
        medico_id: user.id,
        paciente_id: paciente_id,
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

    // 4. Toca o updated_at da pasta (para ordenacao por "ultima atualizacao")
    if (paciente_id) {
      await fetch(SUPA_URL + '/rest/v1/pacientes?id=eq.' + encodeURIComponent(paciente_id), {
        method: 'PATCH',
        headers: H,
        body: JSON.stringify({ updated_at: new Date().toISOString() })
      });
    }

    return res.status(200).json({ id: saved[0] && saved[0].id, paciente_id: paciente_id });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
