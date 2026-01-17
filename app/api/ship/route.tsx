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
  // @ts-ignore Buffer exists in Vercel Edge for next/og usage
  const b64 = Buffer.from(buf).toString("base64");
  return `data:${contentType};base64,${b64}`;
}

// Deterministic “random-ish” positions (so it doesn't change every refresh)
function pseudoRand(seed: number) {
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function HeartsOverlay({ score }: { score: number }) {
  if (!(score === 69 || score === 100)) return null;

  // More hearts at 100 than 69
  const count = score === 100 ? 18 : 12;

  const hearts = Array.from({ length: count }).map((_, i) => {
    const r1 = pseudoRand(score * 1000 + i * 17);
    const r2 = pseudoRand(score * 2000 + i * 31);
    const r3 = pseudoRand(score * 3000 + i * 43);

    const left = Math.round(r1 * (CANVAS_W - 30));
    const top = Math.round(r2 * (CANVAS_H - 30));
    const size = Math.round(16 + r3 * 18); // 16–34px
    const rot = Math.round((r1 - 0.5) * 50); // -25..+25deg
    const opacity = 0.35 + r2 * 0.45; // 0.35..0.8

    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left,
          top,
          fontSize: size,
          opacity,
          transform: `rotate(${rot}deg)`,
          // helps it pop
          textShadow: "0 2px 6px rgba(0,0,0,0.45)",
        }}
      >
        ❤️
      </div>
    );
  });

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: CANVAS_W, height: CANVAS_H }}>
      {hearts}
    </div>
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const scoreRaw = searchParams.get("score") ?? "0";
  const score = clamp(toInt(scoreRaw, 0), 0, 100);

  const debug = searchParams.get("debug") === "1";

  const u1 = searchParams.get("u1");
  const u2 = searchParams.get("u2");

  const localTemplateUrl = new URL("/ship-base.png", req.url).toString();

  const fallbackTemplateUrl =
    "https://github.com/nymfluence/whisper-ship-card-v2/blob/main/50.png?raw=true";

  let templateUrl = localTemplateUrl;
  let templateFetched: "primary" | "fallback" = "primary";
  let templatePrimaryError: string | undefined;

  try {
    const test = await fetch(templateUrl, { cache: "no-store" });
    if (!test.ok) throw new Error(`Fetch failed ${test.status} for ${templateUrl}`);
  } catch (e: any) {
    templatePrimaryError = String(e?.message ?? e);
    templateUrl = fallbackTemplateUrl;
    templateFetched = "fallback";
  }

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

  const [templateDataUrl, u1Data, u2Data] = await Promise.all([
    fetchAsDataUrl(templateUrl),
    u1 ? fetchAsDataUrl(u1).catch(() => null) : Promise.resolve(null),
    u2 ? fetchAsDataUrl(u2).catch(() => null) : Promise.resolve(null),
  ]);

  const fillH = Math.round((BAR_H * score) / 100);
  const fillTop = BAR_Y + (BAR_H - fillH);

  // % TEXT SETTINGS
  const isSpecial = score === 69 || score === 100;
  const percentText = `${score}%`;

  // Bigger for 69/100
  const fontSize = score === 100 ? 56 : score === 69 ? 52 : 40;

  // Position it centered on the bar (slightly above mid)
  const textLeft = BAR_X + BAR_W / 2;
  const textTop = 18;

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
        <img
          src={templateDataUrl}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ position: "absolute", left: 0, top: 0 }}
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

        {/* Bar fill overlay */}
        <div
          style={{
            position: "absolute",
            left: BAR_X,
            top: fillTop,
            width: BAR_W,
            height: fillH,
            background: "linear-gradient(180deg, #6e1011 0%, #6e1011 100%)",
            opacity: 0.9,
            borderRadius: 2,
          }}
        />

        {/* % text (ALWAYS shows for 0–100; you can clamp to 1–100 in your bot if you want) */}
        <div
          style={{
            position: "absolute",
            left: textLeft,
            top: textTop,
            transform: "translateX(-50%)",
            fontSize,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: -1,
            textShadow: "0 2px 10px rgba(0,0,0,0.65)",
            // slightly extra emphasis for special scores
            opacity: isSpecial ? 1 : 0.95,
          }}
        >
          {percentText}
        </div>

        {/* Hearts overlay ONLY for 69 & 100 (no fetching, so it won't crash) */}
        <HeartsOverlay score={score} />
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
