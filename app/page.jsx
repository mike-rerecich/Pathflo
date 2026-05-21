export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0D1210",
        color: "#E4EDE7",
        padding: "48px",
        fontFamily: "Arial"
      }}
    >
      <h1 style={{ fontSize: "48px" }}>Pathflo</h1>

      <p style={{ marginTop: "16px", color: "#8FA898" }}>
        AI operational intelligence for predictable execution.
      </p>

      <a
        href="/dashboard"
        style={{
          marginTop: "32px",
          display: "inline-block",
          background: "#3ECB6F",
          color: "#0D1210",
          padding: "14px 22px",
          borderRadius: "8px",
          textDecoration: "none",
          fontWeight: "bold"
        }}
      >
        Open Dashboard →
      </a>
    </main>
  );
}