import "server-only";

// Assistente AI della sala tramite Groq (piano gratuito, API compatibile OpenAI).
// La chiave GROQ_API_KEY sta solo sul server (Vercel), mai nel browser.

export const groqEnabled = () => Boolean(process.env.GROQ_API_KEY);

export const AI_DAILY_LIMIT = 10;
export const AI_LIMIT_MESSAGE = `Hai usato le ${AI_DAILY_LIMIT} richieste all'assistente di oggi. Riprova domani.`;

type Db = { rpc: (fn: "use_ai_request", args: { p_salon_id: string }) => PromiseLike<{ data: unknown; error: unknown }> };

/** Conta una richiesta dell'attività: false oltre il limite giornaliero */
export async function takeAiRequest(supabase: unknown, salonId: string) {
  const { data, error } = await (supabase as Db).rpc("use_ai_request", { p_salon_id: salonId });
  return !error && data === true;
}

const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

export async function groqJson(system: string, user: string): Promise<unknown> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (res.status === 429) throw new Error("LIMITE");
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}

const VISION_MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

/** Come groqJson, ma con una foto (data URL JPEG) */
export async function groqVisionJson(system: string, user: string, imageDataUrl: string): Promise<unknown> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: [{ type: "text", text: user }, { type: "image_url", image_url: { url: imageDataUrl } }] },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (res.status === 429) throw new Error("LIMITE");
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}

/** Trascrive un vocale in italiano (Whisper su Groq) */
export async function groqTranscribe(audio: File): Promise<string> {
  const form = new FormData();
  form.append("file", audio, audio.name || "vocale.webm");
  form.append("model", "whisper-large-v3-turbo");
  form.append("language", "it");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(45_000),
  });
  if (res.status === 429) throw new Error("LIMITE");
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  return String(((await res.json()) as { text?: string }).text ?? "").trim().slice(0, 2000);
}
