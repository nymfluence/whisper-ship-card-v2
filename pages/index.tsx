export default function Home() {
  const t = Date.now();

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>WHISPER Ship Card API ✅</h1>

      <p>
        Ping test: <a href="/api/ping">/api/ping</a>
      </p>

      <p>
        Ship image test (no avatars):{" "}
        <a href={`/api/ship?score=31&t=${t}`}>{`/api/ship?score=31&t=${t}`}</a>
      </p>

      <p>Preview:</p>
      <img
        src={`/api/ship?score=31&t=${t}`}
        alt="Ship preview"
        style={{ border: "1px solid #ddd", maxWidth: "100%" }}
      />
    </main>
  );
}
