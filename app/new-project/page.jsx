export default function NewProject() {
  return (
    <main style={{ minHeight: "100vh", background: "#0D1210", color: "#E4EDE7", padding: "48px", fontFamily: "Arial" }}>
      <h1>Create New Project</h1>

      <form style={{ marginTop: "24px", maxWidth: "600px" }}>
        <label>Project Name</label>
        <input placeholder="Website Launch Project" style={{ padding: "12px", margin: "8px 0 16px", width: "100%" }} />

        <label>Deadline</label>
        <input type="date" style={{ padding: "12px", margin: "8px 0 16px", width: "100%" }} />

        <label>Key Tasks</label>
        <textarea placeholder="Brand approval, product pages, SEO, QA, launch..." style={{ padding: "12px", margin: "8px 0 16px", width: "100%", height: "140px" }} />

        <a href="/results" style={{ display: "inline-block", marginTop: "16px", color: "#0D1210", background: "#3ECB6F", padding: "14px 22px", borderRadius: "8px", textDecoration: "none", fontWeight: "bold" }}>
          Generate Pathflo Analysis →
        </a>
      </form>
    </main>
  );
}