/* app/api/ship/route.tsx */
import { ImageResponse } from "next/og";

export const runtime = "edge";

const CANVAS_W = 1200;
const CANVAS_H = 600;

/**
 * These are the bar coordinates on your template image.
 * If your fill looks slightly off, tweak BAR_X / BAR_Y / BAR_W / BAR_H.
 */
const BAR_X = 540;
const BAR_Y = 120;
const BAR_W = 120;
const BAR_H = 420;

const FILL_COLOR = "#761c20"; // your requested red

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** tiny deterministic RNG (so hearts are stable per URL) */
function makeRng(seed: number) {
  let x = seed || 123456789;
  return () => {
    // xorshift32
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    // 0..1
    return ((x >>> 0) % 100000) / 100000;
  };
}

function HeartSvg({
  size,
  opacity,
}: {
  size: number;
  opacity: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ opacity }}
    >
      <path
        d="M12 21s-7.2-4.6-9.6-8.6C.6 9.1 2.1 5.9 5.2 5.1c1.9-.5 3.8.2 4.8 1.6 1-1.4 2.9-2.1 4.8-1.6 3.1.8 4.6 4 2.8 7.3C19.2 16.4 12 21 12 21z"
        fill="#ff2d55"
      />
    </svg>
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const scoreRaw = searchParams.get("score") ?? "0";
  const score = clamp(parseInt(scoreRaw, 10) || 0, 0, 100);

  // optional cache busters / deterministic seed for heart placement
  const t = searchParams.get("t") ?? searchParams.get("nocache") ?? "1";
  const seed = (parseInt(t, 10) || 1) + score * 999;

  // debug mode returns JSON instead of an image
  const debug = searchParams.get("debug") === "1";

  // template served from /public/ship-base.png
  const templateUrl = new URL("/ship-base.png", req.url).toString();

  if (debug) {
    return new Response(
      JSON.stringify(
        {
          scoreRaw,
          score,
          templateUrl,
          note:
            "If templateUrl loads in browser, ship image should render. If the image is blank in Discord, ensure the endpoint returns image/png.",
        },
        null,
        2
      ),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  // fill height from score
  const fillH = Math.round((BAR_H * score) / 100);
  const fillTop = BAR_Y + (BAR_H - fillH);

  // Bigger text for 69 and 100 (and also 70+ for good measure)
  const bigScore = score === 69 || score === 100;
  const fontSize = bigScore ? 110 : score >= 70 ? 96 : 80;

  // Hearts overlay ONLY for 69 or 100
  const showHearts = score === 69 || score === 100;
  const rng = makeRng(seed);
  const heartsCount = score === 100 ? 40 : 28;

  const hearts = showHearts
    ? Array.from({ length: heartsCount }).map((_, i) => {
        const x = Math.round(rng() * (CANVAS_W - 40));
        const y = Math.round(rng() * (CANVAS_H - 40));
        const size = Math.round(18 + rng() * 38);
        const opacity = 0.18 + rng() * 0.35;
        const rotate = Math.round(-25 + rng() * 50);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `rotate(${rotate}deg)`,
            }}
          >
            <HeartSvg size={size} opacity={opacity} />
          </div>
        );
      })
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: "relative",
          backgroundColor: "#000",
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif',
        }}
      >
        {/* Template background */}
        <img
          src={templateUrl}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: CANVAS_W,
            height: CANVAS_H,
          }}
        />

        {/* Fill overlay */}
        <div
          style={{
            position: "absolute",
            left: BAR_X,
            top: fillTop,
            width: BAR_W,
            height: fillH,
            backgroundColor: FILL_COLOR,
            opacity: 0.92,
          }}
        />

        {/* Hearts overlay for 69 and 100 */}
        {hearts}

        {/* % text (bigger for 69/100) */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 42,
            width: CANVAS_W,
            textAlign: "center",
            fontSize,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: -2,
            textShadow: "0 6px 18px rgba(0,0,0,0.55)",
          }}
        >
          {score}%
        </div>
      </div>
    ),
    {
      width: CANVAS_W,
      height: CANVAS_H,
      headers: {
        "content-type": "image/png",
        // Helps Discord re-fetch more reliably when you add &t=...
        "cache-control": "no-store, max-age=0",
      },
    }
  );
}
