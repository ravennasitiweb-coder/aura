import type { MetadataRoute } from "next";

// Rende SmartBooking installabile sul telefono, con la sua icona nella
// schermata principale (Android: "Installa app"; iPhone: Condividi →
// "Aggiungi alla schermata Home").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SmartBooking",
    short_name: "SmartBooking",
    description: "Agenda e prenotazioni online per la tua attività",
    lang: "it",
    start_url: "/app/agenda",
    scope: "/",
    display: "standalone",
    background_color: "#f6f8f7",
    theme_color: "#0e5a4a",
    icons: [
      { src: "/icone/192", sizes: "192x192", type: "image/png" },
      { src: "/icone/512", sizes: "512x512", type: "image/png" },
      { src: "/icone/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
