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
  // @ts-ignore Buffer exists in the Edge runtime for this use case in Next OG
  const b64 = Buffer.from(buf).toString("base64");
  return `data:${contentType};base64,${b64}`;
}

type Heart = { x: number; y: number; r: number; s: number; o: number; t?: string };

function heartLayout(score: number): Heart[] {
  // Deterministic positions (so it always looks the same for 69/100)
  // Spread across the full canvas, avoiding the exact bar center a bit.
  const base: Heart[] =
    score === 100
      ? [
          { x: 40, y: 35, r: -18, s: 32, o: 0.60 },
          { x: 95, y: 70, r: 12, s: 22, o: 0.55 },
          { x: 150, y: 40, r: -6, s: 18, o: 0.45 },
          { x: 195, y: 85, r: 10, s: 26, o: 0.55 },
          { x: 305, y: 55, r: -10, s: 22, o: 0.50 },
          { x: 355, y: 35, r: 16, s: 28, o: 0.60 },
          { x: 410, y: 75, r: -14, s: 20, o: 0.50 },
          { x: 460, y: 45, r: 8, s: 24, o: 0.55 },
          { x: 70, y: 155, r: 14, s: 26, o: 0.55 },
          { x: 135, y: 175, r: -8, s: 20, o: 0.50 },
          { x: 185, y: 150, r: 10, s: 18, o: 0.45 },
          { x: 335, y: 165, r: -12, s: 22, o: 0.50 },
          { x: 395, y: 150, r: 10, s: 26, o: 0.55 },
          { x: 455, y: 175, r: -6, s: 20, o: 0.50 },
        ]
      : [
          { x: 55, y: 45, r: -15, s: 28, o: 0.55 },
          { x: 120, y: 85, r: 10, s: 20, o: 0.50 },
          { x: 170, y: 55, r: -5, s: 18, o: 0.45 },
          { x: 320, y: 65, r: 12, s: 22, o: 0.50 },
          { x: 380, y: 40, r: -10, s: 26, o: 0.55 },
          { x: 450, y: 80, r: 8, s: 20, o: 0.50 },
          { x: 85, y: 165, r: 12, s: 22, o: 0.50 },
          { x: 155, y: 150, r: -8, s: 20, o: 0.45 },
          { x: 350, y: 160, r: 10, s: 22, o: 0.50 },
          { x: 430, y: 155, r: -6, s: 24, o: 0.55 },
          // a couple cheeky “69” marks
          { x: 25, y: 115, r: -18, s: 18, o: 0.45, t: "69" },
          { x: 480, y: 120, r: 14, s: 18, o: 0.45, t: "69" },
        ];

  return base;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const scoreRaw = searchParams.get("score") ?? "0";
  const score = clamp(toInt(scoreRaw, 0), 0, 100);

  const debug = searchParams.get("debug") === "1";

  // Optional avatar URLs
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

  // Fill amount (from bottom up)
  const fillH = Math.round((BAR_H * score) / 100);
  const fillTop = BAR_Y + (BAR_H - fillH);

  // % text sizing (bigger for 69/100 like your examples)
  const pctText = `${score}%`;
  const pctFont =
    score >= 100 ? 64 : score >= 69 ? 58 : score >= 40 ? 48 : 44;

  // Position the % roughly centered on the bar
  const pctLeft = BAR_X + BAR_W / 2;
  const pctTop = 18; // keep near the top like your reference cards

  // Hearts overlay only for 69 and 100
  const showHearts = score === 69 || score === 100;
  const hearts = showHearts ? heartLayout(score) : [];

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

        {/* % text (always on) */}
        <div
          style={{
            position: "absolute",
            left: pctLeft,
            top: pctTop,
            transform: "translateX(-50%)",
            fontSize: pctFont,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: -1,
            textShadow: "0 2px 6px rgba(0,0,0,0.55)",
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial',
          }}
        >
          {pctText}
        </div>

        {/* Hearts / celebration overlay (69 + 100 only) */}
        {showHearts ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: CANVAS_W,
              height: CANVAS_H,
            }}
          >
            {hearts.map((h, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: h.x,
                  top: h.y,
                  transform: `rotate(${h.r}deg)`,
                  fontSize: h.s,
                  fontWeight: 900,
                  color: "#ffffff",
                  opacity: h.o,
                  textShadow: "0 2px 6px rgba(0,0,0,0.35)",
                  fontFamily:
                    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial',
                }}
              >
                {h.t ? h.t : "♥"}
              </div>
            ))}

            {/* a few sparkles for “celebratory” feel */}
            <div
              style={{
                position: "absolute",
                left: 70,
                top: 25,
                fontSize: 18,
                opacity: 0.55,
                color: "#ffffff",
              }}
            >
              ✦
            </div>
            <div
              style={{
                position: "absolute",
                left: 460,
                top: 30,
                fontSize: 16,
                opacity: 0.5,
                color: "#ffffff",
              }}
            >
              ✦
            </div>
            <div
              style={{
                position: "absolute",
                left: 40,
                top: 190,
                fontSize: 14,
                opacity: 0.45,
                color: "#ffffff",
              }}
            >
              ✦
            </div>
            <div
              style={{
                position: "absolute",
                left: 485,
                top: 190,
                fontSize: 14,
                opacity: 0.45,
                color: "#ffffff",
              }}
            >
              ✦
            </div>
          </div>
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
