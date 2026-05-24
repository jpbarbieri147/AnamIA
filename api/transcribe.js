import OpenAI from "openai";
import { IncomingForm } from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const form = new IncomingForm({ keepExtensions: true, maxFileSize: 25 * 1024 * 1024 });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const audioFile = files.audio?.[0] || files.audio;
    if (!audioFile) return res.status(400).json({ error: "Nenhum arquivo de áudio recebido" });

    const phase = fields.phase?.[0] || fields.phase || "an";

    const fileStream = fs.createReadStream(audioFile.filepath);
    fileStream.name = audioFile.originalFilename || "audio.webm";

    const transcription = await openai.audio.transcriptions.create({
      file: fileStream,
      model: "whisper-1",
      language: "pt",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"]
    });

    // Format transcript with speaker labels based on phase
    // In anamnese phase: try to detect doctor/patient from context
    // In exam phase: all is doctor
    let formattedTranscript = "";

    if (phase === "ef") {
      formattedTranscript = transcription.segments
        .map(s => "[MEDICO]: " + s.text.trim())
        .join("\n");
    } else {
      // Heuristic: questions tend to be doctor, answers tend to be patient
      formattedTranscript = transcription.segments.map(s => {
        const txt = s.text.trim();
        const isQuestion = txt.endsWith("?") ||
          /^(qual|como|quando|onde|há quanto|tem|faz|já|algum|sente|apresenta|refere)/i.test(txt);
        const speaker = isQuestion ? "[MEDICO]" : "[PACIENTE]";
        return speaker + ": " + txt;
      }).join("\n");
    }

    return res.status(200).json({
      transcript: formattedTranscript,
      raw: transcription.text,
      segments: transcription.segments
    });

  } catch (error) {
    console.error("Whisper error:", error);
    return res.status(500).json({ error: error.message || "Erro na transcrição" });
  }
}
