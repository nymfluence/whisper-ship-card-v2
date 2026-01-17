export default function Home() {
  const t = Date.now().toString();

  const pingHref = "/api/ping";

  const shipParams = new URLSearchParams({ score: "31", t });
  const shipHref = `/api/ship?${shipParams.toString()}`;

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>WHISPER Ship Card API ✅</h1>

      <p>
        Ping test: <a href={pingHref}>{pingHref}</a>
      </p>

      <p>
        Ship image test (no avatars): <a href={shipHref}>{shipHref}</a>
      </p>

      <p>Preview:</p>
      <img
        src={shipHref}
        alt="Ship preview"
        style={{ border: "1px solid #ddd", maxWidth: "100%" }}
      />

      <p style={{ marginTop: 24, opacity: 0.75 }}>
        Template file should load at: <a href="/ship-base.png">/ship-base.png</a>
      </p>
    </main>
  );
}
