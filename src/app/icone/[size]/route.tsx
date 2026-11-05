import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

// Icone PNG dell'app installabile (192 e 512 px), disegnate dal logo:
// un pettine con il dente centrale "prenotato" in rosso ciliegia.
const SIZES = new Set([180, 192, 512]);

export async function GET(_request: NextRequest, ctx: RouteContext<"/icone/[size]">) {
  const { size: raw } = await ctx.params;
  const size = Number(raw.replace(/\.png$/, ""));
  if (!SIZES.has(size)) return new Response("Non trovato", { status: 404 });

  const u = size / 26; // il logo originale è disegnato su una griglia 26×26
  const teeth = [5, 9, 13, 17, 21];

  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", background: "#cde8dc", position: "relative" }}>
        <div style={{ position: "absolute", left: 2 * u + 2 * u, top: 4 * u + 2 * u, width: 22 * u - 4 * u, height: 4 * u, borderRadius: 2 * u, background: "#0e5a4a" }} />
        {teeth.map((x) => (
          <div
            key={x}
            style={{
              position: "absolute",
              left: (x - 1) * u * 0.85 + 2.4 * u,
              top: 9.5 * u,
              width: 2 * u,
              height: (x === 13 ? 10 : 7.5) * u,
              borderRadius: u,
              background: x === 13 ? "#c42f48" : "#0e5a4a",
            }}
          />
        ))}
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
