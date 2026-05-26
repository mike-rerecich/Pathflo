"use client";
import { useState, useEffect } from "react";

const Logo = ({ color = "#3ECB6F", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}>
    <path d="M4 24 C8 24 10 14 15 14 C20 14 22 6 26 6 C29 6 30 12 31 14" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
    <circle cx="4" cy="24" r="3" fill={color}/>
    <circle cx="15" cy="14" r="2.5" fill={color} opacity="0.7"/>
    <circle cx="26" cy="6" r="2.5" fill={color} opacity="0.5"/>
    <circle cx="31" cy="14" r="2.5" fill={color} opacity="0.9"/>
  </svg>
);

export default function Home() {
  const [dark, setDark] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const T = dark ? {
    bg: "#080A08", surface: "#111511", surface2: "#161A16",
    border: "#1E251E", border2: "#252D25", text: "#EEF2EE", textMid: "#8A9E8A",
    textDim: "#4A5A4A", green: "#3ECB6F", greenDim: "#0F2B1A", greenMid: "#1A4A28",
    shadow: "0 4px 24px rgba(0,0,0,0.5)", navBg: "rgba(8,10,8,0.88)",
    gradHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(62,203,111,0.15) 0%, transparent 70%)",
  } : {
    bg: "#F7F8F5", surface: "#FFFFFF", surface2: "#F2F3EF",
    border: "#E2E4DC", border2: "#D4D6CC", text: "#0F140F", textMid: "#4A5A4A",
    textDim: "#8A9A8A", green: "#1E8A45", greenDim: "#E8F5EE", greenMid: "#C8E8D4",
    shadow: "0 4px 24px rgba(0,0,0,0.08)", navBg: "rgba(247,248,245,0.9)",
    gradHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(30,138,69,0.08) 0%, transparent 70%)",
  };

  const btnPrimary = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
    background: T.green, color: dark ? "#080A08" : "#FFFFFF",
    border: "none", borderRadius: "100px", fontFamily: "inherit", fontWeight: 700,
    fontSize: "0.95rem", padding: "0.9rem 2rem", cursor: "pointer", textDecoration: "none",
    boxShadow: dark ? "0 0 0 1px rgba(62,203,111,0.3), 0 8px 32px rgba(62,203,111,0.2)" : "0 4px 20px rgba(30,138,69,0.25)",
    transition: "transform 0.15s",
  };
  const btnSecondary = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: "transparent", color: T.textMid, border: "1.5px solid " + T.border2,
    borderRadius: "100px", fontFamily: "inherit", fontWeight: 500, fontSize: "0.95rem",
    padding: "0.9rem 2rem", cursor: "pointer", textDecoration: "none", transition: "all 0.15s",
  };

  const questions = [
    { q: "Will this project actually succeed?", a: "Pathflo scores execution confidence before work begins — not after something breaks." },
    { q: "When will it actually finish?", a: "Not a guess. A projected completion date backed by critical path analysis and dependency mapping." },
    { q: "What is going to break it?", a: "Bottleneck detection flags the three milestones most likely to blow your deadline, and explains why." },
    { q: "How do we fix it before it costs us?", a: "Concrete moves for each constraint: what to compress, what to parallelize, what to escalate." },
  ];

  const comparison = [
    { pm: "Store your tasks", pathflo: "Predict your outcomes" },
    { pm: "Tell you you are behind", pathflo: "Tell you why — before it happens" },
    { pm: "Track what exists", pathflo: "Forecast what is coming" },
    { pm: "Show you a Gantt chart", pathflo: "Tell you if the plan will actually work" },
    { pm: "Require a PM to interpret", pathflo: "Built for owners without one" },
    { pm: "React to problems", pathflo: "Prevent them" },
  ];

  const pricing = [
    {
      name: "Solo", price: "$49", period: "/mo", tag: null,
      desc: "For contractors and independent operators running client projects.",
      items: ["1 active project", "Critical path engine", "Risk score + bottleneck report", "Leadership readout", "CSV export"],
      cta: "Start free", primary: false,
    },
    {
      name: "Team", price: "$99", period: "/mo", tag: "Most popular",
      desc: "For agencies and small teams managing multiple projects at once.",
      items: ["Unlimited projects", "Everything in Solo", "Multi-owner dependency mapping", "Cascade impact simulator", "Priority support"],
      cta: "Start free", primary: true,
    },
    {
      name: "Business", price: "$299", period: "/mo", tag: null,
      desc: "For growing operations that need stakeholder-ready reporting.",
      items: ["Everything in Team", "Shareable leadership reports", "Industry templates", "Custom risk weights", "Dedicated onboarding"],
      cta: "Contact us", primary: false,
    },
  ];

  // Node data for dependency graph
  const nodes = [
    { x:18,  y:34,  bg:dark?"#161A16":"#F0F4F0", stroke:dark?"#4A5A4A":"#9AA49A", lines:["Strategy &","Planning"], dur:"Done · 5d", dot:dark?"#4A5A4A":"#9AA49A", w:90 },
    { x:160, y:70,  bg:dark?"#161A16":"#F0F4F0", stroke:dark?"#4A5A4A":"#9AA49A", lines:["Content","& Copy"],   dur:"Done · 8d", dot:dark?"#4A5A4A":"#9AA49A", w:90 },
    { x:160, y:170, bg:dark?"#071410":"#E8F5EE", stroke:"#3ECB6F",                lines:["Product","Photo"],    dur:"On track · 6d", dot:"#3ECB6F", w:90 },
    { x:300, y:72,  bg:dark?"#130F00":"#FEF3C7", stroke:"#FBBF24",                lines:["Design"],             dur:"At risk · 10d", dot:"#FBBF24", w:90 },
    { x:300, y:210, bg:dark?"#071410":"#E8F5EE", stroke:"#3ECB6F",                lines:["Klaviyo","Setup"],    dur:"On track · 4d", dot:"#3ECB6F", w:90 },
    { x:440, y:38,  bg:dark?"#130600":"#FEE2E2", stroke:"#F87171",                lines:["Develop-","ment"],    dur:"Delayed · 12d", dot:"#F87171", w:90, glow:true },
    { x:438, y:146, bg:dark?"#130F00":"#FEF3C7", stroke:"#FBBF24",                lines:["QA &","Testing"],     dur:"At risk · 5d",  dot:"#FBBF24", w:90 },
    { x:580, y:92,  bg:dark?"#071410":"#E8F5EE", stroke:"#3ECB6F",                lines:["Launch"],             dur:"On track · 1d", dot:"#3ECB6F", w:90 },
  ];

  return (
    <main style={{ background: T.bg, color: T.text, fontFamily: "'DM Sans', system-ui, sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&family=Fraunces:ital,wght@0,300;0,700;1,300;1,700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #252D25; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .h1{animation:fadeUp 0.7s 0.1s ease both}
        .h2{animation:fadeUp 0.7s 0.25s ease both}
        .h3{animation:fadeUp 0.7s 0.4s ease both}
        .h4{animation:fadeUp 0.7s 0.55s ease both}
        .btnp:hover{transform:translateY(-2px)}
        .btns:hover{border-color:#3ECB6F !important;color:#3ECB6F !important}
        .navlink:hover{color:#EEF2EE !important}
        .card{transition:transform 0.2s}
        .card:hover{transform:translateY(-2px)}
        .qcard:hover{border-color:#3ECB6F33 !important}
        .comp-row:hover .comp-right{background:rgba(62,203,111,0.08) !important}
        @media(max-width:768px){
          .pgrid{grid-template-columns:1fr !important}
          .qgrid{grid-template-columns:1fr !important}
          .pillars-grid{grid-template-columns:1fr !important}
          .graph-body{grid-template-columns:1fr !important}
          .graph-right-panel{border-left:none !important;border-top:1px solid var(--border-val) !important}
          .hbtns{flex-direction:column !important;align-items:center !important}
          .navlinks{display:none !important}
          .comp-header{font-size:0.62rem !important}
          .comp-cell{padding:0.75rem 0.85rem !important;font-size:0.78rem !important}
          .hero-stats{gap:1.5rem !important;flex-wrap:wrap !important;justify-content:center !important}
          .graph-svg{min-width:0 !important}
        }
      `}</style>

      {/* Background gradient */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100vh", background: T.gradHero, pointerEvents: "none", zIndex: 0 }} />

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, height: "68px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 2rem",
        background: scrolled ? T.navBg : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid " + T.border : "none",
        transition: "all 0.3s",
      }}>
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Logo color={T.green} size={24} />
          <span style={{ fontWeight: 700, fontSize: "1.1rem", color: T.text, letterSpacing: "-0.02em" }}>Pathflo</span>
        </a>
        <div className="navlinks" style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <a className="navlink" href="#why" style={{ color: T.textMid, fontSize: "0.88rem", textDecoration: "none", transition: "color 0.15s" }}>Why it works</a>
          <a className="navlink" href="#pricing" style={{ color: T.textMid, fontSize: "0.88rem", textDecoration: "none", transition: "color 0.15s" }}>Pricing</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button onClick={() => setDark(!dark)} title="Toggle theme" style={{
            width: 44, height: 28, borderRadius: 14, border: "1.5px solid " + T.border2,
            background: T.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: dark ? "#080A08" : "#F7F8F5", border: "2px solid " + T.border2 }} />
          </button>
          <a href="/app" className="btnp" style={{ ...btnPrimary, padding: "0.6rem 1.4rem", fontSize: "0.88rem" }}>Launch app</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: "relative", zIndex: 1, paddingTop: "160px", paddingBottom: "100px", textAlign: "center", padding: "160px 2rem 100px" }}>
        <div className="h1" style={{ marginBottom: "1.75rem" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            background: T.surface, border: "1px solid " + T.border2,
            borderRadius: "100px", padding: "0.35rem 1rem",
            fontSize: "0.7rem", fontWeight: 600, color: T.textMid, letterSpacing: "0.08em",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, animation: "pulse 2s infinite" }} />
            NOW LIVE — PLAN YOUR FIRST PROJECT FREE
          </span>
        </div>
        <h1 className="h2" style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(3rem, 8vw, 5.5rem)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: "1.5rem", maxWidth: "800px", margin: "0 auto 1.5rem" }}>
          Operational clarity.<br />
          <em style={{ color: T.green, fontStyle: "italic", fontWeight: 300 }}>Execution predictability.</em>
        </h1>
        <p className="h3" style={{ fontSize: "clamp(1rem, 2.5vw, 1.2rem)", color: T.textMid, lineHeight: 1.75, maxWidth: "560px", margin: "0 auto 2.5rem", fontWeight: 300 }}>
          The PMO you cannot afford to hire. <Logo color={T.green} size={14} />{" "}
          <span style={{ fontWeight: 500, color: T.text }}>Pathflo</span> gives you the execution intelligence to plan, predict, and deliver — without a formal project manager.
        </p>
        <div className="h4 hbtns" style={{ display: "flex", gap: "1rem", justifyContent: "center", marginBottom: "3rem" }}>
          <a href="/app" className="btnp" style={{ ...btnPrimary, fontSize: "1rem", padding: "1rem 2.25rem" }}>Build my first plan →</a>
          <a href="#why" className="btns" style={btnSecondary}>See why it works</a>
        </div>
        <div className="h4 hero-stats" style={{ display: "flex", justifyContent: "center", gap: "3.5rem" }}>
          {[{ val: "5 min", label: "To your first risk score" }, { val: "3 pillars", label: "Of execution intelligence" }, { val: "1 readout", label: "Leadership can act on" }].map(({ val, label }) => (
            <div key={val} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.75rem", fontWeight: 700, color: T.text }}>{val}</div>
              <div style={{ fontSize: "0.72rem", color: T.textDim, fontWeight: 500, letterSpacing: "0.06em", marginTop: "0.2rem" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FOUR QUESTIONS */}
      <section id="why" style={{ padding: "80px 2rem", maxWidth: "900px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "0.7rem", color: T.green, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem" }}>WHY IT WORKS</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            The four questions every business<br />owner is already asking.
          </h2>
        </div>
        <div className="qgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
          {questions.map(({ q, a }, i) => (
            <div key={i} className="qcard" style={{
              background: T.surface, border: "1px solid " + T.border2,
              borderRadius: "16px", padding: "1.75rem", transition: "border-color 0.2s",
            }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1rem", fontWeight: 400, marginBottom: "0.75rem", lineHeight: 1.4 }}>{q}</div>
              <p style={{ fontSize: "0.87rem", color: T.textMid, lineHeight: 1.75, fontWeight: 300 }}>{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DEPENDENCY INTELLIGENCE GRAPH */}
      <section style={{ padding: "80px 2rem", maxWidth: "1100px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "0.7rem", color: T.green, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem" }}>DEPENDENCY INTELLIGENCE</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
            See the failure chain<br /><em style={{ color: T.green, fontStyle: "italic" }}>before it happens.</em>
          </h2>
          <p style={{ color: T.textMid, fontSize: "1rem", fontWeight: 300, lineHeight: 1.75, maxWidth: "520px", margin: "0 auto" }}>
            Pathflo maps every task dependency, flags the cascade impact of each risk, and tells you exactly which tasks will blow your deadline.
          </p>
        </div>

        {/* Graph Stage */}
        <div style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: "20px", overflow: "hidden", boxShadow: T.shadow }}>
          {/* Top bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "1rem 1.5rem", borderBottom: "1px solid " + T.border,
            flexWrap: "wrap", gap: "0.5rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", fontWeight: 600, color: T.text }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.green, animation: "pulse 2s infinite" }} />
              Website Launch — Northstar Nutrition
            </div>
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              {[{ label: "Tasks", val: "14" }, { label: "Dependencies", val: "23" }, { label: "Critical Path", val: "6 tasks" }].map(s => (
                <div key={s.label} style={{ fontSize: "0.72rem", color: T.textMid }}>
                  {s.label} <span style={{ color: T.text, fontWeight: 600 }}>{s.val}</span>
                </div>
              ))}
            </div>
            <div style={{
              fontSize: "0.7rem", borderRadius: 6, padding: "0.22rem 0.7rem",
              fontWeight: 700, letterSpacing: "0.06em",
              background: dark ? "#1a0404" : "#FEE2E2", color: "#F87171",
              border: "1px solid rgba(248,113,113,0.3)",
            }}>⚠ CASCADE RISK DETECTED</div>
          </div>

          {/* Graph body — FIX: className graph-body, stacks on mobile via CSS */}
          <div className="graph-body" style={{ display: "grid", gridTemplateColumns: "1fr 272px" }}>

            {/* SVG graph */}
            <div style={{ padding: "1.5rem", overflowX: "auto" }}>
              <svg
                className="graph-svg"
                viewBox="0 0 700 320"
                style={{ width: "100%", height: 320, minWidth: 0, display: "block" }}
              >
                <defs>
                  <marker id="mg" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#3ECB6F" opacity="0.6"/>
                  </marker>
                  <marker id="mw" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#FBBF24" opacity="0.6"/>
                  </marker>
                  <marker id="md" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#F87171" opacity="0.8"/>
                  </marker>
                  <filter id="glowlp">
                    <feGaussianBlur stdDeviation="3" result="b"/>
                    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>

                {/* Cascade zone */}
                <rect x="262" y="44" width="418" height="224" rx="12" fill="rgba(248,113,113,0.04)" stroke="#F87171" strokeWidth="1" strokeDasharray="4,3" opacity="0.5"/>
                <text x="272" y="62" fontFamily="system-ui" fontSize="9" fill="#F87171" fontWeight="600" opacity="0.7">Cascade Impact — 5–7 day delay</text>

                {/* Edges */}
                <path d="M112 56Q148 56 158 86" stroke="#3ECB6F" strokeWidth="1.5" fill="none" opacity="0.5" markerEnd="url(#mg)"/>
                <path d="M112 68Q138 126 158 186" stroke="#3ECB6F" strokeWidth="1.5" fill="none" opacity="0.5" markerEnd="url(#mg)"/>
                <path d="M242 96L298 96" stroke="#3ECB6F" strokeWidth="1.5" fill="none" opacity="0.5" markerEnd="url(#mg)"/>
                <path d="M380 86L438 64" stroke="#FBBF24" strokeWidth="1.5" fill="none" opacity="0.6" markerEnd="url(#mw)"/>
                <path d="M380 102Q408 146 436 160" stroke="#FBBF24" strokeWidth="1.5" fill="none" opacity="0.5" markerEnd="url(#mw)"/>
                <path d="M242 196L298 226" stroke="#3ECB6F" strokeWidth="1.5" fill="none" opacity="0.5" markerEnd="url(#mg)"/>
                <path d="M524 60L580 110" stroke="#F87171" strokeWidth="1.8" fill="none" opacity="0.7" markerEnd="url(#md)"/>
                <path d="M524 180L580 126" stroke="#F87171" strokeWidth="1.8" fill="none" opacity="0.7" markerEnd="url(#md)"/>

                {/* Nodes */}
                {nodes.map((n, i) => (
                  <g key={i} transform={`translate(${n.x},${n.y})`} filter={n.glow ? "url(#glowlp)" : undefined}>
                    <rect width={n.w || 90} height={n.lines.length === 1 ? 50 : 56} rx="8" fill={n.bg} stroke={n.stroke} strokeWidth="1.5"/>
                    {n.lines.map((ln, j) => (
                      <text key={j} x="10" y={n.lines.length === 1 ? 20 : 16 + j * 13} fontFamily="system-ui" fontSize="10" fill={dark ? "#EEF2EE" : "#0F140F"} fontWeight="600">{ln}</text>
                    ))}
                    <text x="10" y={n.lines.length === 1 ? 34 : 16 + n.lines.length * 13 + 4} fontFamily="system-ui" fontSize="8" fill={n.dot} opacity="0.85">{n.dur}</text>
                    <circle cx={(n.w || 90) - 10} cy="10" r="3.5" fill={n.dot}/>
                  </g>
                ))}
              </svg>
            </div>

            {/* Right panel — FIX: className graph-right-panel, border flips on mobile */}
            <div
              className="graph-right-panel"
              style={{
                borderLeft: "1px solid " + T.border,
                padding: "1.5rem",
                display: "flex", flexDirection: "column", gap: "1.25rem",
              }}
            >
              <div>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#F87171", marginBottom: "0.6rem" }}>BIGGEST RISK</div>
                <div style={{
                  background: dark ? "#110404" : "#FEE2E2",
                  border: dark ? "1px solid rgba(248,113,113,0.2)" : "1px solid #FECACA",
                  borderRadius: "10px", padding: "0.85rem",
                }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#F87171", marginBottom: "0.35rem" }}>⚠ Development is 3 days late</div>
                  <div style={{ fontSize: "0.78rem", lineHeight: 1.6, color: T.textMid }}>Backend QA depends on it. Cascades into Launch with zero float.</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: T.textMid, marginBottom: "0.6rem" }}>CASCADE IMPACT</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                  {[
                    { label: "Delay Risk", val: "+5–7d", bad: true },
                    { label: "Tasks Affected", val: "6 tasks", bad: true },
                    { label: "Owners at Risk", val: "3 people", bad: false },
                    { label: "Cost Exposure", val: "$4,200", bad: false },
                  ].map((s, i) => (
                    <div key={i} style={{ background: T.surface2, border: "1px solid " + T.border, borderRadius: "8px", padding: "0.6rem 0.75rem" }}>
                      <div style={{ fontSize: "0.6rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textDim, marginBottom: "0.2rem" }}>{s.label}</div>
                      <div style={{ fontSize: "0.9rem", fontWeight: 700, color: s.bad ? "#F87171" : "#FBBF24" }}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: T.green, marginBottom: "0.6rem" }}>PATHFLO RECOMMENDATION</div>
                <div style={{ background: T.greenDim, border: "1px solid " + T.greenMid, borderRadius: "10px", padding: "0.85rem" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: T.green, marginBottom: "0.4rem" }}>+ Pathflo Recommendation</div>
                  <div style={{ fontSize: "0.8rem", lineHeight: 1.6, color: T.textMid }}>Move product photography earlier to run in parallel with design. Recovers 4 days and removes the primary bottleneck.</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.75rem" }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 600, whiteSpace: "nowrap", color: T.textDim }}>Confidence</div>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: T.border2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: "86%", background: T.green, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: T.green }}>86%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.85rem", padding: "0.9rem 1.5rem", borderTop: "1px solid " + T.border }}>
            {[
              { color: T.textMid, label: "Completed" },
              { color: T.green, label: "On Track" },
              { color: "#FBBF24", label: "At Risk" },
              { color: "#F87171", label: "Delayed" },
              { color: T.green, label: "Critical / Zero Float", dashed: true },
            ].map((l, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.7rem", color: T.textMid }}>
                <div style={{ width: 11, height: 11, borderRadius: 3, border: "1.5px solid " + l.color, background: "transparent" }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXECUTION INTELLIGENCE PILLARS */}
      <section style={{ padding: "80px 2rem", maxWidth: "1100px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "0.7rem", color: T.green, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem" }}>EXECUTION INTELLIGENCE</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
            Three dimensions of<br /><em style={{ color: T.green, fontStyle: "italic" }}>operational health.</em>
          </h2>
          <p style={{ color: T.textMid, fontSize: "1rem", fontWeight: 300, lineHeight: 1.75, maxWidth: "500px", margin: "0 auto" }}>
            Every project is analyzed across three intelligence pillars. Each one tells a different story about what's at risk.
          </p>
        </div>

        {/* FIX: className pillars-grid, stacks on mobile via CSS */}
        <div className="pillars-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1.75rem" }}>
          {[
            {
              n: "01 · Timeline Health", title: "How your schedule holds under pressure",
              color: "#60A5FA",
              vals: [0.74, 0.81, 0.65],
              labels: ["DEPENDENCY", "ACCURACY", "STABILITY"],
              pct: "74%", pctLabel: "TIMELINE",
              stats: [
                { name: "Dependency Compression", val: "Moderate", color: "#FBBF24" },
                { name: "Critical Path Stability", val: "Good", color: "#3ECB6F" },
                { name: "Forecast Accuracy", val: "81%", color: "#60A5FA" },
              ],
            },
            {
              n: "02 · Resource Health", title: "Who's overloaded, who's a single point of failure",
              color: "#A78BFA",
              vals: [0.62, 0.55, 0.80],
              labels: ["OVERLOAD", "CAPACITY", "AL(LOCATION)"],
              pct: "62%", pctLabel: "CAPACITY",
              stats: [
                { name: "Team Overload", val: "High", color: "#F87171" },
                { name: "Single Owner Risk", val: "Elevated", color: "#FBBF24" },
                { name: "Approval Capacity", val: "Limited", color: "#FBBF24" },
              ],
            },
            {
              n: "03 · Operational Health", title: "Execution confidence and rework risk",
              color: "#3ECB6F",
              vals: [0.78, 0.85, 0.70],
              labels: ["STABILITY", "EXECUTION", "REWORK"],
              pct: "78%", pctLabel: "EXECUTION",
              stats: [
                { name: "Budget Stability", val: "Strong", color: "#3ECB6F" },
                { name: "Rework Risk", val: "Moderate", color: "#FBBF24" },
                { name: "Execution Confidence", val: "74%", color: "#3ECB6F" },
              ],
            },
          ].map((pillar, i) => {
            const size = 160, cx = size / 2, cy = size / 2, r = 52, np = 3;
            const outerPts = Array.from({ length: np }, (_, j) => {
              const a = (j * 2 * Math.PI / np) - Math.PI / 2;
              return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
            });
            const innerPts = pillar.vals.map((v, j) => {
              const a = (j * 2 * Math.PI / np) - Math.PI / 2;
              return { x: cx + r * v * Math.cos(a), y: cy + r * v * Math.sin(a) };
            });
            const labelPts = outerPts.map((p, j) => ({
              x: cx + (r + 18) * Math.cos((j * 2 * Math.PI / np) - Math.PI / 2),
              y: cy + (r + 18) * Math.sin((j * 2 * Math.PI / np) - Math.PI / 2),
            }));
            const poly = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

            return (
              <div key={i} className="card" style={{
                background: T.surface, border: "1px solid " + T.border2,
                borderRadius: "16px", padding: "1.75rem",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: pillar.color }} />
                <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.04em", color: pillar.color, marginBottom: "0.5rem", textTransform: "uppercase" }}>{pillar.n}</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.4rem", color: T.text, lineHeight: 1.3 }}>{pillar.title}</div>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.4rem" }}>
                  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
                    <polygon points={poly(outerPts)} fill="none" stroke={pillar.color} strokeWidth="1" opacity="0.25"/>
                    <polygon points={poly(innerPts)} fill={pillar.color} fillOpacity="0.16" stroke={pillar.color} strokeWidth="1.5"/>
                    {outerPts.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r="4" fill={pillar.color} opacity="0.3"/>)}
                    {innerPts.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r="3" fill={pillar.color}/>)}
                    {labelPts.map((p, j) => (
                      <text key={j} x={p.x.toFixed(1)} y={p.y.toFixed(1)} textAnchor="middle" fontSize="6" fontFamily="system-ui" fill={T.textDim} dominantBaseline="middle">{pillar.labels[j]}</text>
                    ))}
                    <text x={cx} y={cy - 4} textAnchor="middle" fontSize="20" fontFamily="Georgia, serif" fill={pillar.color} fontWeight="700">{pillar.pct}</text>
                    <text x={cx} y={cy + 11} textAnchor="middle" fontSize="7" fontFamily="system-ui" fill={T.textDim} letterSpacing="0.05em">{pillar.pctLabel}</text>
                  </svg>
                </div>
                {pillar.stats.map((s, j) => (
                  <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", padding: "0.4rem 0", borderBottom: j < pillar.stats.length - 1 ? "1px solid " + T.border : "none" }}>
                    <span style={{ color: T.textMid }}>{s.name}</span>
                    <span style={{ fontWeight: 700, color: s.color }}>{s.val}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {/* PM TOOLS VS PATHFLO */}
      <section style={{ padding: "80px 2rem", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "780px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div style={{ fontSize: "0.7rem", color: T.green, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem" }}>THE DIFFERENCE</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              Most PM tools are systems of record.<br />
              <em style={{ color: T.green, fontStyle: "italic" }}><Logo color={T.green} size={28} /> Pathflo is a system of intelligence.</em>
            </h2>
          </div>
          <div style={{ background: T.surface, border: "1px solid " + T.border2, borderRadius: "16px", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              <div className="comp-header" style={{ padding: "1rem 1.5rem", background: T.surface2, fontSize: "0.75rem", fontWeight: 700, color: T.textMid, letterSpacing: "0.1em" }}>OTHER PM TOOLS</div>
              <div className="comp-header" style={{ padding: "1rem 1.5rem", background: T.greenDim, fontSize: "0.75rem", fontWeight: 700, color: T.green, letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Logo color={T.green} size={14} />Pathflo
              </div>
            </div>
            {comparison.map(({ pm, pathflo }, i) => (
              <div key={i} className="comp-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid " + T.border }}>
                <div className="comp-cell" style={{ padding: "1rem 1.5rem", fontSize: "0.88rem", color: T.textMid, display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                  <span style={{ color: "#F87171", flexShrink: 0, fontSize: "0.72rem" }}>✕</span>{pm}
                </div>
                <div className="comp-cell comp-right" style={{ padding: "1rem 1.5rem", fontSize: "0.88rem", color: T.text, display: "flex", gap: "0.6rem", alignItems: "flex-start", transition: "background 0.2s" }}>
                  <span style={{ color: T.green, flexShrink: 0, fontSize: "0.72rem" }}>✓</span>{pathflo}
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.88rem", color: T.textDim, lineHeight: 1.7 }}>
            Companies do not buy PM tools for task management. They buy predictability, speed to delivery, and confidence that the plan will actually work.
          </p>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "80px 2rem 100px", maxWidth: "1000px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <div style={{ fontSize: "0.7rem", color: T.green, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem" }}>PRICING</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>
            Start free. Upgrade when it pays for itself.
          </h2>
          <p style={{ color: T.textMid, fontSize: "1rem", fontWeight: 300 }}>Start free. Upgrade when it pays for itself.</p>
        </div>
        <div className="pgrid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
          {pricing.map(({ name, price, period, tag, desc, items, cta, primary }) => (
            <div key={name} className="card" style={{
              background: primary ? (dark ? "linear-gradient(135deg,#0F2B1A,#111511)" : "linear-gradient(135deg,#E8F5EE,#FFFFFF)") : T.surface,
              border: primary ? "1px solid " + T.green : "1px solid " + T.border2,
              borderRadius: "20px", padding: "2rem",
              position: "relative", overflow: "visible",
              boxShadow: primary ? (dark ? "0 0 0 1px #3ECB6F33, 0 20px 60px rgba(62,203,111,0.12)" : "0 0 0 1px #1E8A4533, 0 20px 60px rgba(30,138,69,0.1)") : T.shadow,
            }}>
              {tag && (
                <div style={{
                  position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
                  background: T.green, color: dark ? "#080A08" : "#FFFFFF",
                  fontWeight: 700, fontSize: "0.68rem", letterSpacing: "0.08em",
                  padding: "0.25rem 0.85rem", borderRadius: "100px", whiteSpace: "nowrap",
                }}>{tag}</div>
              )}
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: primary ? T.green : T.textMid, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem" }}>{name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.2rem", marginBottom: "0.5rem" }}>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: "3rem", fontWeight: 700, color: T.text, lineHeight: 1 }}>{price}</span>
                <span style={{ fontSize: "0.8rem", color: T.textDim }}>{period}</span>
              </div>
              <p style={{ fontSize: "0.85rem", color: T.textMid, lineHeight: 1.65, marginBottom: "1.5rem" }}>{desc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1.75rem" }}>
                {(items || []).map(item => (
                  <div key={item} style={{ display: "flex", gap: "0.75rem", fontSize: "0.87rem", color: T.text, alignItems: "flex-start" }}>
                    <span style={{ color: T.green, flexShrink: 0 }}>✓</span>
                    <span style={{ fontWeight: 300 }}>{item}</span>
                  </div>
                ))}
              </div>
              <a href="/app" className={primary ? "btnp" : "btns"} style={primary ? { ...btnPrimary, width: "100%", justifyContent: "center" } : { ...btnSecondary, width: "100%", justifyContent: "center" }}>
                {cta}
              </a>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.75rem", color: T.textDim }}>
          No credit card required for free plan. Cancel anytime.
        </p>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding: "80px 2rem 120px", textAlign: "center", borderTop: "1px solid " + T.border, position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "580px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2.2rem, 6vw, 3.8rem)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: "1.5rem" }}>
            Stop guessing.<br />
            <em style={{ color: T.green, fontStyle: "italic" }}>Start knowing.</em>
          </h2>
          <p style={{ color: T.textMid, fontSize: "1rem", lineHeight: 1.75, marginBottom: "2.5rem", fontWeight: 300 }}>
            <Logo color={T.green} size={14} /><span style={{ fontWeight: 500, color: T.text }}> Pathflo</span> gives every project a critical path, a risk score, and a leadership readout — in minutes, not hours.
          </p>
          <a href="/app" className="btnp" style={{ ...btnPrimary, fontSize: "1.05rem", padding: "1.1rem 2.5rem" }}>Build my first plan — it's free →</a>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid " + T.border, padding: "2rem 2.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Logo color={T.green} size={16} />
          <span style={{ fontSize: "0.75rem", color: T.textDim, fontWeight: 300 }}>© 2026 Pathflo. All rights reserved.</span>
        </div>
        <div style={{ display: "flex", gap: "1.75rem" }}>
          {["Privacy", "Terms", "Contact"].map(l => (
            <a key={l} href="#" style={{ fontSize: "0.75rem", color: T.textDim, textDecoration: "none", transition: "color 0.15s" }}
              onMouseOver={e => e.currentTarget.style.color = T.text}
              onMouseOut={e => e.currentTarget.style.color = T.textDim}
            >{l}</a>
          ))}
        </div>
      </footer>
    </main>
  );
}
