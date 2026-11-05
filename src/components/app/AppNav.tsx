"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const LINKS = [
  { href: "/app", label: "Panoramica" },
  { href: "/app/agenda", label: "Agenda" },
  { href: "/app/clienti", label: "Clienti" },
  { href: "/app/statistiche", label: "Statistiche" },
  { href: "/app/servizi", label: "Servizi" },
  { href: "/app/collaboratori", label: "Collaboratori" },
  { href: "/app/orari", label: "Orari di apertura" },
  { href: "/app/impostazioni", label: "Impostazioni" },
  { href: "/app/qr", label: "QR code" },
  { href: "/app/abbonamento", label: "Abbonamento" },
];

// Il menu compare subito; la voce attiva si evidenzia appena si conosce
// l'indirizzo della pagina (Next.js lo richiede dentro <Suspense>).
export function AppNav() {
  return (
    <Suspense fallback={<NavLinks pathname={null} />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <NavLinks pathname={usePathname()} />;
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Area riservata" className="flex gap-1 overflow-x-auto lg:flex-col">
      {LINKS.map((l) => {
        const active = pathname !== null && (l.href === "/app" ? pathname === "/app" : pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
              active ? "bg-mint font-semibold text-bottle-dark" : "text-ink-soft hover:bg-paper hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
