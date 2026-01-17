import { ImageResponse } from "next/og";

export const runtime = "edge";

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
    headers: { "user-agent": "whisper-ship-card" },
    // small cache is fine; we also add ?t= in calls
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  const buf = await res.arrayBuffer();
  return `data:${mime};base64,${arrayBufferToBase64(buf)}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const debug = searchParams.get("debug") === "1";

  const scoreRaw = searchParams.get("score") ?? "0";
  const scoreParsed = parseInt(scoreRaw, 10);
  const score = clamp(Number.isFinite(scoreParsed) ? scoreParsed : 0, 0, 100);

  const u1 = searchParams.get("u1") ?? "";
  const u2 = searchParams.get("u2") ?? "";

  const is69 = score === 69;
  const is100 = score === 100;

  const CANVAS_W = 513;
  const CANVAS_H = 220;

  // Your measured layout (rounded to stable ints)
  const LEFT = { x: 0, y: 0, w: 221, h: 220 };
  const BAR = { x: 221, y: 0, w: 71, h: 220 };
  const RIGHT = { x: 292, y: 0, w: 221, h: 220 };

  const fillH = Math.round(BAR.h * (score / 100));
  const fillY = BAR.y + (BAR.h - fillH);

  // Prefer local template in /public
  const localTemplateUrl = new URL("/ship-base.png", req.url).toString();

  // Fallback (your GitHub raw)
  const fallbackTemplateUrl =
    "https://github.com/nymfluence/whisper-ship-card-v2/blob/main/50.png?raw=true";

  // Allow override: ?template=https://...
  const templateParam = searchParams.get("template") ?? "";
  const templateUrl = isHttpUrl(templateParam)
    ? templateParam
    : localTemplateUrl;

  // Debug info
  const debugInfo: Record<string, any> = {
    scoreRaw,
    score,
    templateUrl,
    localTemplateUrl,
    fallbackTemplateUrl,
    u1Provided: isHttpUrl(u1),
    u2Provided: isHttpUrl(u2),
  };

  let templateDataUrl: string | null = null;
  let u1DataUrl: string | null = null;
  let u2DataUrl: string | null = null;

  // Fetch template: try chosen, then fallback
  try {
    templateDataUrl = await fetchAsDataUrl(templateUrl, "image/png");
    debugInfo.templateFetched = "primary";
  } catch (e: any) {
    debugInfo.templatePrimaryError = String(e?.message ?? e);
    try {
      templateDataUrl = await fetchAsDataUrl(fallbackTemplateUrl, "image/png");
      debugInfo.templateFetched = "fallback";
    } catch (e2: any) {
      debugInfo.templateFallbackError = String(e2?.message ?? e2);
      templateDataUrl = null;
    }
  }

  // Avatars (optional)
  if (isHttpUrl(u1)) {
    try {
      u1DataUrl = await fetchAsDataUrl(u1, "image/png");
      debugInfo.u1Fetched = true;
    } catch (e: any) {
      debugInfo.u1Error = String(e?.message ?? e);
      u1DataUrl = null;
    }
  }

  if (isHttpUrl(u2)) {
    try {
      u2DataUrl = await fetchAsDataUrl(u2, "image/png");
      debugInfo.u2Fetched = true;
    } catch (e: any) {
      debugInfo.u2Error = String(e?.message ?? e);
      u2DataUrl = null;
    }
  }

  // If debug mode, return JSON so we can see exactly what failed
  if (debug) {
    return new Response(JSON.stringify(debugInfo, null, 2), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  // If template still missing, hard error (otherwise you get “broken image”)
  if (!templateDataUrl) {
    return new Response(
      "Ship render error: template image could not be fetched. Try /api/ship?debug=1",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
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
        "cache-control": "no-store",
      },
    }
  );
}
