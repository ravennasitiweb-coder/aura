"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/app", label: "Panoramica" },
  { href: "/app/agenda", label: "Agenda" },
  { href: "/app/servizi", label: "Servizi" },
  { href: "/app/collaboratori", label: "Collaboratori" },
  { href: "/app/orari", label: "Orari di apertura" },
  { href: "/app/impostazioni", label: "Impostazioni" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Area riservata" className="flex gap-1 overflow-x-auto lg:flex-col">
      {LINKS.map((l) => {
        const active = l.href === "/app" ? pathname === "/app" : pathname.startsWith(l.href);
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
