// /api/teleconsulta.js — Teleconsulta via Daily.co
// Acoes: criar_sala, obter_token, encerrar_sala, status_sala
// Valida token Supabase em todas as acoes.

const DAILY_BASE = 'https://api.daily.co/v1';

async function dailyRequest(path, method, body, apiKey) {
  const opts = {
    method: method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(DAILY_BASE + path, opts);
  const data = await r.json();
  if (!r.ok) throw new Error('Daily API error: ' + JSON.stringify(data));
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPA_URL = process.env.SUPABASE_URL;
  const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
  const DAILY_KEY = process.env.DAILY_API_KEY;

  if (!SUPA_URL || !SECRET_KEY) return res.status(500).json({ error: 'Supabase env vars missing' });
  if (!DAILY_KEY) return res.status(500).json({ error: 'DAILY_API_KEY not configured' });

  try {
    const body = req.body || {};
    const { access_token, acao } = body;
    if (!access_token) return res.status(401).json({ error: 'Missing access_token' });
    if (!acao) return res.status(400).json({ error: 'Missing acao' });

    // Valida token Supabase
    const userResp = await fetch(SUPA_URL + '/auth/v1/user', {
      method: 'GET',
      headers: { 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + access_token }
    });
    if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' });
    const user = await userResp.json();
    if (!user || !user.id) return res.status(401).json({ error: 'Could not resolve user' });
    const uid = user.id;

    // ── CRIAR SALA ───────────────────────────────────────────────
    if (acao === 'criar_sala') {
      const { agendamento_id, paciente_nome } = body;
      // Nome da sala: medico-uid-timestamp (unico e rastreavel)
      const roomName = 'anamia-' + uid.substring(0, 8) + '-' + Date.now();
      const sala = await dailyRequest('/rooms', 'POST', {
        name: roomName,
        properties: {
          max_participants: 2,
          exp: Math.floor(Date.now()/1000) + 7200, // expira em 2h
          enable_chat: false,
          enable_screenshare: false,
          start_video_off: false,
          start_audio_off: false,
          eject_at_room_exp: true
        }
      }, DAILY_KEY);

      return res.status(200).json({
        sala_name: sala.name,
        sala_url: sala.url,
        expires_at: sala.config && sala.config.exp
      });
    }

    // ── OBTER TOKEN (medico = owner, paciente = guest) ───────────
    if (acao === 'obter_token') {
      const { sala_name, role, paciente_nome } = body;
      if (!sala_name) return res.status(400).json({ error: 'Missing sala_name' });

      const isMedico = role === 'medico';
      const token = await dailyRequest('/meeting-tokens', 'POST', {
        properties: {
          room_name: sala_name,
          is_owner: isMedico,
          user_name: isMedico ? 'Médico' : (paciente_nome || 'Paciente'),
          exp: Math.floor(Date.now()/1000) + 7200,
          eject_at_token_exp: true
        }
      }, DAILY_KEY);

      return res.status(200).json({ token: token.token });
    }

    // ── ENCERRAR SALA ────────────────────────────────────────────
    if (acao === 'encerrar_sala') {
      const { sala_name } = body;
      if (!sala_name) return res.status(400).json({ error: 'Missing sala_name' });
      // Verifica que a sala pertence a este medico (nome contém uid)
      if (!sala_name.includes(uid.substring(0, 8))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      try {
        await dailyRequest('/rooms/' + sala_name, 'DELETE', null, DAILY_KEY);
      } catch(e) {
        // Sala pode já ter expirado — não é erro crítico
        console.log('Room delete warning:', e.message);
      }
      return res.status(200).json({ ok: true });
    }

    // ── STATUS DA SALA ───────────────────────────────────────────
    if (acao === 'status_sala') {
      const { sala_name } = body;
      if (!sala_name) return res.status(400).json({ error: 'Missing sala_name' });
      try {
        const presence = await dailyRequest('/rooms/' + sala_name + '/presence', 'GET', null, DAILY_KEY);
        return res.status(200).json({ participantes: presence.total_count || 0 });
      } catch(e) {
        return res.status(200).json({ participantes: 0 });
      }
    }

    return res.status(400).json({ error: 'Acao desconhecida: ' + acao });
  } catch (e) {
    console.error('teleconsulta handler error:', e);
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
