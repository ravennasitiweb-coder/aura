import { ImageResponse } from "next/og";
import { addDays, nowInTimezone } from "@/lib/agenda";
import { getCurrentSalon } from "@/lib/auth";
import { freeTimesOn } from "@/lib/gaps";

// Storia Instagram 1080x1920 con i posti liberi di oggi o domani.

export async function GET(request: Request) {
  const { salon } = await getCurrentSalon();
  const giorno = new URL(request.url).searchParams.get("giorno") === "domani" ? "domani" : "oggi";
  const today = nowInTimezone("Europe/Rome").date;
  const times = (await freeTimesOn(giorno === "domani" ? addDays(today, 1) : today)).slice(0, 6);
  const host = new URL(request.url).host;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0a4337", color: "white", padding: 90, fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 44, color: "#9fd2be", fontWeight: 700 }}>{salon.name}</div>
        <div style={{ marginTop: 180, fontSize: 150, fontWeight: 800, lineHeight: 1, letterSpacing: -4 }}>Posti liberi</div>
        <div style={{ fontSize: 150, fontWeight: 800, lineHeight: 1.05, color: "#9fd2be", letterSpacing: -4 }}>{giorno}</div>
        <div style={{ marginTop: 90, display: "flex", flexWrap: "wrap", gap: 28 }}>
          {(times.length ? times : ["—"]).map((t) => (
            <div key={t} style={{ display: "flex", background: "#cde8dc", color: "#0a4337", borderRadius: 999, padding: "26px 48px", fontSize: 72, fontWeight: 800 }}>
              {t}
            </div>
          ))}
        </div>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 56, fontWeight: 700 }}>Prenota dal link in bio</div>
          <div style={{ marginTop: 16, fontSize: 38, color: "rgba(255,255,255,0.7)" }}>{`${host}/p/${salon.slug}`}</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, headers: { "Cache-Control": "private, no-store" } },
  );
}
