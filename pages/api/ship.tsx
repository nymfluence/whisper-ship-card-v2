import { ImageResponse } from "next/og";

export const config = { runtime: "edge" };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isHttpUrl(s: string) {
  return s.startsWith("http://") || s.startsWith("https://");
}

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);

  // Inputs
  const u1 = searchParams.get("u1") ?? "";
  const u2 = searchParams.get("u2") ?? "";
  const scoreRaw = searchParams.get("score") ?? "0";

  // Optional: allow overriding the template via query param later if you want
  const template =
    searchParams.get("template") ??
    "https://i.ibb.co/fdtQt69w/50.png";

  const score = clamp(parseInt(scoreRaw, 10) || 0, 0, 100);

  const is69 = score === 69;
  const is100 = score === 100;

  // Canvas (keep stable ints for @vercel/og)
  const CANVAS_W = 513;
  const CANVAS_H = 220;

  // Your Canva measurements rounded to stable integers
  // (Fractional px can cause rendering failures on some setups.)
  const LEFT = { x: 0, y: 0, w: 221, h: 220 };
  const BAR = { x: 221, y: 0, w: 71, h: 220 };
  const RIGHT = { x: 292, y: 0, w: 221, h: 220 };

  // Fill maths (bottom-up)
  const fillH = Math.round(BAR.h * (score / 100));
  const fillY = BAR.y + (BAR.h - fillH);

  // Validate URLs (avoid breaking the render)
  const safeU1 = isHttpUrl(u1) ? u1 : "";
  const safeU2 = isHttpUrl(u2) ? u2 : "";
  const safeTemplate = isHttpUrl(template) ? template : "";

  // Fill color logic (tweak later to match WHISPER palette exactly)
  const fillColor = is100
    ? "rgba(255,255,255,0.95)"
    : is69
      ? "rgba(181,126,90,0.98)"
      : "rgba(181,126,90,0.90)";

  // Cache control: helps Discord not cache forever if you add &t=timestamp
  const headers = {
    "content-type": "image/png",
    "cache-control": "public, max-age=0, must-revalidate"
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: "relative",
          background: "#000",
          overflow: "hidden",
          fontFamily: "Arial"
        }}
      >
        {/* Background template image */}
        {safeTemplate ? (
          <img
            src={safeTemplate}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: CANVAS_W,
              height: CANVAS_H,
              objectFit: "cover"
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
            overflow: "hidden"
          }}
        >
          {safeU1 ? (
            <img
              src={safeU1}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover"
              }}
            />
          ) : null}
        </div>

        {/* Right avatar (flipped for 69) */}
        <div
          style={{
            position: "absolute",
            left: RIGHT.x,
            top: RIGHT.y,
            width: RIGHT.w,
            height: RIGHT.h,
            overflow: "hidden"
          }}
        >
          {safeU2 ? (
            <img
              src={safeU2}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: is69 ? "rotate(180deg)" : "none"
              }}
            />
          ) : null}
        </div>

        {/* Bar fill overlay (drawn on top of background bar track) */}
        <div
          style={{
            position: "absolute",
            left: BAR.x,
            top: fillY,
            width: BAR.w,
            height: fillH,
            background: fillColor
          }}
        />

        {/* Score text (position tuned to sit near bottom of bar) */}
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
            textShadow: "0 2px 4px rgba(0,0,0,0.7)"
          }}
        >
          {score}%
        </div>

        {/* 100 overlay */}
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
    { width: CANVAS_W, height: CANVAS_H, headers }
  );
}
