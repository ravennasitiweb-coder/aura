import "server-only";

// Assistente AI della sala tramite Groq (piano gratuito, API compatibile OpenAI).
// La chiave GROQ_API_KEY sta solo sul server (Vercel), mai nel browser.

export const groqEnabled = () => Boolean(process.env.GROQ_API_KEY);

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
