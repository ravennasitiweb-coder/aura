"use client";

import Link from "next/link";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-display text-3xl font-bold">Qualcosa è andato storto</h1>
      <p className="mt-2 text-ink-soft">I tuoi dati sono al sicuro. Riprova, e se succede ancora usa il pulsante Aiuto.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className="rounded-full bg-bottle px-5 py-2.5 font-semibold text-white hover:bg-bottle-dark">Riprova</button>
        <Link href="/app" className="rounded-full border border-line px-5 py-2.5 font-semibold hover:border-ink">Panoramica</Link>
      </div>
    </div>
  );
}
