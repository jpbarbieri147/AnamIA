// /api/pacientes_list.js — Lista as pastas (pacientes) do medico, com contagem de consultas.
// fetch puro. Valida token server-side.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPA_URL = process.env.SUPABASE_URL;
  const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
  if (!SUPA_URL || !SECRET_KEY) return res.status(500).json({ error: 'Supabase env vars missing' });

  const H = { 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + SECRET_KEY };

  try {
    const { access_token } = req.body || {};
    if (!access_token) return res.status(401).json({ error: 'Missing access_token' });

    const userResp = await fetch(SUPA_URL + '/auth/v1/user', {
      method: 'GET', headers: { 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + access_token }
    });
    if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' });
    const user = await userResp.json();
    if (!user || !user.id) return res.status(401).json({ error: 'Could not resolve user from token' });

    // Busca as pastas do medico
    const pacUrl = SUPA_URL + '/rest/v1/pacientes'
      + '?select=id,nome,created_at,updated_at'
      + '&medico_id=eq.' + encodeURIComponent(user.id);
    const pacResp = await fetch(pacUrl, { method: 'GET', headers: H });
    if (!pacResp.ok) {
      const errText = await pacResp.text();
      return res.status(500).json({ error: 'List pacientes failed: ' + errText });
    }
    const pacientes = await pacResp.json();

    // Busca as consultas (so colunas leves) para contar/derivar ultima data por pasta
    const consUrl = SUPA_URL + '/rest/v1/consultas'
      + '?select=id,paciente_id,created_at'
      + '&medico_id=eq.' + encodeURIComponent(user.id);
    const consResp = await fetch(consUrl, { method: 'GET', headers: H });
    const consultas = consResp.ok ? await consResp.json() : [];

    // Agrega contagem + ultima consulta por paciente_id
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
      return {
        id: p.id,
        nome: p.nome,
        created_at: p.created_at,
        updated_at: p.updated_at,
        num_consultas: a.count,
        ultima_consulta: a.ultima
      };
    });

    return res.status(200).json({ pacientes: out, sem_pasta: semPasta });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
