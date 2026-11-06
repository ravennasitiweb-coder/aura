"use client";

import { useRef, useState, useTransition } from "react";
import { addTables, aiArrange, deleteTable, saveFloorPlan, updateTable, type SalaResult } from "@/app/app/sala-actions";
import { autoArrange, checkLayout, estimateCovers, suggestTables, tableSize } from "@/lib/sala";

export type Table = { id: string; name: string; seats: number; active: boolean; plan: { x: number; y: number; shape?: "round" | "square" } | null };
type Plan = { widthCm: number; depthCm: number; photo: string | null };
type Pos = { x: number; y: number; shape: "round" | "square" };

const INPUT = "w-full rounded-lg border border-line bg-white px-3 py-2 outline-none focus:border-bottle";
const BUTTON = "rounded-full bg-bottle px-5 py-2.5 font-semibold text-white hover:bg-bottle-dark disabled:opacity-60";

const sizeFor = tableSize;

/** Posizioni di partenza: i tavoli senza posto vengono messi in griglia */
function initialPositions(tables: Table[], plan: Plan): Record<string, Pos> {
  const cols = Math.max(1, Math.floor(plan.widthCm / 220));
  return Object.fromEntries(
    tables.map((t, i) => [
      t.id,
      t.plan
        ? { x: t.plan.x, y: t.plan.y, shape: t.plan.shape ?? "round" }
        : { x: Math.min(130 + (i % cols) * 220, plan.widthCm - 60), y: Math.min(130 + Math.floor(i / cols) * 220, plan.depthCm - 60), shape: "round" },
    ]),
  );
}

/** Riduce la foto nel browser (max 1280 px, JPEG) così pesa poche centinaia di KB */
async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let side = 1280;
  for (let quality = 0.75; ; quality -= 0.15, side -= 200) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= 650_000 || quality < 0.3) return url;
  }
}

