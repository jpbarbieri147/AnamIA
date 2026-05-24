import OpenAI from "openai";
import { Readable } from "stream";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { audio, phase, mimeType } = req.body;

    if (!audio) return res.status(400).json({ error: "Nenhum áudio recebido" });

    // Convert base64 to buffer
    const buffer = Buffer.from(audio, "base64");
    const mime = mimeType || "audio/webm";
    const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";

    // Create a readable stream from buffer
    const stream = Readable.from(buffer);
    stream.path = `audio.${ext}`;

    const transcription = await openai.audio.transcriptions.create({
      file: stream,
      model: "whisper-1",
      language: "pt",
      response_format: "verbose_json",
    });

    // Format with speaker labels
    let formattedTranscript = "";
    if (phase === "ef") {
      formattedTranscript = transcription.segments
        .map((s) => "[MEDICO]: " + s.text.trim())
        .join("\n");
    } else {
      formattedTranscript = transcription.segments
        .map((s) => {
          const txt = s.text.trim();
          const isQuestion =
            txt.endsWith("?") ||
            /^(qual|como|quando|onde|há quanto|tem |faz |já |algum|sente|apresenta|refere|possui|existe)/i.test(txt);
          return (isQuestion ? "[MEDICO]" : "[PACIENTE]") + ": " + txt;
        })
        .join("\n");
    }

    return res.status(200).json({
      transcript: formattedTranscript,
      raw: transcription.text,
    });
  } catch (error) {
    console.error("Whisper error:", error);
    return res.status(500).json({ error: error.message || "Erro na transcrição" });
  }
}
