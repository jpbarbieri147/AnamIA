// api/prescricao.js — Locais de atendimento e prescrições
export const config = { maxDuration: 30 };

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SECRET_KEY;

async function getUser(token) {
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return null;
  return r.json();
}

async function supaFetch(path, method = 'GET', body = null, extraHeaders = {}) {
  const opts = {
    method,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...extraHeaders
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, opts);
  const text = await r.text();
  return { ok: r.ok, status: r.status, data: text ? JSON.parse(text) : null };
}

async function uploadLogo(base64, uid) {
  try {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    const bytes = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) bytes[i] = bstr.charCodeAt(i);
    const ext = mime === 'image/png' ? 'png' : 'jpg';
    const path = `logos/${uid}_${Date.now()}.${ext}`;

    const r = await fetch(`${SUPA_URL}/storage/v1/object/Logos/${path}`, {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': mime,
        'x-upsert': 'true'
      },
      body: bytes
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('uploadLogo error:', err);
      return null;
    }
    return `${SUPA_URL}/storage/v1/object/public/Logos/${path}`;
  } catch (e) {
    console.error('uploadLogo exception:', e);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token ausente' });

  const user = await getUser(token);
  if (!user?.id) return res.status(401).json({ error: 'Não autenticado' });
  const uid = user.id;

  const { acao, ...payload } = req.body || {};

  try {

    // ── LOCAL_SAVE ──
    if (acao === 'local_save') {
      const {
        id, nome, cnes, logradouro, numero, complemento,
        bairro, cidade, uf, cep, telefone, email,
        exibir_cpf_medico, exibir_endereco_paciente, logo_base64
      } = payload;

      if (!nome || !logradouro || !uf || !cidade)
        return res.status(400).json({ error: 'Campos obrigatórios: nome, logradouro, uf, cidade' });

      // Upload de logo se enviada
      let logo_url = payload.logo_url || null;
      if (logo_base64) {
        const url = await uploadLogo(logo_base64, uid);
        if (url) logo_url = url;
      }

      const body = {
        medico_id: uid,
        nome,
        cnes: cnes || null,
        logradouro,
        numero: numero || null,
        complemento: complemento || null,
        bairro: bairro || null,
        cidade,
        uf: uf.toUpperCase(),
        cep: cep ? cep.replace(/\D/g, '') : null,
        telefone: telefone || null,
        email: email || null,
        logo_url,
        exibir_cpf_medico: exibir_cpf_medico !== false,
        exibir_endereco_paciente: !!exibir_endereco_paciente,
        ativo: true
      };

      let result;
      if (id) {
        delete body.medico_id; // não alterar o dono
        result = await supaFetch(
          `locais_atendimento?id=eq.${id}&medico_id=eq.${uid}`, 'PATCH', body
        );
      } else {
        result = await supaFetch('locais_atendimento', 'POST', body);
      }

      if (!result.ok) {
        console.error('local_save error:', result.data);
        return res.status(500).json({ error: 'Erro ao salvar local' });
      }
      return res.status(200).json({ ok: true, data: result.data });
    }

    // ── LOCAL_LIST ──
    if (acao === 'local_list') {
      const result = await supaFetch(
        `locais_atendimento?medico_id=eq.${uid}&ativo=eq.true&order=created_at.asc`
      );
      if (!result.ok) return res.status(500).json({ error: 'Erro ao listar locais' });
      return res.status(200).json({ ok: true, data: result.data });
    }

    // ── LOCAL_DELETE ──
    if (acao === 'local_delete') {
      const { id } = payload;
      if (!id) return res.status(400).json({ error: 'ID obrigatório' });
      const result = await supaFetch(
        `locais_atendimento?id=eq.${id}&medico_id=eq.${uid}`, 'PATCH', { ativo: false }
      );
      if (!result.ok) return res.status(500).json({ error: 'Erro ao excluir local' });
      return res.status(200).json({ ok: true });
    }

    // ── PRESCRICAO_SAVE ──
    if (acao === 'prescricao_save') {
      const { id, paciente_id, consulta_id, local_id, tipo, itens, observacoes, status } = payload;

      if (!local_id || !tipo)
        return res.status(400).json({ error: 'local_id e tipo obrigatórios' });

      const tipos_validos = ['simples', 'antimicrobiano', 'especial_b'];
      if (!tipos_validos.includes(tipo))
        return res.status(400).json({ error: 'Tipo inválido' });

      let numero_especial = null;
      if (tipo === 'especial_b' && !id) {
        const numRes = await supaFetch(`receitas_especiais_numeracao?medico_id=eq.${uid}`);
        const atual = numRes.data?.[0]?.ultimo_numero || 0;
        const proximo = atual + 1;
        numero_especial = String(proximo).padStart(6, '0');
        if (numRes.data?.[0]) {
          await supaFetch(
            `receitas_especiais_numeracao?medico_id=eq.${uid}`,
            'PATCH', { ultimo_numero: proximo, updated_at: new Date().toISOString() }
          );
        } else {
          await supaFetch(
            'receitas_especiais_numeracao', 'POST',
            { medico_id: uid, ultimo_numero: proximo }
          );
        }
      }

      const body = {
        medico_id: uid,
        paciente_id: paciente_id || null,
        consulta_id: consulta_id || null,
        local_id,
        tipo,
        status: status || 'rascunho',
        itens: itens || [],
        observacoes: observacoes || null,
        ...(numero_especial && { numero_especial })
      };

      let result;
      if (id) {
        delete body.medico_id;
        result = await supaFetch(`prescricoes?id=eq.${id}&medico_id=eq.${uid}`, 'PATCH', body);
      } else {
        result = await supaFetch('prescricoes', 'POST', body);
      }

      if (!result.ok) return res.status(500).json({ error: 'Erro ao salvar prescrição' });
      return res.status(200).json({ ok: true, data: result.data });
    }

    // ── PRESCRICAO_LIST ──
    if (acao === 'prescricao_list') {
      const { paciente_id, consulta_id, limit = 20, offset = 0 } = payload;
      let path = `prescricoes?medico_id=eq.${uid}&order=created_at.desc&limit=${limit}&offset=${offset}`;
      if (paciente_id) path += `&paciente_id=eq.${paciente_id}`;
      if (consulta_id) path += `&consulta_id=eq.${consulta_id}`;
      const result = await supaFetch(path);
      if (!result.ok) return res.status(500).json({ error: 'Erro ao listar prescrições' });
      return res.status(200).json({ ok: true, data: result.data });
    }

    // ── PRESCRICAO_GET ──
    if (acao === 'prescricao_get') {
      const { id } = payload;
      if (!id) return res.status(400).json({ error: 'ID obrigatório' });
      const result = await supaFetch(`prescricoes?id=eq.${id}&medico_id=eq.${uid}`);
      if (!result.ok || !result.data?.[0])
        return res.status(404).json({ error: 'Prescrição não encontrada' });
      return res.status(200).json({ ok: true, data: result.data[0] });
    }

    return res.status(400).json({ error: 'Ação inválida: ' + acao });

  } catch (e) {
    console.error('[prescricao]', e);
    return res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
}
