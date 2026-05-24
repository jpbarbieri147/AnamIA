import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { transcript, activeKeys, fieldMap } = req.body;
    if (!transcript) return res.status(400).json({ error: "Transcrição não fornecida" });
    if (!activeKeys || activeKeys.length === 0) return res.status(400).json({ error: "Nenhum campo ativo" });

    const template = {};
    activeKeys.forEach(k => { template[k] = ""; });
    const fieldList = activeKeys.map(k => `"${k}": ${fieldMap[k] || k}`).join("\n");

    const systemPrompt = `Voce e um assistente medico clinico especializado em semiologia brasileira (Porto, 8a ed.). Analise a transcricao e preencha os campos abaixo.

REGRA CRITICA DE FORMATO: Retorne APENAS um objeto JSON puro. Cada campo deve ter um VALOR DO TIPO STRING (texto simples). NUNCA aninhe objetos ou arrays. NUNCA use {} ou [] dentro dos valores. Apenas strings com quebras de linha "\\n" quando necessario.

Campos a preencher (todos com valor string):
${fieldList}

Instrucoes para campos especiais:
- hda_narrativa: paragrafo narrativo coeso em linguagem medica formal resumindo toda a HDA (STRING)
- ap_narrativa: paragrafo narrativo dos antecedentes pessoais (STRING)
- af_narrativa: paragrafo narrativo dos antecedentes familiares (STRING)
- lab_resultados: lista de exames laboratoriais em formato texto, um por linha (STRING)
- img_achados: lista de achados de imagem em formato texto, um por linha (STRING)
- hipoteses: hipoteses diagnosticas numeradas com justificativa, em texto (STRING)
- conduta: condutas sugeridas (exames, encaminhamentos), em texto (STRING)

Regras gerais:
- Nao invente dados. Nao abordado = "Nao investigado". Exame fisico nao realizado = "Nao examinado".
- Converta linguagem leiga para terminologia medica.
- Registre negativas explicitamente (ex: "Nega dispneia").
- Para hipoteses e conduta, ao final acrescente: "(Revisao medica obrigatoria.)"

Retorne SOMENTE o JSON, sem markdown, sem texto extra. Comece com { e termine com }.

JSON template: ${JSON.stringify(template)}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: "Transcricao da consulta:\n\n" + transcript }]
    });

    const raw = message.content.map(b => b.text || "").join("");

    let parsed = null;
    try {
      let clean = raw.trim();
      const start = clean.indexOf("{");
      const end = clean.lastIndexOf("}");
      if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
      parsed = JSON.parse(clean);

      // Sanitize: convert any non-string values to strings
      Object.keys(parsed).forEach(k => {
        const v = parsed[k];
        if (v == null) { parsed[k] = ""; return; }
        if (typeof v === "string") return;
        if (typeof v === "number" || typeof v === "boolean") { parsed[k] = String(v); return; }
        if (Array.isArray(v)) {
          parsed[k] = v.map(item => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object") return Object.entries(item).map(([kk,vv]) => `${kk}: ${vv}`).join("; ");
            return String(item);
          }).join("; ");
          return;
        }
        if (typeof v === "object") {
          parsed[k] = Object.entries(v).map(([kk,vv]) => {
            if (vv && typeof vv === "object") vv = JSON.stringify(vv);
            return `${kk}: ${vv}`;
          }).join("\n");
        }
      });
    } catch (e) {
      parsed = null;
    }

    return res.status(200).json({ result: parsed, raw });

  } catch (error) {
    console.error("Claude error:", error);
    return res.status(500).json({ error: error.message || "Erro ao gerar anamnese" });
  }
}
