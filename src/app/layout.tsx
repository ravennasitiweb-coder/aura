import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const viewport: Viewport = { themeColor: "#0e5a4a" };

export const metadata: Metadata = {
  // Icona per "Aggiungi alla schermata Home" su iPhone
  icons: { apple: "/icone/180" },
  appleWebApp: { capable: true, title: "SmartBooking", statusBarStyle: "default" },
  title: "SmartBooking — Prenotazioni online per saloni",
  description:
    "Agenda online e pagina di prenotazione per saloni, barbieri, estetisti, tatuatori, trainer e altre attività su appuntamento: i clienti prenotano da soli, 24 ore su 24.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${bricolage.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
