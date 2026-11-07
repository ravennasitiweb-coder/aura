"use client";

/** Apre WhatsApp con un messaggio pronto e il link di prenotazione */
export function ShareWhatsApp({ path, name }: { path: string; name: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const text = `Da oggi puoi prenotare da ${name} direttamente online, quando vuoi: ${location.origin}${path}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      }}
      className="rounded-full bg-[#25d366] px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
    >
      Condividi su WhatsApp
    </button>
  );
}
