export const metadata = {
  title: "WHISPER Ship Card API",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Arial" }}>
        {children}
      </body>
    </html>
  );
}
