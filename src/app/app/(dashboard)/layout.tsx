import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { AppNav } from "@/components/app/AppNav";
import { signOut } from "@/app/(auth)/actions";
import { getCurrentSalon } from "@/lib/auth";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-line bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
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
          <AppNav />
        </div>
        <div className="hidden border-t border-line p-5 lg:block">
          <Link href="/demo" className="block text-sm text-ink-soft hover:text-ink">Apri la demo</Link>
          <form action={signOut} className="mt-3">
            <button type="submit" className="text-sm text-ink-soft hover:text-ink">Esci</button>
          </form>
        </div>
      </aside>
      <main className="w-full max-w-5xl flex-1 px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}

async function SalonBadge() {
  const { salon, user } = await getCurrentSalon();
  return (
    <div className="rounded-xl bg-paper px-3 py-2">
      <p className="truncate text-sm font-semibold">{salon.name}</p>
      <p className="truncate text-xs text-ink-soft">{user.email}</p>
    </div>
  );
}
