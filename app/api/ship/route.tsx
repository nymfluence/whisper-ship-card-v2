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

async function safeFetchDataUrl(url: string) {
  try {
    const dataUrl = await fetchAsDataUrl(url);
    return { ok: true as const, url, dataUrl };
  } catch (e: any) {
    return { ok: false as const, url, dataUrl: null as string | null, error: String(e?.message ?? e) };
  }
}

async function safeFetchFont(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return { ok: false as const, url, data: null as ArrayBuffer | null, error: `Fetch failed ${res.status}` };
    }
    const data = await res.arrayBuffer();
    return { ok: true as const, url, data };
  } catch (e: any) {
    return { ok: false as const, url, data: null as ArrayBuffer | null, error: String(e?.message ?? e) };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const scoreRaw = searchParams.get("score") ?? "0";
  const score = clamp(toInt(scoreRaw, 0), 0, 100);
  const debug = searchParams.get("debug") === "1";

  // Optional avatar URLs
  const u1 = searchParams.get("u1");
  const u2 = searchParams.get("u2");

  // Public assets
  const templateUrl = new URL("/ship-base.png", req.url).toString();

  // Overlay logic:
  // - 69 => overlay-69.png
  // - 100 => overlay-100.png
  // - everything else => overlay-all.png
  const overlayPath =
    score === 69 ? "/overlay-69.png" : score === 100 ? "/overlay-100.png" : "/overlay-all.png";
  const overlayUrl = new URL(overlayPath, req.url).toString();

  // Font (your file)
  const fontUrl = new URL("/fonts/NotoSerif-Bold.ttf", req.url).toString();

  // If debug=1, return diagnostics (no image)
  if (debug) {
    const [fontTest, templateTest, overlayTest, u1Test, u2Test] = await Promise.all([
      safeFetchFont(fontUrl),
      safeFetchDataUrl(templateUrl),
      safeFetchDataUrl(overlayUrl),
      u1 ? safeFetchDataUrl(u1) : Promise.resolve({ ok: false as const, url: "", dataUrl: null, error: "u1 not provided" }),
      u2 ? safeFetchDataUrl(u2) : Promise.resolve({ ok: false as const, url: "", dataUrl: null, error: "u2 not provided" }),
    ]);

    return new Response(
      JSON.stringify(
        {
          scoreRaw,
          score,
          templateUrl,
          overlayUrl,
          fontUrl,
          fontOk: fontTest.ok,
          fontError: (fontTest as any).error ?? null,
          templateOk: templateTest.ok,
          templateError: (templateTest as any).error ?? null,
          overlayOk: overlayTest.ok,
          overlayError: (overlayTest as any).error ?? null,
          u1Provided: Boolean(u1),
          u2Provided: Boolean(u2),
          u1Ok: u1 ? u1Test.ok : null,
          u1Error: u1 ? (u1Test as any).error ?? null : null,
          u2Ok: u2 ? u2Test.ok : null,
          u2Error: u2 ? (u2Test as any).error ?? null : null,
        },
        null,
        2
      ),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  // Fetch template/overlay/avatars as data URLs (never crash if optional ones fail)
  const [templateRes, overlayRes, u1Res, u2Res, fontRes] = await Promise.all([
    safeFetchDataUrl(templateUrl),
    safeFetchDataUrl(overlayUrl),
    u1 ? safeFetchDataUrl(u1) : Promise.resolve({ ok: false as const, url: "", dataUrl: null, error: "u1 not provided" }),
    u2 ? safeFetchDataUrl(u2) : Promise.resolve({ ok: false as const, url: "", dataUrl: null, error: "u2 not provided" }),
    safeFetchFont(fontUrl),
  ]);

  // If the base template fails, we still return a black canvas with bar/text,
  // so Discord doesn’t show a broken image.
  const templateDataUrl = templateRes.ok ? templateRes.dataUrl : null;
  const overlayDataUrl = overlayRes.ok ? overlayRes.dataUrl : null;
  const u1Data = u1Res.ok ? u1Res.dataUrl : null;
  const u2Data = u2Res.ok ? u2Res.dataUrl : null;

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

  // Fonts array only if we successfully loaded the font
  const fonts = fontRes.ok
    ? [
        {
          name: "Noto Serif",
          data: fontRes.data as ArrayBuffer,
          weight: 700 as const,
          style: "normal" as const,
        },
      ]
    : [];

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
        {/* Base template (if available) */}
        {templateDataUrl ? (
          <img
            src={templateDataUrl}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ position: "absolute", left: 0, top: 0 }}
          />
        ) : null}

        {/* Avatars (if provided & loaded) */}
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
            fontFamily: fontRes.ok ? '"Noto Serif"' : "serif",
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

        {/* Overlay ON TOP of everything */}
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
      fonts,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    }
  );
}
