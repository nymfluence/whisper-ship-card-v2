import { ImageResponse } from "next/og";

export const runtime = "edge";

const CANVAS_W = 512;
const CANVAS_H = 220;

// Bar coordinates (from your Canva measurements)
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

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  const contentType = res.headers.get("content-type") || "image/png";
  const buf = await res.arrayBuffer();
  const b64 = Buffer.from(buf).toString("base64");
  return `data:${contentType};base64,${b64}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const scoreRaw = searchParams.get("score") ?? "0";
  const score = clamp(toInt(scoreRaw, 0), 0, 100);

  const debug = searchParams.get("debug") === "1";

  const localTemplateUrl = new URL("/ship-base.png", req.url).toString();
  const overlay69Url = new URL("/overlay-69.png", req.url).toString();
  const overlay100Url = new URL("/overlay-100.png", req.url).toString();

  if (debug) {
    return new Response(
      JSON.stringify(
        {
          score,
          overlay:
            score === 69 ? "overlay-69.png" :
            score === 100 ? "overlay-100.png" :
            null,
        },
        null,
        2
      ),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  const templateDataUrl = await fetchAsDataUrl(localTemplateUrl);

  const overlayDataUrl =
    score === 69
      ? await fetchAsDataUrl(overlay69Url)
      : score === 100
      ? await fetchAsDataUrl(overlay100Url)
      : null;

  const fillH = Math.round((BAR_H * score) / 100);
  const fillTop = BAR_Y + (BAR_H - fillH);

  const textSize =
    score === 100 ? 48 :
    score === 69 ? 44 :
    32;

  return new ImageResponse(
    (
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: "relative",
          backgroundColor: "#000",
          display: "flex",
        }}
      >
        {/* Base template */}
        <img
          src={templateDataUrl}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ position: "absolute", inset: 0 }}
        />

        {/* Bar fill */}
        <div
          style={{
            position: "absolute",
            left: BAR_X,
            top: fillTop,
            width: BAR_W,
            height: fillH,
            background: "#6e1011",
            opacity: 0.9,
            borderRadius: 2,
          }}
        />

        {/* Percentage text (always shown) */}
        <div
          style={{
            position: "absolute",
            left: BAR_X,
            top: BAR_Y,
            width: BAR_W,
            height: BAR_H,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: textSize,
            textShadow: "0 2px 6px rgba(0,0,0,0.6)",
          }}
        >
          {score}%
        </div>

        {/* Celebratory overlay (ON TOP OF EVERYTHING) */}
        {overlayDataUrl && (
          <img
            src={overlayDataUrl}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{
              position: "absolute",
              inset: 0,
            }}
          />
        )}
      </div>
    ),
    {
      width: CANVAS_W,
      height: CANVAS_H,
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}
