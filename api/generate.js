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

    const systemPrompt = `Voce e um assistente medico clinico especializado em semiologia brasileira (Porto, 8a ed.). Analise a transcricao e preencha os campos abaixo. Retorne APENAS o objeto JSON puro. Sem markdown. Sem texto antes ou depois. Comece com { e termine com }.

Campos a preencher:
${fieldList}

Instrucoes especiais:
- hda_narrativa: paragrafo narrativo coeso em linguagem medica formal resumindo toda a HDA
- ap_narrativa: paragrafo narrativo dos antecedentes pessoais
- af_narrativa: paragrafo narrativo dos antecedentes familiares
- lab_resultados: organize os exames laboratoriais em lista estruturada
- img_achados: organize os achados de imagem em lista estruturada
- hipoteses: hipoteses diagnosticas numeradas com justificativa e aviso de revisao medica obrigatoria
- conduta: condutas sugeridas com aviso de revisao medica obrigatoria

Regras:
- Nao invente dados. Nao abordado = "Nao investigado". Exame fisico nao realizado = "Nao examinado".
- Converta linguagem leiga para terminologia medica.
- Registre negativas explicitamente (ex: "Nega dispneia").

JSON a preencher: ${JSON.stringify(template)}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: "Transcricao:\n\n" + transcript }]
    });

    const raw = message.content.map(b => b.text || "").join("");

    let parsed = null;
    try {
      let clean = raw.trim();
      const start = clean.indexOf("{");
      const end = clean.lastIndexOf("}");
      if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
      parsed = JSON.parse(clean);
    } catch (e) {
      parsed = null;
    }

    return res.status(200).json({ result: parsed, raw });

  } catch (error) {
    console.error("Claude error:", error);
    return res.status(500).json({ error: error.message || "Erro ao gerar anamnese" });
  }
}
