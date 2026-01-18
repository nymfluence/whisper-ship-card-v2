import { ImageResponse } from "next/og";

export const runtime = "edge";

const CANVAS_W = 512;
const CANVAS_H = 220;

// Bar coordinates
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

async function fetchAsDataUrl(url: string, cacheMode: RequestCache = "force-cache"): Promise<string> {
  const res = await fetch(url, { cache: cacheMode });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  const contentType = res.headers.get("content-type") || "image/png";
  const buf = await res.arrayBuffer();
  const b64 = arrayBufferToBase64(buf);
  return `data:${contentType};base64,${b64}`;
}

async function fetchAsArrayBuffer(url: string, cacheMode: RequestCache = "force-cache"): Promise<ArrayBuffer> {
  const res = await fetch(url, { cache: cacheMode });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return await res.arrayBuffer();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const scoreRaw = searchParams.get("score") ?? "0";
  const score = clamp(toInt(scoreRaw, 0), 0, 100);

  const debug = searchParams.get("debug") === "1";

  // Optional avatars (Discord CDN URLs)
  const u1 = searchParams.get("u1");
  const u2 = searchParams.get("u2");

  // Public assets
  const templateUrl = new URL("/ship-base.png", req.url).toString();

  // Overlays:
  // - 69 => overlay-69.png
  // - 100 => overlay-100.png
  // - everything else => overlay-all.png
  const overlayPath =
    score === 69 ? "/overlay-69.png" :
    score === 100 ? "/overlay-100.png" :
    "/overlay-all.png";

  const overlayUrl = new URL(overlayPath, req.url).toString();

  // Font
  const fontUrl = new URL("/fonts/NotoSerif-Bold.ttf", req.url).toString();

  // Debug mode: do simple fetch checks (so you can confirm 200s)
  if (debug) {
    const check = async (url: string) => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        return { ok: r.ok, status: r.status };
      } catch (e: any) {
        return { ok: false, status: -1, error: String(e?.message ?? e) };
      }
    };

    const checks = {
      template: await check(templateUrl),
      overlay: await check(overlayUrl),
      font: await check(fontUrl),
      u1: u1 ? await check(u1) : null,
      u2: u2 ? await check(u2) : null,
    };

    return new Response(
      JSON.stringify(
        {
          scoreRaw,
          score,
          templateUrl,
          overlayUrl,
          fontUrl,
          u1Provided: Boolean(u1),
          u2Provided: Boolean(u2),
          checks,
        },
        null,
        2
      ),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  try {
    // Fetch assets as data URLs (images) + font as ArrayBuffer (required by next/og)
    const [templateDataUrl, overlayDataUrl, u1Data, u2Data, notoSerifBold] =
      await Promise.all([
        fetchAsDataUrl(templateUrl, "force-cache"),
        fetchAsDataUrl(overlayUrl, "force-cache").catch(() => null),
        u1 ? fetchAsDataUrl(u1, "no-store").catch(() => null) : Promise.resolve(null),
        u2 ? fetchAsDataUrl(u2, "no-store").catch(() => null) : Promise.resolve(null),
        fetchAsArrayBuffer(fontUrl, "force-cache"),
      ]);

    // Fill amount (from bottom up)
    const fillH = Math.round((BAR_H * score) / 100);
    const fillTop = BAR_Y + (BAR_H - fillH);

    // % text position
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
            fontFamily: "NotoSerif",
          }}
        >
          {/* Base template */}
          <img
            src={templateDataUrl}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ position: "absolute", left: 0, top: 0 }}
          />

          {/* Avatars */}
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

          {/* Bar fill */}
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
              fontWeight: 700,
              color: "#FFFFFF",
              letterSpacing: "-1px",
              textShadow: "0px 3px 10px rgba(0,0,0,0.65)",
              lineHeight: 1,
            }}
          >
            {percentText}
          </div>

          {/* Overlay on top of everything */}
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
        // IMPORTANT: this is how next/og actually uses your font file
        fonts: [
          {
            name: "NotoSerif",
            data: notoSerifBold,
            weight: 700,
            style: "normal",
          },
        ],
        headers: {
          // keep this no-store so Discord/YAG always pulls the newest render for that URL
          "cache-control": "no-store, max-age=0",
        },
      }
    );
  } catch (err: any) {
    // If anything throws, return useful JSON instead of a white screen
    return new Response(
      JSON.stringify(
        {
          ok: false,
          error: String(err?.message ?? err),
          hint:
            "If this happens in Safari, open /api/ship?score=69&debug=1 to confirm template/overlay/font are 200.",
        },
        null,
        2
      ),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
}
