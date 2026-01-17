import { ImageResponse } from "next/og";

export const runtime = "edge";

const CANVAS_W = 1200;
const CANVAS_H = 675;

const BAR_W = 160;
const BAR_X = Math.round((CANVAS_W - BAR_W) / 2);
const BAR_Y = 0;
const BAR_H = CANVAS_H;

const FILL_COLOR = "#761c20"; // your red

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function parseScore(scoreRaw: string | null) {
  const n = Number(scoreRaw);
  if (!Number.isFinite(n)) return 0;
  return clamp(Math.round(n), 0, 100);
}

function makeHearts(seed: number, count: number) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };

  return Array.from({ length: count }).map((_, i) => ({
    key: i,
    x: Math.floor(rand() * CANVAS_W),
    y: Math.floor(rand() * CANVAS_H),
    size: 26 + Math.floor(rand() * 26),
    rot: Math.floor(rand() * 40) - 20,
    opacity: 0.12 + rand() * 0.2,
  }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scoreRaw = searchParams.get("score");
  const debug = searchParams.get("debug") === "1";

  const score = parseScore(scoreRaw);

  // Seed for hearts positions
  const seed = Number(searchParams.get("t") ?? searchParams.get("nocache")) || Date.now();

  // IMPORTANT: use the deployed static asset, no fetch/base64 needed
  const origin = new URL(req.url).origin;
  const templateUrl = `${origin}/ship-base.png`;

  if (debug) {
    return new Response(
      JSON.stringify(
        {
          scoreRaw,
          score,
          templateUrl,
          fillColor: FILL_COLOR,
          bar: { x: BAR_X, y: BAR_Y, w: BAR_W, h: BAR_H },
        },
        null,
        2
      ),
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store, max-age=0",
        },
      }
    );
  }

  const fillH = Math.round((BAR_H * score) / 100);
  const fillTopY = BAR_Y + (BAR_H - fillH);

  const is69 = score === 69;
  const is100 = score === 100;

  const percentFontSize = is100 ? 120 : is69 ? 108 : 92;

  const hearts = is69 || is100 ? makeHearts(seed, is100 ? 28 : 22) : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: "relative",
          backgroundColor: "#000",
          overflow: "hidden",
        }}
      >
        {/* Template */}
        <img
          src={templateUrl}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ position: "absolute", left: 0, top: 0 }}
        />

        {/* Fill */}
        <div
          style={{
            position: "absolute",
            left: BAR_X,
            top: fillTopY,
            width: BAR_W,
            height: fillH,
            background: FILL_COLOR,
            opacity: 0.92,
          }}
        />

        {/* Hearts overlay for 69/100 */}
        {(is69 || is100) &&
          hearts.map((h) => (
            <div
              key={h.key}
              style={{
                position: "absolute",
                left: h.x,
                top: h.y,
                transform: `rotate(${h.rot}deg)`,
                fontSize: h.size,
                opacity: h.opacity,
              }}
            >
              ❤️
            </div>
          ))}

        {/* Percent */}
        <div
          style={{
            position: "absolute",
            top: 36,
            left: BAR_X,
            width: BAR_W,
            textAlign: "center",
            fontSize: percentFontSize,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: "-1px",
            textShadow: "0 4px 18px rgba(0,0,0,0.55)",
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
        "cache-control": "no-store, max-age=0",
      },
    }
  );
}
