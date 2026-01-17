import { ImageResponse } from "next/og";

export const runtime = "edge";

// ===== CONFIG =====
const CANVAS_W = 1200;
const CANVAS_H = 675; // 16:9-ish (works nicely for Discord embeds)

const TEMPLATE_URL = "https://whisper-ship-card-v2.vercel.app/ship-base.png";

// “Thermometer” fill area (tweak if you ever move the tube)
const BAR_W = 160;
const BAR_X = Math.round((CANVAS_W - BAR_W) / 2);
const BAR_Y = 0;
const BAR_H = CANVAS_H;

// Your requested red
const FILL_COLOR = "#761c20";

// Helpers
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function parseScore(scoreRaw: string | null) {
  const n = Number(scoreRaw);
  if (!Number.isFinite(n)) return 0;
  return clamp(Math.round(n), 0, 100);
}

function makeHearts(seed: number, count: number) {
  // Simple deterministic “random” based on seed
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };

  const hearts = Array.from({ length: count }).map((_, i) => {
    const x = Math.floor(rand() * CANVAS_W);
    const y = Math.floor(rand() * CANVAS_H);
    const size = 26 + Math.floor(rand() * 26); // 26–52
    const rot = Math.floor(rand() * 40) - 20;  // -20..+20
    const opacity = 0.12 + rand() * 0.20;      // 0.12–0.32
    return { x, y, size, rot, opacity, key: i };
  });

  return hearts;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const scoreRaw = searchParams.get("score");
  const debug = searchParams.get("debug") === "1";

  const score = parseScore(scoreRaw);

  // cache-busting seed (optional)
  const tRaw = searchParams.get("t") ?? searchParams.get("nocache") ?? "0";
  const seed = Number(tRaw) || Date.now();

  // Fetch template image
  let templateFetched: "primary" | "failed" = "primary";
  let templateError: string | null = null;

  let templateArrayBuffer: ArrayBuffer | null = null;
  try {
    const r = await fetch(TEMPLATE_URL, { cache: "no-store" });
    if (!r.ok) throw new Error(`Template fetch failed ${r.status} for ${TEMPLATE_URL}`);
    templateArrayBuffer = await r.arrayBuffer();
  } catch (e: any) {
    templateFetched = "failed";
    templateError = e?.message ?? "Unknown template fetch error";
  }

  // If debug mode, return JSON (super useful when Discord says “blank”)
  if (debug) {
    return new Response(
      JSON.stringify(
        {
          scoreRaw,
          score,
          templateUrl: TEMPLATE_URL,
          templateFetched,
          templateError,
          fillColor: FILL_COLOR,
          bar: { x: BAR_X, y: BAR_Y, w: BAR_W, h: BAR_H },
        },
        null,
        2
      ),
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store, max-age=0",
        },
      }
    );
  }

  // If template failed, still render something (so the endpoint never “white screens”)
  const templateDataUrl =
    templateArrayBuffer
      ? `data:image/png;base64,${Buffer.from(templateArrayBuffer).toString("base64")}`
      : null;

  const fillH = Math.round((BAR_H * score) / 100);
  const fillTopY = BAR_Y + (BAR_H - fillH);

  const is69 = score === 69;
  const is100 = score === 100;

  const percentFontSize = is100 ? 120 : is69 ? 108 : 92;

  // Hearts overlay only for 69 and 100
  const hearts = (is69 || is100) ? makeHearts(seed, is100 ? 28 : 22) : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: "relative",
          display: "flex",
          backgroundColor: "#000",
          overflow: "hidden",
        }}
      >
        {/* Base template */}
        {templateDataUrl ? (
          <img
            src={templateDataUrl}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#111",
            }}
          />
        )}

        {/* Fill block */}
        <div
          style={{
            position: "absolute",
            left: BAR_X,
            top: fillTopY,
            width: BAR_W,
            height: fillH,
            background: FILL_COLOR,
            opacity: 0.92,
          }}
        />

        {/* Celebratory hearts overlay (procedural, no external asset needed) */}
        {(is69 || is100) &&
          hearts.map((h) => (
            <div
              key={h.key}
              style={{
                position: "absolute",
                left: h.x,
                top: h.y,
                transform: `rotate(${h.rot}deg)`,
                fontSize: h.size,
                opacity: h.opacity,
              }}
            >
              ❤️
            </div>
          ))}

        {/* Percent text */}
        <div
          style={{
            position: "absolute",
            top: 36,
            left: BAR_X,
            width: BAR_W,
            textAlign: "center",
            fontSize: percentFontSize,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: "-1px",
            textShadow: "0 4px 18px rgba(0,0,0,0.55)",
          }}
        >
          {score}%
        </div>
      </div>
    ),
    {
      width: CANVAS_W,
      height: CANVAS_H,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    }
  );
}
