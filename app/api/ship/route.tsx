import { ImageResponse } from "next/og";

export const runtime = "edge";

const CANVAS_W = 512;
const CANVAS_H = 220;

// Canva-measured bar coordinates
const BAR_X = 220.5;
const BAR_Y = 0;
const BAR_W = 71.1;
const BAR_H = 220;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

// Edge-safe base64 (NO Buffer)
function arrayBufferToBase64(buf: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  const contentType = res.headers.get("content-type") || "image/png";
  const buf = await res.arrayBuffer();
  const b64 = arrayBufferToBase64(buf);
  return `data:${contentType};base64,${b64}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const scoreRaw = searchParams.get("score") ?? "0";
  const score = clamp(toInt(scoreRaw, 0), 0, 100);

  const debug = searchParams.get("debug") === "1";

  // Optional avatar URLs
  const u1 = searchParams.get("u1");
  const u2 = searchParams.get("u2");

  // Cache buster (use query param if provided, otherwise current time)
  const v = searchParams.get("t") ?? String(Date.now());

  // Public assets (served from /public)
  // IMPORTANT: renamed base template to avoid CDN serving the old /ship-base.png
  const templateUrl = new URL(`/ship-base-v2.png?v=${encodeURIComponent(v)}`, req.url).toString();

  // Overlays:
  // - 69: overlay-69
  // - 100: overlay-100
  // - everything else: overlay-all
  const overlayPath =
    score === 69
      ? "/overlay-69.png"
      : score === 100
      ? "/overlay-100.png"
      : "/overlay-all.png";

  const overlayUrl = new URL(`${overlayPath}?v=${encodeURIComponent(v)}`, req.url).toString();

  // Debug mode returns JSON (no image)
  if (debug) {
    return new Response(
      JSON.stringify(
        {
          scoreRaw,
          score,
          templateUrl,
          overlayUrl,
          u1Provided: Boolean(u1),
          u2Provided: Boolean(u2),
        },
        null,
        2
      ),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  // Fetch images as data URLs (OG renderer behaves best this way)
  const [templateDataUrl, overlayDataUrl, u1Data, u2Data] = await Promise.all([
    fetchAsDataUrl(templateUrl),
    fetchAsDataUrl(overlayUrl).catch(() => null),
    u1 ? fetchAsDataUrl(u1).catch(() => null) : Promise.resolve(null),
    u2 ? fetchAsDataUrl(u2).catch(() => null) : Promise.resolve(null),
  ]);

  // Fill amount (from bottom up)
  const fillH = Math.round((BAR_H * score) / 100);
  const fillTop = BAR_Y + (BAR_H - fillH);

  // % text position: centered in the bar
  const percentText = `${score}%`;
  const textX = BAR_X + BAR_W / 2;
  const textY = 96;

  // Bigger for 69 & 100
  const isSpecial = score === 69 || score === 100;
  const fontSize = isSpecial ? 62 : 46;

  return new ImageResponse(
    (
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: "relative",
          display: "flex",
          backgroundColor: "#000",
        }}
      >
        {/* Base template */}
        <img
          src={templateDataUrl}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ position: "absolute", left: 0, top: 0 }}
        />

        {/* Optional avatars */}
        {u1Data ? (
          <img
            src={u1Data}
            width={220}
            height={220}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              objectFit: "cover",
            }}
          />
        ) : null}

        {u2Data ? (
          <img
            src={u2Data}
            width={220}
            height={220}
            style={{
              position: "absolute",
              left: 292,
              top: 0,
              objectFit: "cover",
            }}
          />
        ) : null}

        {/* Bar fill overlay */}
        <div
          style={{
            position: "absolute",
            left: BAR_X,
            top: fillTop,
            width: BAR_W,
            height: fillH,
            background: "linear-gradient(180deg, #C59474 0%, #C59474 100%)",
            opacity: 0.9,
            borderRadius: 2,
          }}
        />

        {/* % text */}
        <div
          style={{
            position: "absolute",
            left: textX,
            top: textY,
            transform: "translateX(-50%)",
            fontSize,
            fontWeight: 900,
            fontFamily: "serif",
            color: "#FFFFFF",
            letterSpacing: "-1px",
            textShadow: "0px 3px 10px rgba(0,0,0,0.65)",
            lineHeight: 1,
          }}
        >
          {percentText}
        </div>

        {/* Overlay ON TOP */}
        {overlayDataUrl ? (
          <img
            src={overlayDataUrl}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ position: "absolute", left: 0, top: 0 }}
          />
        ) : null}
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
