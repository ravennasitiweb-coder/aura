"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const LINKS = [
  { href: "/app", label: "Panoramica" },
  { href: "/app/assistente", label: "Assistente" },
  { href: "/app/agenda", label: "Agenda" },
  { href: "/app/aggiungi", label: "Aggiungi veloce" },
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
// Ristoranti: "Sala e tavoli" al posto di "Collaboratori"
const TABLE_LINKS = LINKS.map((l) => (l.href === "/app/collaboratori" ? { href: "/app/sala", label: "Sala e tavoli" } : l));

export function AppNav({ tables = false }: { tables?: boolean }) {
  return (
    <Suspense fallback={<NavLinks pathname={null} tables={tables} />}>
      <ActiveNav tables={tables} />
    </Suspense>
  );
}

function ActiveNav({ tables }: { tables: boolean }) {
  return <NavLinks pathname={usePathname()} tables={tables} />;
}

function NavLinks({ pathname, tables }: { pathname: string | null; tables: boolean }) {
  return (
    <nav aria-label="Area riservata" className="flex gap-1 overflow-x-auto lg:flex-col">
      {(tables ? TABLE_LINKS : LINKS).map((l) => {
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
