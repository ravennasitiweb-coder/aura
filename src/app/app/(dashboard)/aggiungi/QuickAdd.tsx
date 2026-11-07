"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { readBookings, saveCaptured, type Captured } from "@/app/app/capture-actions";

type Option = { id: string; name: string };
type Row = Captured & { status?: { ok: boolean; text: string } };

const MAX_SECONDS = 40;
const INPUT = "w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-bottle";

/** Riduce la foto a JPEG leggibile ma leggero (sotto ~700 KB) */
async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  for (let side = 1600, quality = 0.8; ; side -= 200, quality -= 0.1) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= 700_000 || quality < 0.35) return url;
  }
}

export function QuickAdd({ services, staff }: { services: Option[]; staff: Option[] }) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [heard, setHeard] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const recorder = useRef<MediaRecorder | null>(null);

  async function toggleRecording() {
    if (recording) return recorder.current?.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { audioBitsPerSecond: 64_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setAudio(new Blob(chunks, { type: rec.mimeType }));
        setRecording(false);
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
      setTimeout(() => rec.state === "recording" && rec.stop(), MAX_SECONDS * 1000);
    } catch {
      setError("Non riesco ad accedere al microfono. Controlla i permessi del browser.");
    }
  }

  const read = () =>
    start(async () => {
      setError(null);
      setHeard(null);
      const fd = new FormData();
      fd.set("text", text);
      if (photo) fd.set("photo", photo);
      if (audio) fd.set("audio", new File([audio], audio.type.includes("mp4") ? "vocale.mp4" : "vocale.webm", { type: audio.type }));
      const r = await readBookings(fd);
      if (!r.ok) return setError(r.error);
      setRows(r.items);
      setHeard(r.heard ?? null);
      setText("");
      setPhoto(null);
      setAudio(null);
    });

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch, status: patch.status } : r)));

  const saveAll = () =>
    start(async () => {
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].status?.ok) continue;
        const r = await saveCaptured(rows[i]);
        update(i, { status: { ok: r.ok, text: r.message } });
      }
    });

  const saved = rows.filter((r) => r.status?.ok).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-bottle/40 bg-white p-6 text-center hover:border-bottle">
          <span className="text-4xl" aria-hidden="true">📷</span>
          <span className="font-semibold">{photo ? "Foto pronta ✓" : "Foto dell'agenda"}</span>
          <span className="text-sm text-ink-soft">Quaderno, agenda o screenshot</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setPhoto(await shrinkPhoto(f));
            }}
          />
        </label>

        <button
          type="button"
          onClick={toggleRecording}
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-6 text-center ${recording ? "border-cherry bg-cherry/5" : "border-dashed border-bottle/40 bg-white hover:border-bottle"}`}
        >
          <span className="text-4xl" aria-hidden="true">{recording ? "⏹" : "🎙"}</span>
          <span className="font-semibold">{recording ? "Registrando… tocca per fermare" : audio ? "Vocale pronto ✓" : "Detta un vocale"}</span>
          <span className="text-sm text-ink-soft">Es. «Domani alle 10 taglio per Giulia»</span>
        </button>

        <div className="flex flex-col rounded-2xl border-2 border-dashed border-bottle/40 bg-white p-4">
          <label htmlFor="qa-text" className="text-center font-semibold">Incolla un messaggio</label>
          <textarea
            id="qa-text"
            rows={3}
            maxLength={3000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ciao, posso venire giovedì alle 16 per colore? Anna 333…"
            className="mt-2 flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-bottle"
          />
        </div>
      </section>

      <button
        type="button"
        disabled={pending || recording || (!text.trim() && !photo && !audio)}
        onClick={read}
        className="w-full rounded-full bg-bottle px-6 py-4 text-lg font-bold text-white hover:bg-bottle-dark disabled:opacity-50"
      >
        {pending && rows.length === 0 ? "Leggo…" : "Crea gli appuntamenti"}
      </button>

      {error && <p role="alert" className="rounded-xl border border-cherry/30 bg-cherry/5 px-4 py-3 text-sm text-cherry">{error}</p>}
      {heard && <p className="text-sm text-ink-soft">Ho sentito: «{heard}»</p>}

      {rows.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-bottle bg-white p-4">
          <h2 className="font-display text-xl font-bold">Controlla e salva ({rows.length})</h2>
          {rows.map((r, i) => (
            <div key={i} className={`grid gap-2 rounded-xl p-3 sm:grid-cols-[1.2fr_1fr_1.2fr_1fr_0.8fr_0.7fr_auto] ${r.status?.ok ? "bg-mint" : "bg-paper"}`}>
              <input aria-label="Nome" value={r.name} onChange={(e) => update(i, { name: e.target.value })} className={INPUT} disabled={r.status?.ok} />
              <input aria-label="Telefono" value={r.phone} placeholder="Telefono" onChange={(e) => update(i, { phone: e.target.value })} className={INPUT} disabled={r.status?.ok} />
              <select aria-label="Servizio" value={r.service_id} onChange={(e) => update(i, { service_id: e.target.value })} className={INPUT} disabled={r.status?.ok}>
                <option value="">Servizio…</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select aria-label="Chi" value={r.staff_id} onChange={(e) => update(i, { staff_id: e.target.value })} className={INPUT} disabled={r.status?.ok}>
                <option value="">Chi è libero</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input aria-label="Giorno" type="date" value={r.date} onChange={(e) => update(i, { date: e.target.value })} className={INPUT} disabled={r.status?.ok} />
              <input aria-label="Ora" type="time" step={900} value={r.time} onChange={(e) => update(i, { time: e.target.value })} className={INPUT} disabled={r.status?.ok} />
              {r.status?.ok ? (
                <span className="self-center text-sm font-semibold text-bottle">✓</span>
              ) : (
                <button type="button" aria-label="Togli" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="text-ink-soft hover:text-cherry">✕</button>
              )}
              {r.status && !r.status.ok && <p className="text-sm text-cherry sm:col-span-7">{r.status.text}</p>}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={pending || saved === rows.length} onClick={saveAll} className="rounded-full bg-bottle px-6 py-3 font-semibold text-white hover:bg-bottle-dark disabled:opacity-50">
              {pending ? "Salvo…" : `Salva ${rows.length - saved}`}
            </button>
            {saved > 0 && <Link href="/app/agenda" className="font-semibold text-bottle underline">Vai all&apos;agenda ({saved} salvati)</Link>}
          </div>
        </section>
      )}
    </div>
  );
}
