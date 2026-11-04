"use client";

import { useState } from "react";

export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Copia non permessa dal browser: resta il link da aprire
    }
  }

  return (
    <button type="button" onClick={copy} className="rounded-full border border-bottle/30 bg-white px-4 py-2 text-sm font-semibold text-bottle hover:border-bottle">
      {copied ? "Link copiato" : "Copia il link"}
    </button>
  );
}
