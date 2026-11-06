"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, string>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Riquadro anti-bot di Cloudflare: aggiunge al modulo il campo cf-turnstile-response */
export function Turnstile() {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const api = window.turnstile;
    if (!SITE_KEY || !ref.current || !api) return;
    const id = api.render(ref.current, { sitekey: SITE_KEY, language: "it", size: "flexible" });
    return () => api.remove(id);
  }, [ready]);

  if (!SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div ref={ref} />
    </>
  );
}

/** Un codice vale una volta sola: dopo ogni invio non riuscito se ne chiede uno nuovo */
export const resetTurnstile = () => window.turnstile?.reset();
