import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 font-display text-lg font-bold tracking-tight ${className}`}>
      {/* Pettine stilizzato con un dente "prenotato" */}
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect x="2" y="4" width="22" height="7" rx="3.5" className="fill-bottle" />
        {[5, 9, 13, 17, 21].map((x) => (
          <rect key={x} x={x - 1} y="10" width="2.4" height={x === 13 ? 12 : 9} rx="1.2" className={x === 13 ? "fill-cherry" : "fill-bottle"} />
        ))}
      </svg>
      SmartBooking AI
    </Link>
  );
}
