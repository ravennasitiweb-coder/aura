import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { AppNav } from "@/components/app/AppNav";
import { FeedbackButton } from "@/components/app/FeedbackButton";
import { signOut } from "@/app/(auth)/actions";
import { switchSalon } from "@/app/app/switch-actions";
import { getCurrentSalon } from "@/lib/auth";
import { businessType } from "@/lib/business-types";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="print:hidden border-b border-line bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4 lg:px-5 lg:py-5">
          <Logo className="text-base" />
          <form action={signOut} className="lg:hidden">
            <button type="submit" className="text-sm text-ink-soft hover:text-ink">Esci</button>
          </form>
        </div>
        <div className="px-4 lg:px-5">
          <Suspense fallback={<div className="h-10" />}>
            <SalonBadge />
          </Suspense>
        </div>
        <div className="px-3 pb-3 pt-2 lg:flex-1 lg:pt-4">
          <Suspense fallback={<AppNav />}>
            <SalonNav />
          </Suspense>
        </div>
        <div className="hidden border-t border-line p-5 lg:block">
          <Link href="/demo" className="block text-sm text-ink-soft hover:text-ink">Apri la demo</Link>
          <form action={signOut} className="mt-3">
            <button type="submit" className="text-sm text-ink-soft hover:text-ink">Esci</button>
          </form>
        </div>
      </aside>
      <main className="w-full max-w-5xl flex-1 px-4 pb-24 pt-8 sm:px-8">{children}</main>
      <Suspense fallback={null}>
        <FeedbackButton />
      </Suspense>
    </div>
  );
}

async function SalonNav() {
  const { salon } = await getCurrentSalon();
  return <AppNav tables={businessType(salon.business_type).tables === true} />;
}

async function SalonBadge() {
  const { salon, salons, user } = await getCurrentSalon();
  return (
    <div className="rounded-xl bg-paper px-3 py-2">
      {salons.length > 1 ? (
        <form action={switchSalon}>
          <label className="sr-only" htmlFor="salon_id">Attività</label>
          <select
            id="salon_id"
            name="salon_id"
            defaultValue={salon.id}
            className="w-full truncate bg-transparent text-sm font-semibold outline-none"
          >
            {salons.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button type="submit" className="text-xs text-bottle underline">Passa a questa attività</button>
        </form>
      ) : (
        <p className="truncate text-sm font-semibold">{salon.name}</p>
      )}
      <p className="truncate text-xs text-ink-soft">{user.email}</p>
      <Link href="/app/onboarding" className="text-xs text-ink-soft underline">+ Nuova attività</Link>
    </div>
  );
}
