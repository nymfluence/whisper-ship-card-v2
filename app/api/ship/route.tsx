/* app/api/ship/route.tsx */
import { ImageResponse } from "next/og";

export const runtime = "edge";

const CANVAS_W = 1200;
const CANVAS_H = 675;

// Bar position (defaults: centered)
const BAR_W = 150;
const BAR_H = 520;
const BAR_X = Math.round((CANVAS_W - BAR_W) / 2);
const BAR_Y = 95;

// Fill color
const FILL_COLOR = "#761c20";

/**
 * Convert ArrayBuffer -> base64 (Edge-safe)
 */
function arrayBufferToBase64(buf: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  // btoa exists on Edge runtime
  return btoa(binary);
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);

  const scoreRaw = searchParams.get("score") ?? "0";
  let score = Number.parseFloat(scoreRaw);
  if (Number.isNaN(score)) score = 0;
  score = Math.max(0, Math.min(100, score));

  const debug = searchParams.get("debug") === "1";
  const nocache = searchParams.has("nocache") || searchParams.has("t");

  // Optional overrides (so you can tweak placement without redeploy)
  const barX = Number(searchParams.get("barX") ?? BAR_X);
  const barY = Number(searchParams.get("barY") ?? BAR_Y);
  const barW = Number(searchParams.get("barW") ?? BAR_W);
  const barH = Number(searchParams.get("barH") ?? BAR_H);

  const templateUrl = `${origin}/ship-base.png`;

  // Fetch template
  let templateFetched: "primary" | "failed" = "primary";
  let templateError = "";
  let templateDataUrl = "";

  try {
    const res = await fetch(templateUrl, {
      // avoid cached 404s and stale template
      cache: nocache ? "no-store" : "force-cache",
    });

    if (!res.ok) {
      templateFetched = "failed";
      templateError = `Fetch failed ${res.status} for ${templateUrl}`;
    } else {
      const buf = await res.arrayBuffer();
      const base64 = arrayBufferToBase64(buf);

      // try to infer content type; default png
      const ct = res.headers.get("content-type") || "image/png";
      templateDataUrl = `data:${ct};base64,${base64}`;
    }
  } catch (e: any) {
    templateFetched = "failed";
    templateError = e?.message ? String(e.message) : "Unknown fetch error";
  }

  // Debug JSON (handy for troubleshooting)
  if (debug) {
    return Response.json({
      scoreRaw,
      score,
      templateUrl,
      templateFetched,
      templateError: templateError || undefined,
      bar: { barX, barY, barW, barH },
      fill: { color: FILL_COLOR },
      hint:
        "If the bar isn't aligned, pass barX/barY/barW/barH in the URL until perfect.",
    });
  }

  // If template failed, show a readable error image instead of blank
  if (!templateDataUrl) {
    return new ImageResponse(
      (
        <div
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: 60,
            background: "#000",
            color: "#fff",
            fontSize: 32,
          }}
        >
          <div style={{ fontSize: 44, fontWeight: 800, marginBottom: 16 }}>
            Template failed to load
          </div>
          <div style={{ opacity: 0.9, marginBottom: 10 }}>{templateUrl}</div>
          <div style={{ opacity: 0.8 }}>{templateError}</div>
        </div>
      ),
      { width: CANVAS_W, height: CANVAS_H }
    );
  }

  // Fill height based on score
  const fillHeight = Math.round((barH * score) / 100);

  return new ImageResponse(
    (
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: "relative",
          display: "flex",
        }}
      >
        {/* Background template */}
        <img
          src={templateDataUrl}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{
            position: "absolute",
            inset: 0,
            width: CANVAS_W,
            height: CANVAS_H,
            objectFit: "cover",
          }}
        />

        {/* Fill overlay (clipped to bar area) */}
        <div
          style={{
            position: "absolute",
            left: barX,
            top: barY,
            width: barW,
            height: barH,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: fillHeight,
              background: FILL_COLOR,
              opacity: 0.92,
            }}
          />
        </div>
      </div>
    ),
    {
      width: CANVAS_W,
      height: CANVAS_H,
      headers: {
        "content-type": "image/png",
        // Make sure Discord / browsers don’t cache old scores
        "cache-control": "no-store, max-age=0",
      },
    }
  );
}
