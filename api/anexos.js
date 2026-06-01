// /api/anexos.js — Upload, listagem e exclusao de anexos de exames.
// Acoes: upload, list, delete, get_url
// Arquivos armazenados no Supabase Storage bucket 'exames'.
// Metadados na tabela exame_anexos.

export const config = {
  api: { bodyParser: { sizeLimit: '28mb' } }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPA_URL = process.env.SUPABASE_URL;
  const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
  if (!SUPA_URL || !SECRET_KEY) return res.status(500).json({ error: 'Supabase env vars missing' });

  const H = {
    'Content-Type': 'application/json',
    'apikey': SECRET_KEY,
    'Authorization': 'Bearer ' + SECRET_KEY
  };

  try {
    const body = req.body || {};
    const { access_token, acao } = body;
    if (!access_token) return res.status(401).json({ error: 'Missing access_token' });
    if (!acao) return res.status(400).json({ error: 'Missing acao' });

    // Valida token
    const userResp = await fetch(SUPA_URL + '/auth/v1/user', {
      method: 'GET',
      headers: { 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + access_token }
    });
    if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' });
    const user = await userResp.json();
    if (!user || !user.id) return res.status(401).json({ error: 'Could not resolve user' });
    const uid = user.id;

    // ── UPLOAD ─────────────────────────────────────────────────
    if (acao === 'upload') {
      const { consulta_id, tipo, nome, mime_type, tamanho_bytes, data: b64 } = body;
      if (!consulta_id) return res.status(400).json({ error: 'Missing consulta_id' });
      if (!nome || !b64) return res.status(400).json({ error: 'Missing nome or data' });
      if (!['lab', 'img'].includes(tipo)) return res.status(400).json({ error: 'tipo deve ser lab ou img' });

      // Valida que a consulta pertence ao medico
      const consCheck = await fetch(
        SUPA_URL + '/rest/v1/consultas?id=eq.' + encodeURIComponent(consulta_id) +
        '&medico_id=eq.' + encodeURIComponent(uid) + '&select=id&limit=1',
        { method: 'GET', headers: H }
      );
      if (!consCheck.ok) return res.status(500).json({ error: 'Erro ao verificar consulta' });
      const consData = await consCheck.json();
      if (!consData || consData.length === 0) return res.status(403).json({ error: 'Consulta nao encontrada ou sem permissao' });

      // Path no Storage: medico_id/consulta_id/timestamp_nome
      const ts = Date.now();
      const nomeSeguro = nome.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = uid + '/' + consulta_id + '/' + ts + '_' + nomeSeguro;

      // Decodifica base64
      const fileBuffer = Buffer.from(b64, 'base64');
      const mimeType = mime_type || 'application/octet-stream';

      // Upload para Supabase Storage
      const uploadResp = await fetch(
        SUPA_URL + '/storage/v1/object/exames/' + storagePath,
        {
          method: 'POST',
          headers: {
            'apikey': SECRET_KEY,
            'Authorization': 'Bearer ' + SECRET_KEY,
            'Content-Type': mimeType,
            'x-upsert': 'false'
          },
          body: fileBuffer
        }
      );
      if (!uploadResp.ok) {
        const errText = await uploadResp.text();
        return res.status(500).json({ error: 'Storage upload failed: ' + errText });
      }

      // Salva metadados na tabela
      const metaResp = await fetch(SUPA_URL + '/rest/v1/exame_anexos', {
        method: 'POST',
        headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({
          consulta_id,
          medico_id: uid,
          tipo,
          nome,
          tamanho_bytes: tamanho_bytes || fileBuffer.length,
          mime_type: mimeType,
          storage_path: storagePath
        })
      });
      if (!metaResp.ok) return res.status(500).json({ error: 'Meta save failed: ' + await metaResp.text() });
      const meta = await metaResp.json();
      return res.status(200).json({ id: meta[0].id, nome, storage_path: storagePath });
    }

    // ── LIST ────────────────────────────────────────────────────
    if (acao === 'list') {
      const { consulta_id } = body;
      if (!consulta_id) return res.status(400).json({ error: 'Missing consulta_id' });
      const listResp = await fetch(
        SUPA_URL + '/rest/v1/exame_anexos?select=id,tipo,nome,tamanho_bytes,mime_type,storage_path,created_at' +
        '&consulta_id=eq.' + encodeURIComponent(consulta_id) +
        '&medico_id=eq.' + encodeURIComponent(uid) +
        '&order=created_at.asc',
        { method: 'GET', headers: H }
      );
      if (!listResp.ok) return res.status(500).json({ error: 'List failed: ' + await listResp.text() });
      return res.status(200).json({ anexos: await listResp.json() });
    }

    // ── GET_URL (URL assinada para visualizacao) ────────────────
    if (acao === 'get_url') {
      const { storage_path } = body;
      if (!storage_path) return res.status(400).json({ error: 'Missing storage_path' });
      // Verifica que o path pertence ao medico (começa com uid)
      if (!storage_path.startsWith(uid + '/')) return res.status(403).json({ error: 'Forbidden' });
      const signResp = await fetch(
        SUPA_URL + '/storage/v1/object/sign/exames/' + storage_path,
        {
          method: 'POST',
          headers: H,
          body: JSON.stringify({ expiresIn: 3600 })
        }
      );
      if (!signResp.ok) return res.status(500).json({ error: 'Sign URL failed: ' + await signResp.text() });
      const signData = await signResp.json();
      const signedUrl = SUPA_URL + '/storage/v1' + signData.signedURL;
      return res.status(200).json({ url: signedUrl });
    }

    // ── DELETE ──────────────────────────────────────────────────
    if (acao === 'delete') {
      const { id, storage_path } = body;
      if (!id || !storage_path) return res.status(400).json({ error: 'Missing id or storage_path' });
      if (!storage_path.startsWith(uid + '/')) return res.status(403).json({ error: 'Forbidden' });

      // Remove do Storage
      await fetch(SUPA_URL + '/storage/v1/object/exames', {
        method: 'DELETE',
        headers: H,
        body: JSON.stringify({ prefixes: [storage_path] })
      });

      // Remove da tabela
      const delResp = await fetch(
        SUPA_URL + '/rest/v1/exame_anexos?id=eq.' + encodeURIComponent(id) +
        '&medico_id=eq.' + encodeURIComponent(uid),
        { method: 'DELETE', headers: Object.assign({}, H, { 'Prefer': 'return=representation' }) }
      );
      if (!delResp.ok) return res.status(500).json({ error: 'Delete failed: ' + await delResp.text() });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Acao desconhecida: ' + acao });
  } catch (e) {
    console.error('anexos handler error:', e);
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
