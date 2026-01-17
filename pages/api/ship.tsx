import { ImageResponse } from "next/og";

export const config = { runtime: "edge" };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isHttpUrl(s: string) {
  return s.startsWith("http://") || s.startsWith("https://");
}

// Edge-safe base64 (no Buffer)
function arrayBufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function fetchAsDataUrl(url: string, mime: string) {
  const res = await fetch(url, {
    // Some hosts behave better with a UA
    headers: { "user-agent": "whisper-ship-card" },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  return `data:${mime};base64,${arrayBufferToBase64(buf)}`;
}

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);

  const scoreRaw = searchParams.get("score") ?? "0";
  const score = clamp(parseInt(scoreRaw, 10) || 0, 0, 100);

  const u1 = searchParams.get("u1") ?? "";
  const u2 = searchParams.get("u2") ?? "";

  const is69 = score === 69;
  const is100 = score === 100;

  // Canvas
  const CANVAS_W = 513;
  const CANVAS_H = 220;

  // Your measured layout (rounded to stable ints)
  const LEFT = { x: 0, y: 0, w: 221, h: 220 };
  const BAR = { x: 221, y: 0, w: 71, h: 220 };
  const RIGHT = { x: 292, y: 0, w: 221, h: 220 };

  // Fill (bottom up)
  const fillH = Math.round(BAR.h * (score / 100));
  const fillY = BAR.y + (BAR.h - fillH);

  // Default template = your GitHub raw image
  const defaultTemplate =
    "https://github.com/nymfluence/whisper-ship-card-v2/blob/main/50.png?raw=true";

  // Allow template override if desired
  const templateParam = searchParams.get("template") ?? "";
  const templateUrl = isHttpUrl(templateParam) ? templateParam : defaultTemplate;

  // Prefetch images as Data URLs
  let templateDataUrl: string | null = null;
  let u1DataUrl: string | null = null;
  let u2DataUrl: string | null = null;

  try {
    templateDataUrl = await fetchAsDataUrl(templateUrl, "image/png");
  } catch {
    templateDataUrl = null;
  }

  try {
    if (isHttpUrl(u1)) u1DataUrl = await fetchAsDataUrl(u1, "image/png");
  } catch {
    u1DataUrl = null;
  }

  try {
    if (isHttpUrl(u2)) u2DataUrl = await fetchAsDataUrl(u2, "image/png");
  } catch {
    u2DataUrl = null;
  }

  const fillColor = is100
    ? "rgba(255,255,255,0.95)"
    : is69
      ? "rgba(181,126,90,0.98)"
      : "rgba(181,126,90,0.90)";

  return new ImageResponse(
    (
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: "relative",
          background: "#000",
          overflow: "hidden",
          fontFamily: "Arial",
        }}
      >
        {/* Background template */}
        {templateDataUrl ? (
          <img
            src={templateDataUrl}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: CANVAS_W,
              height: CANVAS_H,
              objectFit: "cover",
            }}
          />
        ) : null}

        {/* Left avatar */}
        <div
          style={{
            position: "absolute",
            left: LEFT.x,
            top: LEFT.y,
            width: LEFT.w,
            height: LEFT.h,
            overflow: "hidden",
          }}
        >
          {u1DataUrl ? (
            <img
              src={u1DataUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
        </div>

        {/* Right avatar (flip for 69) */}
        <div
          style={{
            position: "absolute",
            left: RIGHT.x,
            top: RIGHT.y,
            width: RIGHT.w,
            height: RIGHT.h,
            overflow: "hidden",
          }}
        >
          {u2DataUrl ? (
            <img
              src={u2DataUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: is69 ? "rotate(180deg)" : "none",
              }}
            />
          ) : null}
        </div>

        {/* Bar fill overlay */}
        <div
          style={{
            position: "absolute",
            left: BAR.x,
            top: fillY,
            width: BAR.w,
            height: fillH,
            background: fillColor,
          }}
        />

        {/* Score text */}
        <div
          style={{
            position: "absolute",
            left: BAR.x,
            top: BAR.y + BAR.h - 58,
            width: BAR.w,
            textAlign: "center",
            fontSize: 28,
            fontWeight: 900,
            color: "white",
            textShadow: "0 2px 4px rgba(0,0,0,0.7)",
          }}
        >
          {score}%
        </div>

        {/* 100 overlay hearts */}
        {is100 ? (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <div style={{ position: "absolute", left: 18, top: 14, fontSize: 28, color: "rgba(255,105,180,0.85)" }}>♥</div>
            <div style={{ position: "absolute", left: 126, top: 44, fontSize: 28, color: "rgba(255,105,180,0.75)" }}>♥</div>
            <div style={{ position: "absolute", left: 372, top: 22, fontSize: 28, color: "rgba(255,105,180,0.80)" }}>♥</div>
            <div style={{ position: "absolute", left: 452, top: 118, fontSize: 28, color: "rgba(255,105,180,0.80)" }}>♥</div>
            <div style={{ position: "absolute", left: 88, top: 152, fontSize: 28, color: "rgba(255,105,180,0.70)" }}>♥</div>
          </div>
        ) : null}
      </div>
    ),
    {
      width: CANVAS_W,
      height: CANVAS_H,
      headers: {
        "cache-control": "public, max-age=0, must-revalidate",
      },
    }
  );
}
