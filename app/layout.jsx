export const metadata = {
  title: "Pathflo — Execution Intelligence",
  description: "AI-powered project planning. Critical path, cascade risks, and on-time confidence before work begins.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
