import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { system, messages } = req.body;
    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: "Nenhuma mensagem recebida" });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: system || "Você é o Osler, assistente de raciocínio clínico da AnamIA.",
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    });

    const text = response.content.map(b => b.text || "").join("");
    return res.status(200).json({ response: text });

  } catch (error) {
    console.error("Osler error:", error);
    return res.status(500).json({ error: error.message || "Erro no Osler" });
  }
}