export function SalaEditor({ tables, plan, canEdit, aiEnabled }: { tables: Table[]; plan: Plan; canEdit: boolean; aiEnabled: boolean }) {
  const [widthM, setWidthM] = useState(plan.widthCm / 100);
  const [depthM, setDepthM] = useState(plan.depthCm / 100);
  const [photo, setPhoto] = useState(plan.photo);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [aiRequest, setAiRequest] = useState("");
  const [aiNote, setAiNote] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<string | null>(null);

  const widthCm = Math.round(widthM * 100);
  const depthCm = Math.round(depthM * 100);
  // I tavoli appena aggiunti non hanno ancora una posizione: si mettono in griglia
  const allPos = { ...initialPositions(tables, plan), ...positions };
  const table = tables.find((t) => t.id === selected) ?? null;

  function run(action: () => Promise<SalaResult>) {
    setMessage(null);
    start(async () => {
      const r = await action();
      setMessage(r.ok ? { ok: true, text: r.message ?? "Salvato." } : { ok: false, text: r.error });
    });
  }

  function pointToCm(e: React.PointerEvent) {
    const svg = svgRef.current!;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.min(Math.max(p.x, 0), widthCm), y: Math.min(Math.max(p.y, 0), depthCm) };
  }

  function onMove(e: React.PointerEvent) {
    const id = dragging.current;
    if (!id) return;
    const { x, y } = pointToCm(e);
    setPositions((p) => ({ ...p, [id]: { ...allPos[id], x, y } }));
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-display text-lg font-bold">Aggiungi tavoli</h2>
          <p className="mt-1 text-sm text-ink-soft">Il modo veloce: quanti tavoli e quanti posti ciascuno. Ripeti per ogni misura (es. 6 da 2, 8 da 4, 2 da 8).</p>
          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            action={(fd) => run(() => addTables(Number(fd.get("count")), Number(fd.get("seats"))))}
          >
            <label className="w-28 text-sm font-semibold">
              Quanti tavoli
              <input name="count" type="number" min={1} max={60} defaultValue={4} required className={`${INPUT} mt-1`} />
            </label>
            <label className="w-28 text-sm font-semibold">
              Posti ciascuno
              <input name="seats" type="number" min={1} max={40} defaultValue={4} required className={`${INPUT} mt-1`} />
            </label>
            <button type="submit" disabled={pending} className={BUTTON}>Aggiungi</button>
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-lg font-bold">Pianta della sala</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Imposta le misure della sala, carica se vuoi una foto o una piantina come sfondo e trascina i tavoli dove sono davvero.
        </p>
        {canEdit && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="w-32 text-sm font-semibold">
              Larghezza (m)
              <input type="number" min={2} max={100} step={0.5} value={widthM} onChange={(e) => setWidthM(Number(e.target.value) || 2)} className={`${INPUT} mt-1`} />
            </label>
            <label className="w-32 text-sm font-semibold">
              Profondità (m)
              <input type="number" min={2} max={100} step={0.5} value={depthM} onChange={(e) => setDepthM(Number(e.target.value) || 2)} className={`${INPUT} mt-1`} />
            </label>
            <label className="cursor-pointer rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:border-ink">
              {photo ? "Cambia foto" : "Carica foto della sala"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setPhoto(await shrinkPhoto(file));
                  setPhotoChanged(true);
                }}
              />
            </label>
            {photo && (
              <button type="button" onClick={() => { setPhoto(null); setPhotoChanged(true); }} className="text-sm text-ink-soft underline">
                Togli foto
              </button>
            )}
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${widthCm} ${depthCm}`}
          className="mt-4 w-full touch-none select-none rounded-xl border border-line bg-paper"
          onPointerMove={onMove}
          onPointerUp={() => (dragging.current = null)}
          onPointerLeave={() => (dragging.current = null)}
          role="img"
          aria-label={`Pianta della sala, ${widthM} per ${depthM} metri, ${tables.length} tavoli`}
        >
          {photo && <image href={photo} x={0} y={0} width={widthCm} height={depthCm} preserveAspectRatio="none" opacity={0.55} />}
          {tables.map((t) => {
            const p = allPos[t.id];
            if (!p) return null;
            const s = sizeFor(t.seats);
            const isSel = t.id === selected;
            const fill = !t.active ? "#d6d3cc" : isSel ? "#0e5a4a" : "#ffffff";
            const ink = isSel ? "#ffffff" : "#1c1c1a";
            return (
              <g
                key={t.id}
                transform={`translate(${p.x} ${p.y})`}
                className={canEdit ? "cursor-grab" : undefined}
                onPointerDown={(e) => {
                  setSelected(t.id);
                  if (!canEdit) return;
                  dragging.current = t.id;
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                }}
              >
                {p.shape === "square" ? (
                  <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={12} fill={fill} stroke="#0e5a4a" strokeWidth={6} />
                ) : (
                  <circle r={s / 2} fill={fill} stroke="#0e5a4a" strokeWidth={6} />
                )}
                <text textAnchor="middle" y={-4} fontSize={Math.max(26, s / 5)} fontWeight={700} fill={ink}>{t.name.replace(/^Tavolo\s*/i, "")}</text>
                <text textAnchor="middle" y={Math.max(26, s / 5)} fontSize={Math.max(20, s / 7)} fill={ink}>{t.seats} posti</text>
              </g>
            );
          })}
        </svg>

        {canEdit && (
          <button
            type="button"
            disabled={pending}
            className={`${BUTTON} mt-4`}
            onClick={() =>
              run(() =>
                saveFloorPlan({
                  widthCm,
                  depthCm,
                  photo: photoChanged ? photo : undefined,
                  positions: Object.entries(allPos).map(([id, p]) => ({ id, ...p })),
                }),
              )
            }
          >
            Salva la pianta
          </button>
        )}
      </section>

      {canEdit && (
        <Assistant
          tables={tables}
          widthCm={widthCm}
          depthCm={depthCm}
          positions={allPos}
          pending={pending}
          aiEnabled={aiEnabled}
          aiRequest={aiRequest}
          setAiRequest={setAiRequest}
          aiNote={aiNote}
          onArrange={() => {
            const { placed, left } = autoArrange(tables.filter((t) => t.active), widthCm, depthCm);
            setPositions((p) => ({ ...p, ...Object.fromEntries(placed.map((t) => [t.id, { x: t.x, y: t.y, shape: allPos[t.id]?.shape ?? "round" }])) }));
            setAiNote(left.length ? `${left.length} tavoli non entrano nella sala: aumenta le misure o eliminane qualcuno.` : "Tavoli sistemati in file ordinate. Controlla e premi “Salva la pianta”.");
          }}
          onAddSuggested={(list) =>
            run(async () => {
              for (const t of list) {
                const r = await addTables(t.count, t.seats);
                if (!r.ok) return r;
              }
              return { ok: true, message: "Tavoli consigliati aggiunti. Ora premi “Sistema automaticamente”." };
            })
          }
          onAi={() => {
            setMessage(null);
            setAiNote(null);
            start(async () => {
              const r = await aiArrange(aiRequest, widthCm, depthCm);
              if (!r.ok) return setMessage({ ok: false, text: r.error });
              setPositions((p) => ({ ...p, ...Object.fromEntries(r.positions.map((t) => [t.id, { x: t.x, y: t.y, shape: t.shape }])) }));
              setAiNote(`${r.note} Controlla la pianta e premi “Salva la pianta”.`.trim());
            });
          }}
        />
      )}

      {message && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm ${message.ok ? "bg-mint text-bottle-dark" : "border border-cherry/30 bg-cherry/5 text-cherry"}`}>
          {message.text}
        </p>
      )}

      {table && canEdit && (
        <TableForm
          key={table.id}
          table={table}
          shape={allPos[table.id]?.shape ?? "round"}
          onShape={(shape) => setPositions((p) => ({ ...p, [table.id]: { ...allPos[table.id], shape } }))}
          onDone={(r) => run(() => r)}
          onDelete={() => { setSelected(null); run(() => deleteTable(table.id)); }}
          pending={pending}
        />
      )}

      {tables.length === 0 && <p className="text-ink-soft">Nessun tavolo ancora: aggiungili qui sopra.</p>}
    </div>
  );
}

