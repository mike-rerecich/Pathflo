export default function Results() {
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
      <h1 style={{ fontSize: "42px" }}>
        Execution Intelligence Report
      </h1>

      <div style={{ marginTop: "32px" }}>
        <h2 style={{ color: "#3ECB6F" }}>
          Operational Risk Score: 6.8 / 10
        </h2>

        <p style={{ color: "#8FA898", marginTop: "10px" }}>
          Moderate risk detected. Primary delay risk is client approval dependency before development begins.
        </p>
      </div>

      <div style={{ marginTop: "32px" }}>
        <h2>Critical Path</h2>

        <p style={{ color: "#8FA898", marginTop: "10px" }}>
          Discovery → Design → Client Approval → Development → Launch
        </p>
      </div>

      <div style={{ marginTop: "32px" }}>
        <h2>Bottleneck Detection</h2>

        <p style={{ color: "#8FA898", marginTop: "10px" }}>
          Client approval task has zero breathing room and controls launch timing.
        </p>
      </div>

      <div style={{ marginTop: "32px" }}>
        <h2>AI Recommendation</h2>

        <p style={{ color: "#8FA898", marginTop: "10px" }}>
          Run SEO setup and email automation in parallel with product page development to reduce cycle time by 4 days.
        </p>
      </div>
    </main>
  );
}