// /api/documentos.js — Gerencia PDFs para RAG do Osler.
// Acoes: upload (cria doc + chunks + embeddings), list, delete.
// fetch puro, sem SDK. Valida token e propriedade em todas as acoes.

const CHUNK_WORDS = 400;   // palavras por chunk
const CHUNK_OVERLAP = 80;  // palavras de sobreposicao entre chunks
const MAX_CHUNKS = 150;    // limite de seguranca (~200 paginas)

function chunkText(texto) {
  // Divide por paragrafos, agrupa em chunks de ~CHUNK_WORDS palavras com overlap
  const paragraphs = texto.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let current = [];
  let wordCount = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const pWords = paragraphs[i].split(/\s+/).length;
    if (wordCount + pWords > CHUNK_WORDS && current.length > 0) {
      chunks.push(current.join('\n\n'));
      // Overlap: mantém últimos paragrafos até CHUNK_OVERLAP palavras
      let overlapWords = 0;
      let overlapParas = [];
      for (let j = current.length - 1; j >= 0; j--) {
        const w = current[j].split(/\s+/).length;
        if (overlapWords + w > CHUNK_OVERLAP) break;
        overlapParas.unshift(current[j]);
        overlapWords += w;
      }
      current = overlapParas;
      wordCount = overlapWords;
    }
    current.push(paragraphs[i]);
    wordCount += pWords;
    if (chunks.length >= MAX_CHUNKS) break;
  }
  if (current.length > 0 && chunks.length < MAX_CHUNKS) {
    chunks.push(current.join('\n\n'));
  }
  return chunks;
}

async function getEmbeddings(texts, openaiKey) {
  // Gera embeddings em lote (uma chamada para todos os chunks)
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + openaiKey },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts })
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error('OpenAI embeddings error: ' + err);
  }
  const data = await resp.json();
  // Retorna array de arrays de floats, na mesma ordem dos inputs
  return data.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPA_URL = process.env.SUPABASE_URL;
  const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!SUPA_URL || !SECRET_KEY) return res.status(500).json({ error: 'Supabase env vars missing' });

  const H = { 'Content-Type': 'application/json', 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + SECRET_KEY };

  try {
    const body = req.body || {};
    const { access_token, acao } = body;
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

    // ── UPLOAD ──────────────────────────────────────────────────
    if (acao === 'upload') {
      if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
      const { nome, tamanho_bytes, texto } = body;
      if (!nome || !texto) return res.status(400).json({ error: 'Missing nome or texto' });
      if (texto.trim().length < 50) return res.status(400).json({ error: 'Texto muito curto — PDF pode estar escaneado ou vazio' });

      // 1. Cria registro do documento
      const docResp = await fetch(SUPA_URL + '/rest/v1/documentos', {
        method: 'POST',
        headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({ medico_id: uid, nome: nome, tamanho_bytes: tamanho_bytes || 0, status: 'indexando' })
      });
      if (!docResp.ok) return res.status(500).json({ error: 'Erro ao criar documento: ' + await docResp.text() });
      const docData = await docResp.json();
      const docId = docData[0].id;

      try {
        // 2. Chunking
        const chunks = chunkText(texto);
        if (chunks.length === 0) return res.status(400).json({ error: 'Nenhum conteudo extraido do PDF' });

        // 3. Embeddings em lote
        const embeddings = await getEmbeddings(chunks, OPENAI_KEY);

        // 4. Insere chunks com embeddings
        const rows = chunks.map((c, i) => ({
          documento_id: docId,
          medico_id: uid,
          chunk_index: i,
          conteudo: c,
          embedding: JSON.stringify(embeddings[i])
        }));

        const chunksResp = await fetch(SUPA_URL + '/rest/v1/documento_chunks', {
          method: 'POST',
          headers: Object.assign({}, H, { 'Prefer': 'return=minimal' }),
          body: JSON.stringify(rows)
        });
        if (!chunksResp.ok) throw new Error('Erro ao inserir chunks: ' + await chunksResp.text());

        // 5. Atualiza status para indexado
        await fetch(SUPA_URL + '/rest/v1/documentos?id=eq.' + encodeURIComponent(docId), {
          method: 'PATCH', headers: H,
          body: JSON.stringify({ status: 'indexado', num_chunks: chunks.length })
        });

        return res.status(200).json({ id: docId, nome, num_chunks: chunks.length });

      } catch (indexErr) {
        // Marca documento como erro se o indexing falhar
        await fetch(SUPA_URL + '/rest/v1/documentos?id=eq.' + encodeURIComponent(docId), {
          method: 'PATCH', headers: H,
          body: JSON.stringify({ status: 'erro' })
        });
        throw indexErr;
      }
    }

    // ── LIST ─────────────────────────────────────────────────────
    if (acao === 'list') {
      const listUrl = SUPA_URL + '/rest/v1/documentos'
        + '?select=id,nome,tamanho_bytes,num_chunks,status,created_at'
        + '&medico_id=eq.' + encodeURIComponent(uid)
        + '&order=created_at.desc';
      const listResp = await fetch(listUrl, { method: 'GET', headers: H });
      if (!listResp.ok) return res.status(500).json({ error: 'List failed: ' + await listResp.text() });
      return res.status(200).json({ documentos: await listResp.json() });
    }

    // ── DELETE ───────────────────────────────────────────────────
    if (acao === 'delete') {
      if (!body.id) return res.status(400).json({ error: 'Missing id' });
      // Chunks são excluídos em cascata pelo banco
      const delUrl = SUPA_URL + '/rest/v1/documentos'
        + '?id=eq.' + encodeURIComponent(body.id)
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const delResp = await fetch(delUrl, {
        method: 'DELETE',
        headers: Object.assign({}, H, { 'Prefer': 'return=representation' })
      });
      if (!delResp.ok) return res.status(500).json({ error: 'Delete failed: ' + await delResp.text() });
      const deleted = await delResp.json();
      if (!deleted || deleted.length === 0) return res.status(404).json({ error: 'Documento nao encontrado' });
      return res.status(200).json({ ok: true, id: body.id });
    }

    return res.status(400).json({ error: 'Acao desconhecida: ' + acao });
  } catch (e) {
    console.error('documentos handler error:', e);
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
