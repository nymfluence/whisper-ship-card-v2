import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const CANVAS_W = 512;
const CANVAS_H = 220;

// Your bar + avatar layout (from Canva)
const PFP_W = 220.5;
const BAR_W = 71.1;

// Bar fill area (inside the bar)
const FILL_INSET_X = 6; // tweak if needed
const FILL_INSET_TOP = 6;
const FILL_INSET_BOTTOM = 6;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const scoreRaw = searchParams.get("score") ?? "0";
  const score = clamp(parseInt(scoreRaw, 10) || 0, 0, 100);

  const debug = searchParams.get("debug") === "1";

  // Template should be in /public as public/ship-base.png
  // So it’s served at: https://<your-domain>/ship-base.png
  const origin = new URL(req.url).origin;
  const templateUrl = `${origin}/ship-base.png`;

  // If debug=1, return JSON only (helps you diagnose)
  if (debug) {
    return new Response(
      JSON.stringify(
        {
          scoreRaw,
          score,
          templateUrl,
          hint:
            "If image is blank, the template fetch or ImageResponse render is failing. Check Vercel logs.",
        },
        null,
        2
      ),
      {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store, max-age=0",
        },
      }
    );
  }

  // Fetch the template image as bytes (this is more reliable than <img src>)
  let templateArrayBuffer: ArrayBuffer;
  try {
    const tRes = await fetch(templateUrl, { cache: "no-store" });
    if (!tRes.ok) {
      return new Response(`Template fetch failed: ${tRes.status} ${templateUrl}`, {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    templateArrayBuffer = await tRes.arrayBuffer();
  } catch (e: any) {
    return new Response(`Template fetch exception: ${String(e?.message ?? e)}`, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Compute fill height (bottom-up)
  const fillMaxH = CANVAS_H - FILL_INSET_TOP - FILL_INSET_BOTTOM;
  const fillH = Math.round((fillMaxH * score) / 100);
  const fillY = CANVAS_H - FILL_INSET_BOTTOM - fillH;

  // Fill X starts at left avatar width + inset
  const barX = PFP_W;
  const fillX = barX + FILL_INSET_X;
  const
