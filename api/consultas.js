// /api/consultas.js — Consolida get.js e list.js em uma unica funcao.
// Acoes: get (retorna uma consulta completa), list (lista consultas com filtros)
// fetch puro, sem SDK. Valida token e propriedade em todas as acoes.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPA_URL = process.env.SUPABASE_URL;
  const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
  if (!SUPA_URL || !SECRET_KEY) return res.status(500).json({ error: 'Supabase env vars missing' });

  const H = { 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + SECRET_KEY, 'Content-Type': 'application/json' };

  try {
    const { access_token, acao, id, paciente_id, sem_pasta } = req.body || {};
    if (!access_token) return res.status(401).json({ error: 'Missing access_token' });
    if (!acao) return res.status(400).json({ error: 'Missing acao' });

    // Valida token
    const userResp = await fetch(SUPA_URL + '/auth/v1/user', {
      method: 'GET', headers: { 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + access_token }
    });
    if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' });
    const user = await userResp.json();
    if (!user || !user.id) return res.status(401).json({ error: 'Could not resolve user from token' });
    const uid = user.id;

    // ── GET — retorna uma consulta completa ──────────────────────
    if (acao === 'get') {
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const url = SUPA_URL + '/rest/v1/consultas'
        + '?select=*'
        + '&id=eq.' + encodeURIComponent(id)
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const r = await fetch(url, { method: 'GET', headers: H });
      if (!r.ok) return res.status(500).json({ error: 'Get failed: ' + await r.text() });
      const rows = await r.json();
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Consulta nao encontrada' });
      return res.status(200).json({ consulta: rows[0] });
    }

    // ── LIST — lista consultas com filtros opcionais ─────────────
    if (acao === 'list') {
      const cols = 'id,titulo,paciente_id,paciente_nome,paciente_idade,paciente_sexo,duracao_segundos,created_at';
      let url = SUPA_URL + '/rest/v1/consultas'
        + '?select=' + encodeURIComponent(cols)
        + '&medico_id=eq.' + encodeURIComponent(uid)
        + '&order=created_at.desc';
      if (paciente_id) url += '&paciente_id=eq.' + encodeURIComponent(paciente_id);
      else if (sem_pasta) url += '&paciente_id=is.null';
      const r = await fetch(url, { method: 'GET', headers: H });
      if (!r.ok) return res.status(500).json({ error: 'List failed: ' + await r.text() });
      return res.status(200).json({ consultas: await r.json() });
    }


    // ── SAVE — inserir ou atualizar consulta ──────────────────────
    if (acao === 'save') {
      const { payload } = req.body || {};
      if (!payload || !payload.medico_id) return res.status(400).json({ error: 'Missing payload or medico_id' });
      if (uid !== payload.medico_id) return res.status(403).json({ error: 'Token does not match medico_id' });

      let paciente_id = payload.paciente_id || null;

      // Segurança: confirma que a pasta pertence ao médico
      if (paciente_id) {
        const checkResp = await fetch(SUPA_URL + '/rest/v1/pacientes?select=id&id=eq.' + encodeURIComponent(paciente_id) + '&medico_id=eq.' + encodeURIComponent(uid) + '&limit=1', { method: 'GET', headers: H });
        if (checkResp.ok) {
          const found = await checkResp.json();
          if (!found || found.length === 0) paciente_id = null;
        }
      }

      const HH = Object.assign({}, H, { 'Content-Type': 'application/json', 'Prefer': 'return=representation' });

      // UPDATE se payload.id vier preenchido
      if (payload.id) {
        const ownerResp = await fetch(SUPA_URL + '/rest/v1/consultas?select=id,paciente_id&id=eq.' + encodeURIComponent(payload.id) + '&medico_id=eq.' + encodeURIComponent(uid) + '&limit=1', { method: 'GET', headers: H });
        if (!ownerResp.ok) return res.status(500).json({ error: 'Ownership check failed' });
        const ownerData = await ownerResp.json();
        if (!ownerData || ownerData.length === 0) return res.status(403).json({ error: 'Consulta not found or not owned by user' });
        const existingPacienteId = ownerData[0].paciente_id;

        const updateResp = await fetch(SUPA_URL + '/rest/v1/consultas?id=eq.' + encodeURIComponent(payload.id), {
          method: 'PATCH', headers: HH,
          body: JSON.stringify({ paciente_nome: payload.paciente_nome || null, paciente_idade: payload.paciente_idade || null, paciente_sexo: payload.paciente_sexo || null, anamnese: payload.anamnese || null, updated_at: new Date().toISOString() })
        });
        if (!updateResp.ok) return res.status(500).json({ error: 'Update failed: ' + await updateResp.text() });

        if (existingPacienteId) {
          await fetch(SUPA_URL + '/rest/v1/pacientes?id=eq.' + encodeURIComponent(existingPacienteId), { method: 'PATCH', headers: HH, body: JSON.stringify({ updated_at: new Date().toISOString() }) });
        }
        return res.status(200).json({ id: payload.id, paciente_id: existingPacienteId });
      }

      // INSERT — nova consulta
      const insertResp = await fetch(SUPA_URL + '/rest/v1/consultas', {
        method: 'POST', headers: HH,
        body: JSON.stringify({ medico_id: uid, paciente_id, paciente_nome: payload.paciente_nome || null, paciente_idade: payload.paciente_idade || null, paciente_sexo: payload.paciente_sexo || null, transcricao: payload.transcricao || null, anamnese: payload.anamnese || null, duracao_segundos: payload.duracao_segundos || null })
      });
      if (!insertResp.ok) return res.status(500).json({ error: 'Insert failed: ' + await insertResp.text() });
      const saved = await insertResp.json();

      if (paciente_id) {
        await fetch(SUPA_URL + '/rest/v1/pacientes?id=eq.' + encodeURIComponent(paciente_id), { method: 'PATCH', headers: HH, body: JSON.stringify({ updated_at: new Date().toISOString() }) });
      }
      return res.status(200).json({ id: saved[0] && saved[0].id, paciente_id });
    }

        return res.status(400).json({ error: 'Acao desconhecida: ' + acao });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
