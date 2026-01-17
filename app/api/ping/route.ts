export const runtime = "edge";

export async function GET() {
  return new Response("pong", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}
