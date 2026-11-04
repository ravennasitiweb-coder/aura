import { Logo } from "@/components/Logo";
import { signOut } from "@/app/(auth)/actions";

// Layout semplice, senza menu: qui l'utente non ha ancora un salone
export default function OnboardingLayout({ children }: LayoutProps<"/app/onboarding">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo className="text-base" />
          <form action={signOut}>
            <button type="submit" className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink">
              Esci
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
