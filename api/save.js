// /api/save.js — Salva consulta no Supabase usando Secret key (server-side, ignora RLS com segurança)
import { createClient } from '@supabase/supabase-js';

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

    // Cliente admin com Secret key
    const admin = createClient(SUPA_URL, SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Valida que o token pertence ao medico_id enviado (impede falsificação)
    const userRes = await admin.auth.getUser(access_token);
    if (userRes.error || !userRes.data || !userRes.data.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const verifiedUserId = userRes.data.user.id;
    if (verifiedUserId !== payload.medico_id) {
      return res.status(403).json({ error: 'Token does not match medico_id' });
    }

    // 2. Insere a consulta (Secret key ignora RLS, mas já validamos o dono acima)
    const insertRes = await admin
      .from('consultas')
      .insert({
        medico_id: verifiedUserId,
        paciente_nome: payload.paciente_nome || null,
        paciente_idade: payload.paciente_idade || null,
        paciente_sexo: payload.paciente_sexo || null,
        transcricao: payload.transcricao || null,
        anamnese: payload.anamnese || null,
        duracao_segundos: payload.duracao_segundos || null
      })
      .select('id')
      .single();

    if (insertRes.error) {
      return res.status(500).json({ error: insertRes.error.message });
    }

    return res.status(200).json({ id: insertRes.data.id });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