function TableForm(props: {
  table: Table;
  shape: "round" | "square";
  onShape: (s: "round" | "square") => void;
  onDone: (r: Promise<SalaResult>) => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const { table, shape, onShape, onDone, onDelete, pending } = props;
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-lg font-bold">{table.name}</h2>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        action={(fd) => onDone(updateTable(table.id, String(fd.get("name")), Number(fd.get("seats")), fd.get("active") !== null))}
      >
        <label className="w-40 text-sm font-semibold">
          Nome
          <input name="name" defaultValue={table.name} maxLength={60} required className={`${INPUT} mt-1`} />
        </label>
        <label className="w-24 text-sm font-semibold">
          Posti
          <input name="seats" type="number" min={1} max={40} defaultValue={table.seats} required className={`${INPUT} mt-1`} />
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="active" defaultChecked={table.active} className="h-4 w-4 accent-bottle" /> Prenotabile
        </label>
        <button type="submit" disabled={pending} className={BUTTON}>Salva tavolo</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <span className="text-ink-soft">Forma:</span>
        {(["round", "square"] as const).map((s) => (
          <button key={s} type="button" aria-pressed={shape === s} onClick={() => onShape(s)} className={`rounded-full border px-3 py-1 ${shape === s ? "border-bottle bg-mint" : "border-line"}`}>
            {s === "round" ? "Rotondo" : "Quadrato"}
          </button>
        ))}
        <span className="text-ink-soft">(ricorda “Salva la pianta”)</span>
        <button type="button" onClick={onDelete} className="ml-auto text-cherry underline">Elimina tavolo</button>
      </div>
    </section>
  );
}

function Assistant(props: {
  tables: Table[];
  widthCm: number;
  depthCm: number;
  positions: Record<string, Pos>;
  pending: boolean;
  aiEnabled: boolean;
  aiRequest: string;
  setAiRequest: (v: string) => void;
  aiNote: string | null;
  onArrange: () => void;
  onAddSuggested: (list: { count: number; seats: number }[]) => void;
  onAi: () => void;
}) {
  const { tables, widthCm, depthCm, positions, pending, aiEnabled, aiRequest, setAiRequest, aiNote } = props;
  const active = tables.filter((t) => t.active);
  const seats = active.reduce((n, t) => n + t.seats, 0);
  const covers = estimateCovers(widthCm, depthCm);
  const suggested = suggestTables(widthCm, depthCm, seats);
  const names = Object.fromEntries(tables.map((t) => [t.id, t.name]));
  const problems = checkLayout(
    active.filter((t) => positions[t.id]).map((t) => ({ id: t.id, seats: t.seats, ...positions[t.id] })),
    widthCm,
    depthCm,
    names,
  );

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="font-display text-lg font-bold">Assistente sala</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Una sala di {widthCm / 100} × {depthCm / 100} m ospita comodamente circa <strong>{covers} coperti</strong>. Ora ne hai {seats}.
      </p>
      {suggested.length > 0 && (
        <p className="mt-2 text-sm">
          Consiglio: aggiungi {suggested.map((t) => `${t.count} tavoli da ${t.seats}`).join(", ")}.{" "}
          <button type="button" disabled={pending} onClick={() => props.onAddSuggested(suggested)} className="font-semibold text-bottle underline">
            Aggiungili
          </button>
        </p>
      )}
      <button type="button" disabled={pending || active.length === 0} onClick={props.onArrange} className="mt-4 rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:border-ink">
        Sistema automaticamente
      </button>

      {aiEnabled && (
        <div className="mt-5">
          <label htmlFor="ai-request" className="text-sm font-semibold">Oppure descrivi la sala con parole tue</label>
          <textarea
            id="ai-request"
            rows={3}
            maxLength={600}
            value={aiRequest}
            onChange={(e) => setAiRequest(e.target.value)}
            placeholder="Es. i tavoli da 2 lungo le finestre a sinistra, quelli da 6 in fondo, lascia libero il passaggio verso la cucina in alto a destra"
            className={`${INPUT} mt-1`}
          />
          <button type="button" disabled={pending || aiRequest.trim().length < 5} onClick={props.onAi} className={`${BUTTON} mt-2`}>
            {pending ? "Ci penso…" : "Chiedi all'assistente"}
          </button>
        </div>
      )}

      {aiNote && <p role="status" className="mt-4 rounded-xl bg-mint px-4 py-3 text-sm text-bottle-dark">{aiNote}</p>}
      {problems.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-xl border border-cherry/30 bg-cherry/5 px-4 py-3 text-sm text-cherry">
          {problems.slice(0, 8).map((p) => <li key={p}>{p}</li>)}
          {problems.length > 8 && <li>…e altri {problems.length - 8}.</li>}
        </ul>
      )}
    </section>
  );
}
