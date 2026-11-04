import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPublicSalon, publicToday } from "@/lib/public-booking";
import { BookingFlow } from "./BookingFlow";

export const metadata: Metadata = { title: "Prenota online" };

export default function PublicBookingPage({ params }: PageProps<"/p/[slug]">) {
  return (
    <div className="min-h-screen bg-paper">
      <Suspense fallback={<p className="p-6 text-ink-soft">Caricamento…</p>}>
        <SalonBooking params={params} />
      </Suspense>
      <footer className="mx-auto flex max-w-2xl justify-center gap-4 px-4 pb-10 pt-4 text-xs text-chrome">
        <span>
          Prenotazioni con <Link href="/" className="underline">SmartBooking AI</Link>
        </span>
        <Link href="/privacy" className="underline">Privacy</Link>
      </footer>
    </div>
  );
}

async function SalonBooking({ params }: { params: PageProps<"/p/[slug]">["params"] }) {
  const { slug } = await params;
  const info = await getPublicSalon(slug);
  if (!info) notFound();

  return (
    <>
      <header className="bg-bottle text-white">
        <div className="mx-auto max-w-2xl px-4 pb-8 pt-10">
          <p className="text-sm text-mint">Prenota online</p>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{info.salon.name}</h1>
          {info.salon.city && <p className="mt-1 text-mint">{info.salon.city}</p>}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        {info.services.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white p-6 text-ink-soft">
            Al momento non è possibile prenotare online. Contatta direttamente il salone.
          </p>
        ) : (
          <BookingFlow slug={info.salon.slug} info={info} today={publicToday()} />
        )}
      </main>
    </>
  );
}
