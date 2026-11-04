import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-4 px-4">
      <Logo />
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">Pagina non trovata</h1>
      <p className="text-ink-soft">
        L&apos;indirizzo potrebbe essere sbagliato, oppure il salone ha cambiato il link di prenotazione. Controlla il link o
        contatta direttamente il salone.
      </p>
      <Link href="/" className="rounded-full bg-bottle px-5 py-2.5 font-semibold text-white hover:bg-bottle-dark">
        Vai alla home
      </Link>
    </div>
  );
}
