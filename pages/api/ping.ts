export const config = { runtime: "edge" };

export default function handler() {
  return new Response("pong", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}
