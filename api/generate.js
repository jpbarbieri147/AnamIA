import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

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

    // Truncate transcript if too long (keep first 12000 chars ~3000 tokens)
    const MAX_TX = 12000;
    const tx = transcript.length > MAX_TX
      ? transcript.substring(0, MAX_TX) + "\n[...transcrição truncada para processamento...]"
      : transcript;

    const template = {};
    activeKeys.forEach(k => { template[k] = ""; });
    const fieldList = activeKeys.map(k => `"${k}": "${fieldMap[k] || k}"`).join("\n");

    const systemPrompt = `Voce e um assistente medico clinico especializado em semiologia brasileira (Porto, 8a ed.).

INSTRUCAO CRITICA DE FORMATO:
- Retorne SOMENTE um objeto JSON valido
- Comece com { e termine com }
- NUNCA use blocos markdown, NUNCA use aspas triplas, NUNCA escreva texto fora do JSON
- Todos os valores devem ser strings simples (nunca objetos ou arrays aninhados)
- Use \\n para quebras de linha dentro das strings

Campos a preencher:
${fieldList}

Regras clinicas:
- Nao invente dados. Se nao mencionado: "Nao investigado"
- Exame fisico nao realizado: "Nao examinado"
- Converta linguagem leiga para terminologia medica
- Registre negativas explicitamente (ex: "Nega dispneia")
- Para hipoteses e conduta, adicione ao final: "(Revisao medica obrigatoria.)"

Retorne apenas o JSON preenchido.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: "user", content: "Transcricao:\n\n" + tx }]
    });

    const raw = message.content.map(b => b.text || "").join("");

    // Robust JSON extraction
    let parsed = null;
    try {
      let clean = raw.trim();
      // Remove markdown fences
      clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      // Extract from first { to last }
      const start = clean.indexOf("{");
      const end = clean.lastIndexOf("}");
      if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);
      parsed = JSON.parse(clean);

      // Sanitize all values to strings
      const sanitize = (v) => {
        if (v == null) return "";
        if (typeof v === "string") return v;
        if (typeof v === "number" || typeof v === "boolean") return String(v);
        if (Array.isArray(v)) return v.map(i => typeof i === "object" ? JSON.stringify(i) : String(i)).join("; ");
        if (typeof v === "object") return Object.entries(v).map(([k,vv]) => `${k}: ${typeof vv === "object" ? JSON.stringify(vv) : vv}`).join("\n");
        return String(v);
      };
      Object.keys(parsed).forEach(k => { parsed[k] = sanitize(parsed[k]); });

    } catch (e) {
      parsed = null;
    }

    return res.status(200).json({ result: parsed, raw });

  } catch (error) {
    console.error("Claude error:", error);
    // Return proper JSON error always
    return res.status(500).json({ error: error.message || "Erro ao gerar anamnese" });
  }
}
