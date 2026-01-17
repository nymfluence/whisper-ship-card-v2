import { ImageResponse } from "next/og";

export const runtime = "edge";

const CANVAS_W = 512;
const CANVAS_H = 220;

// Your Canva-measured bar coordinates
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

  // Optional avatar URLs (later we’ll wire these into your !ship command)
  const u1 = searchParams.get("u1");
  const u2 = searchParams.get("u2");

  // Prefer local public asset
  const localTemplateUrl = new URL("/ship-base.png", req.url).toString();

  // Fallback to your GitHub raw image (still fine to keep)
  const fallbackTemplateUrl =
    "https://github.com/nymfluence/whisper-ship-card-v2/blob/main/50.png?raw=true";

  let templateUrl = localTemplateUrl;
  let templateFetched: "primary" | "fallback" = "primary";
  let templatePrimaryError: string | undefined;

  try {
    // Just a quick check that the local template is fetchable
    const test = await fetch(templateUrl, { cache: "no-store" });
    if (!test.ok) throw new Error(`Fetch failed ${test.status} for ${templateUrl}`);
  } catch (e: any) {
    templatePrimaryError = String(e?.message ?? e);
    templateUrl = fallbackTemplateUrl;
    templateFetched = "fallback";
  }

  // If debug=1, return JSON so you can see what it’s doing
  if (debug) {
    return new Response(
      JSON.stringify(
        {
          scoreRaw,
          score,
          templateUrl,
          localTemplateUrl,
          fallbackTemplateUrl,
          u1Provided: Boolean(u1),
          u2Provided: Boolean(u2),
          templatePrimaryError,
          templateFetched,
        },
        null,
        2
      ),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  // Build image assets as data URLs (OG renderer is happiest with data URLs)
  const [templateDataUrl, u1Data, u2Data] = await Promise.all([
    fetchAsDataUrl(templateUrl),
    u1 ? fetchAsDataUrl(u1).catch(() => null) : Promise.resolve(null),
    u2 ? fetchAsDataUrl(u2).catch(() => null) : Promise.resolve(null),
  ]);

  // Fill amount (from bottom up)
  const fillH = Math.round((BAR_H * score) / 100);
  const fillTop = BAR_Y + (BAR_H - fillH);

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

        {/* Bar fill overlay (tweak colours any time) */}
        <div
          style={{
            position: "absolute",
            left: BAR_X,
            top: fillTop,
            width: BAR_W,
            height: fillH,
            background: "linear-gradient(180deg, #4a2125 0%, #410200 100%)",
            opacity: 0.9,
            borderRadius: 2,
          }}
        />

        {/* Optional avatars if provided */}
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
