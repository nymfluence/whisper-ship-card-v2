// app/api/ship/route.ts
import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

const CANVAS_W = 512; // 220.5 + 71.1 + 220.5 ≈ 512
const CANVAS_H = 220;

const BAR_X = 220.5;
const BAR_W = 71.1;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Convert 0–100 score to bar fill height (bottom-up)
function barFillHeight(score: number) {
  const s = clamp(score, 0, 100);
  return Math.round((CANVAS_H * s) / 100);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const scoreRaw = searchParams.get("score") ?? "0";
  const score = clamp(parseInt(scoreRaw, 10) || 0, 0, 100);

  const u1 = searchParams.get("u1") || ""; // optional avatar URL
  const u2 = searchParams.get("u2") || ""; // optional avatar URL
  const debug = searchParams.get("debug") === "1";

  const baseUrl = new URL(req.url).origin;
  const templateUrl = `${baseUrl}/ship-base.png`;

  if (debug) {
    return new Response(
      JSON.stringify(
        {
          scoreRaw,
          score,
          templateUrl,
          u1Provided: Boolean(u1),
          u2Provided: Boolean(u2),
        },
        null,
        2
      ),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  const fillH = barFillHeight(score);
  const fillY = CANVAS_H - fillH;

  return new ImageResponse(
    (
      <div
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#000000",
        }}
      >
        {/* Template layer (this is the key change: use IMG, not CSS bg) */}
        <img
          src={templateUrl}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
          }}
        />

        {/* Optional avatars overlay (if you pass u1/u2 later) */}
        {u1 ? (
          <img
            src={u1}
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

        {u2 ? (
          <img
            src={u2}
            width={220}
            height={220}
            style={{
              position: "absolute",
              left: 292, // roughly 291.5
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
            top: fillY,
            width: BAR_W,
            height: fillH,
            background: "#B57E5A",
            opacity: 0.95,
          }}
        />

        {/* Percentage text */}
        <div
          style={{
            position: "absolute",
            left: BAR_X,
            bottom: 10,
            width: BAR_W,
            textAlign: "center",
            color: "#ffffff",
            fontSize: 34,
            fontWeight: 800,
            fontFamily: "Arial",
            textShadow: "0 2px 8px rgba(0,0,0,0.6)",
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
        // Helps Safari behave nicer with generated images
        "cache-control": "no-store",
      },
    }
  );
}
