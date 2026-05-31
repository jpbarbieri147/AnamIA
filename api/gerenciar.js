// /api/gerenciar.js — Funcao unica que gerencia pastas (pacientes) e consultas.
// Recebe { access_token, acao, ...params }. Substitui 7 funcoes separadas
// para respeitar o limite de 12 Serverless Functions do plano Hobby do Vercel.
// fetch puro, sem SDK. Toda operacao valida o token e a propriedade (medico_id).

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
    const body = req.body || {};
    const { access_token, acao } = body;
    if (!access_token) return res.status(401).json({ error: 'Missing access_token' });
    if (!acao) return res.status(400).json({ error: 'Missing acao' });

    // Valida token -> dono (uma vez, vale para todas as acoes)
    const userResp = await fetch(SUPA_URL + '/auth/v1/user', {
      method: 'GET', headers: { 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + access_token }
    });
    if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' });
    const user = await userResp.json();
    if (!user || !user.id) return res.status(401).json({ error: 'Could not resolve user from token' });
    const uid = user.id;

    // ===================== PERFIL DO MÉDICO =====================

    if (acao === 'perfil_get') {
      const perfUrl = SUPA_URL + '/rest/v1/medicos'
        + '?select=id,nome,crm,uf_crm,especialidade,telefone,email_contato,cep,rua,numero,complemento,bairro,cidade,uf_endereco'
        + '&id=eq.' + encodeURIComponent(uid)
        + '&limit=1';
      const perfResp = await fetch(perfUrl, { method: 'GET', headers: H });
      if (!perfResp.ok) return res.status(500).json({ error: 'Perfil get failed: ' + await perfResp.text() });
      const perfData = await perfResp.json();
      if (!perfData || perfData.length === 0) return res.status(404).json({ error: 'Perfil nao encontrado' });
      return res.status(200).json({ perfil: perfData[0] });
    }

    if (acao === 'perfil_update') {
      const { nome, crm, uf_crm, especialidade, telefone, email_contato,
              cep, rua, numero, complemento, bairro, cidade, uf_endereco } = body;
      const nomeLimpo = nome ? String(nome).trim() : '';
      if (!nomeLimpo) return res.status(400).json({ error: 'Nome obrigatorio' });
      const updUrl = SUPA_URL + '/rest/v1/medicos'
        + '?id=eq.' + encodeURIComponent(uid);
      const updResp = await fetch(updUrl, {
        method: 'PATCH',
        headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({
          nome: nomeLimpo,
          crm: crm ? String(crm).trim() : null,
          uf_crm: uf_crm ? String(uf_crm).trim().toUpperCase() : null,
          especialidade: especialidade ? String(especialidade).trim() : null,
          telefone: telefone ? String(telefone).trim() : null,
          email_contato: email_contato ? String(email_contato).trim() : null,
          cep: cep ? String(cep).trim() : null,
          rua: rua ? String(rua).trim() : null,
          numero: numero ? String(numero).trim() : null,
          complemento: complemento ? String(complemento).trim() : null,
          bairro: bairro ? String(bairro).trim() : null,
          cidade: cidade ? String(cidade).trim() : null,
          uf_endereco: uf_endereco ? String(uf_endereco).trim().toUpperCase() : null
        })
      });
      if (!updResp.ok) return res.status(500).json({ error: 'Perfil update failed: ' + await updResp.text() });
      const updated = await updResp.json();
      if (!updated || updated.length === 0) return res.status(404).json({ error: 'Perfil nao encontrado' });
      return res.status(200).json({ perfil: updated[0] });
    }

    // ===================== PACIENTES (PASTAS) =====================

    if (acao === 'pacientes_list') {
      const pacUrl = SUPA_URL + '/rest/v1/pacientes'
        + '?select=id,nome,created_at,updated_at'
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const pacResp = await fetch(pacUrl, { method: 'GET', headers: H });
      if (!pacResp.ok) return res.status(500).json({ error: 'List pacientes failed: ' + await pacResp.text() });
      const pacientes = await pacResp.json();

      const consUrl = SUPA_URL + '/rest/v1/consultas'
        + '?select=id,paciente_id,created_at'
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const consResp = await fetch(consUrl, { method: 'GET', headers: H });
      const consultas = consResp.ok ? await consResp.json() : [];

      const agg = {};
      let semPasta = 0;
      for (let i = 0; i < consultas.length; i++) {
        const c = consultas[i];
        if (!c.paciente_id) { semPasta++; continue; }
        if (!agg[c.paciente_id]) agg[c.paciente_id] = { count: 0, ultima: null };
        agg[c.paciente_id].count++;
        if (!agg[c.paciente_id].ultima || c.created_at > agg[c.paciente_id].ultima) {
          agg[c.paciente_id].ultima = c.created_at;
        }
      }
      const out = pacientes.map(function(p){
        const a = agg[p.id] || { count: 0, ultima: null };
        return { id: p.id, nome: p.nome, created_at: p.created_at, updated_at: p.updated_at,
                 num_consultas: a.count, ultima_consulta: a.ultima };
      });
      return res.status(200).json({ pacientes: out, sem_pasta: semPasta });
    }

    if (acao === 'pacientes_create') {
      const nomeLimpo = body.nome ? String(body.nome).trim() : '';
      if (!nomeLimpo) return res.status(400).json({ error: 'Nome da pasta vazio' });
      const nomeNorm = normalizar(nomeLimpo);

      const findUrl = SUPA_URL + '/rest/v1/pacientes'
        + '?select=id&medico_id=eq.' + encodeURIComponent(uid)
        + '&nome_normalizado=eq.' + encodeURIComponent(nomeNorm) + '&limit=1';
      const findResp = await fetch(findUrl, { method: 'GET', headers: H });
      if (findResp.ok) {
        const found = await findResp.json();
        if (found && found.length > 0) return res.status(409).json({ error: 'Ja existe uma pasta com esse nome', id: found[0].id });
      }
      const createResp = await fetch(SUPA_URL + '/rest/v1/pacientes', {
        method: 'POST', headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({ medico_id: uid, nome: nomeLimpo, nome_normalizado: nomeNorm })
      });
      if (!createResp.ok) return res.status(500).json({ error: 'Create failed: ' + await createResp.text() });
      const created = await createResp.json();
      return res.status(200).json({ id: created[0] && created[0].id, nome: nomeLimpo });
    }

    if (acao === 'pacientes_update') {
      if (!body.id) return res.status(400).json({ error: 'Missing id' });
      const nomeLimpo = body.nome ? String(body.nome).trim() : '';
      if (!nomeLimpo) return res.status(400).json({ error: 'Nome vazio' });
      const updUrl = SUPA_URL + '/rest/v1/pacientes'
        + '?id=eq.' + encodeURIComponent(body.id)
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const updResp = await fetch(updUrl, {
        method: 'PATCH', headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({ nome: nomeLimpo, nome_normalizado: normalizar(nomeLimpo) })
      });
      if (!updResp.ok) return res.status(500).json({ error: 'Update failed: ' + await updResp.text() });
      const updated = await updResp.json();
      if (!updated || updated.length === 0) return res.status(404).json({ error: 'Pasta nao encontrada' });
      return res.status(200).json({ id: body.id, nome: nomeLimpo });
    }

    if (acao === 'pacientes_delete') {
      if (!body.id) return res.status(400).json({ error: 'Missing id' });
      const delUrl = SUPA_URL + '/rest/v1/pacientes'
        + '?id=eq.' + encodeURIComponent(body.id)
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const delResp = await fetch(delUrl, {
        method: 'DELETE', headers: Object.assign({}, H, { 'Prefer': 'return=representation' })
      });
      if (!delResp.ok) return res.status(500).json({ error: 'Delete failed: ' + await delResp.text() });
      const deleted = await delResp.json();
      if (!deleted || deleted.length === 0) return res.status(404).json({ error: 'Pasta nao encontrada' });
      return res.status(200).json({ ok: true, id: body.id });
    }

    // ===================== CONSULTAS =====================

    if (acao === 'consulta_update') {
      if (!body.id) return res.status(400).json({ error: 'Missing id' });
      const tituloLimpo = (body.titulo !== undefined && body.titulo !== null) ? String(body.titulo).trim() : '';
      const updUrl = SUPA_URL + '/rest/v1/consultas'
        + '?id=eq.' + encodeURIComponent(body.id)
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const updResp = await fetch(updUrl, {
        method: 'PATCH', headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({ titulo: tituloLimpo || null })
      });
      if (!updResp.ok) return res.status(500).json({ error: 'Update failed: ' + await updResp.text() });
      const updated = await updResp.json();
      if (!updated || updated.length === 0) return res.status(404).json({ error: 'Consulta nao encontrada' });
      return res.status(200).json({ id: body.id, titulo: tituloLimpo });
    }

    if (acao === 'consulta_delete') {
      if (!body.id) return res.status(400).json({ error: 'Missing id' });
      const delUrl = SUPA_URL + '/rest/v1/consultas'
        + '?id=eq.' + encodeURIComponent(body.id)
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const delResp = await fetch(delUrl, {
        method: 'DELETE', headers: Object.assign({}, H, { 'Prefer': 'return=representation' })
      });
      if (!delResp.ok) return res.status(500).json({ error: 'Delete failed: ' + await delResp.text() });
      const deleted = await delResp.json();
      if (!deleted || deleted.length === 0) return res.status(404).json({ error: 'Consulta nao encontrada' });
      return res.status(200).json({ ok: true, id: body.id });
    }

    if (acao === 'consulta_mover') {
      if (!body.id) return res.status(400).json({ error: 'Missing consulta id' });
      const novoPacienteId = body.paciente_id || null;
      const updUrl = SUPA_URL + '/rest/v1/consultas'
        + '?id=eq.' + encodeURIComponent(body.id)
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const updResp = await fetch(updUrl, {
        method: 'PATCH', headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({ paciente_id: novoPacienteId })
      });
      if (!updResp.ok) return res.status(500).json({ error: 'Move failed: ' + await updResp.text() });
      const updated = await updResp.json();
      if (!updated || updated.length === 0) return res.status(404).json({ error: 'Consulta nao encontrada' });
      return res.status(200).json({ ok: true, id: body.id, paciente_id: novoPacienteId });
    }

    return res.status(400).json({ error: 'Acao desconhecida: ' + acao });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
