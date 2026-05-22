"use client";
import { useState, useEffect } from "react";

export default function Home() {
  const [dark, setDark] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const T = dark ? {
    bg: "#080A08", bg2: "#0D110D", surface: "#111511", surface2: "#161A16",
    border: "#1E251E", border2: "#252D25", text: "#EEF2EE", textMid: "#8A9E8A",
    textDim: "#4A5A4A", green: "#3ECB6F", greenDim: "#0F2B1A", greenMid: "#1A4A28",
    glow: "rgba(62,203,111,0.12)", shadow: "0 4px 24px rgba(0,0,0,0.5)",
    shadowLg: "0 16px 64px rgba(0,0,0,0.6)", navBg: "rgba(8,10,8,0.85)",
    gradHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(62,203,111,0.15) 0%, transparent 65%)",
  } : {
    bg: "#F7F8F5", bg2: "#EEEEE9", surface: "#FFFFFF", surface2: "#F2F3EF",
    border: "#E2E4DC", border2: "#D4D6CC", text: "#0F140F", textMid: "#4A5A4A",
    textDim: "#8A9A8A", green: "#1E8A45", greenDim: "#E8F5EE", greenMid: "#C8E8D4",
    glow: "rgba(30,138,69,0.08)", shadow: "0 4px 24px rgba(0,0,0,0.08)",
    shadowLg: "0 16px 64px rgba(0,0,0,0.12)", navBg: "rgba(247,248,245,0.9)",
    gradHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(30,138,69,0.08) 0%, transparent 65%)",
  };

  const btnPrimary = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
    background: T.green, color: dark ? "#080A08" : "#FFFFFF",
    border: "none", borderRadius: "100px", fontFamily: "inherit", fontWeight: 700,
    fontSize: "0.95rem", padding: "0.9rem 2rem", cursor: "pointer", textDecoration: "none",
    boxShadow: dark ? "0 0 0 1px rgba(62,203,111,0.3), 0 8px 32px rgba(62,203,111,0.2)" : "0 4px 16px rgba(30,138,69,0.25)",
    transition: "transform 0.15s, box-shadow 0.15s",
  };

  const btnSecondary = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
    background: "transparent", color: T.textMid, border: "1.5px solid " + T.border2,
    borderRadius: "100px", fontFamily: "inherit", fontWeight: 500, fontSize: "0.95rem",
    padding: "0.9rem 2rem", cursor: "pointer", textDecoration: "none",
    transition: "border-color 0.15s, color 0.15s",
  };

  const steps = [
    { n: "01", title: "Enter your project", body: "Name your project, set your deadline, choose your project type. Pathflo takes 30 seconds to get started." },
    { n: "02", title: "Map what needs to happen", body: "Add tasks with owners and durations. Pathflo asks the dependency questions most people skip — and that is where projects fall apart." },
    { n: "03", title: "Get your execution picture", body: "Critical path. Risk score. Bottleneck detection. The three tasks most likely to blow your deadline, flagged before work begins." },
    { n: "04", title: "Pull the right lever", body: "Scope, Time, or Budget — Pathflo identifies your primary constraint and gives you one concrete move to resolve it." },
  ];

  const pricing = [
    { name: "Solo", price: "$49", period: "/mo", tag: null, desc: "For contractors and independent operators running projects without a formal team.", items: ["Unlimited projects", "Critical path analysis", "Risk scoring", "Triangle Diagnosis", "AI Leadership Readout"], cta: "Start free trial", primary: false },
    { name: "Team", price: "$99", period: "/mo", tag: "Most popular", desc: "For agencies and small teams delivering client work on tight timelines.", items: ["Everything in Solo", "Up to 10 members", "Shared project access", "Team risk dashboards", "Priority support"], cta: "Start free trial", primary: true },
    { name: "Business", price: "$299", period: "/mo", tag: null, desc: "For growing operations managing multiple teams and client portfolios.", items: ["Everything in Team", "Unlimited members", "Client-facing readouts", "Custom risk weights", "Dedicated onboarding"], cta: "Talk to us", primary: false },
  ];

  const pain = [
    "I do not know if we are on track until it is already too late.",
    "I got blindsided by a delay that was visible weeks earlier.",
    "I cannot confidently tell a client when we will be done.",
    "We have tasks but no real plan connecting them.",
    "I need a PMO but cannot afford one.",
  ];

  const logoPath = (color) => (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <path d="M4 24 C8 24 10 14 15 14 C20 14 22 6 26 6 C29 6 30 12 31 14" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <circle cx="4" cy="24" r="3" fill={color}/>
      <circle cx="15" cy="14" r="2.5" fill={color} opacity="0.7"/>
      <circle cx="26" cy="6" r="2.5" fill={color} opacity="0.5"/>
      <circle cx="31" cy="14" r="2.5" fill={color} opacity="0.9"/>
    </svg>
  );

  return (
    <main style={{ background: T.bg, color: T.text, fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: "100vh", transition: "background 0.3s, color 0.3s" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300;1,9..144,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #252D25; border-radius: 4px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .h1 { animation: fadeUp 0.7s 0.1s ease both; }
        .h2 { animation: fadeUp 0.7s 0.25s ease both; }
        .h3 { animation: fadeUp 0.7s 0.4s ease both; }
        .h4 { animation: fadeUp 0.7s 0.55s ease both; }
        .card { transition: border-color 0.2s, transform 0.2s; }
        .card:hover { transform: translateY(-3px); }
        .navlink { transition: color 0.15s; }
        .navlink:hover { color: #EEF2EE !important; }
        .btnp:hover { transform: translateY(-2px); }
        .btns:hover { border-color: #3ECB6F !important; color: #3ECB6F !important; }
        @media(max-width:768px) {
          .pgrid { grid-template-columns: 1fr !important; }
          .sgrid { grid-template-columns: 1fr !important; }
          .paingrid { grid-template-columns: 1fr !important; }
          .hbtns { flex-direction: column !important; align-items: center !important; }
          .navlinks { display: none !important; }
        }
      `}</style>

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100vh", background: T.gradHero, pointerEvents: "none", zIndex: 0, transition: "background 0.3s" }} />

      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, height: "68px", padding: "0 2.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: scrolled ? T.navBg : "transparent", borderBottom: scrolled ? "1px solid " + T.border : "1px solid transparent", backdropFilter: scrolled ? "blur(20px)" : "none", transition: "all 0.3s" }}>
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {logoPath(T.green)}
          <span style={{ fontWeight: 700, fontSize: "1.1rem", color: T.text, letterSpacing: "-0.02em" }}>
            Path<span style={{ color: T.green, fontWeight: 300 }}>flo</span>
          </span>
        </a>
        <div className="navlinks" style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <a className="navlink" href="#how-it-works" style={{ color: T.textMid, fontSize: "0.88rem", textDecoration: "none", fontWeight: 500 }}>How it works</a>
          <a className="navlink" href="#pricing" style={{ color: T.textMid, fontSize: "0.88rem", textDecoration: "none", fontWeight: 500 }}>Pricing</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button onClick={() => setDark(!dark)} title="Toggle theme" style={{ width: 44, height: 26, borderRadius: 100, background: dark ? T.green : T.border2, border: "none", cursor: "pointer", position: "relative", transition: "background 0.25s", flexShrink: 0 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: dark ? "#080A08" : "#fff", position: "absolute", top: 4, left: dark ? 22 : 4, transition: "left 0.25s", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px" }}>
              {dark ? "☽" : "☀"}
            </div>
          </button>
          <a href="/app" className="btnp" style={{ ...btnPrimary, padding: "0.6rem 1.4rem", fontSize: "0.85rem" }}>Launch app</a>
        </div>
      </nav>

      <section style={{ position: "relative", zIndex: 1, paddingTop: "160px", paddingBottom: "100px", paddingLeft: "2rem", paddingRight: "2rem", textAlign: "center", maxWidth: "780px", margin: "0 auto" }}>
        <div className="h1" style={{ marginBottom: "2rem" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: T.greenDim, border: "1px solid " + T.greenMid, borderRadius: "100px", padding: "0.4rem 1.1rem", fontSize: "0.72rem", color: T.green, fontWeight: 600, letterSpacing: "0.08em" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, animation: "pulse 2s infinite" }} />
            NOW LIVE — PLAN YOUR FIRST PROJECT FREE
          </span>
        </div>
        <h1 className="h2" style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(3rem, 8vw, 5.5rem)", fontWeight: 300, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: "1.25rem", color: T.text }}>
          Operational clarity.
          <br />
          <em style={{ color: T.green, fontStyle: "italic", fontWeight: 300 }}>Execution predictability.</em>
        </h1>
        <p className="h3" style={{ fontSize: "clamp(1rem, 2.5vw, 1.2rem)", color: T.textMid, lineHeight: 1.75, maxWidth: "540px", margin: "0 auto 2.5rem", fontWeight: 300 }}>
          Pathflo maps your project dependencies, scores risk, and tells you exactly what will break your deadline before work begins.
        </p>
        <div className="h4 hbtns" style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "4rem" }}>
          <a href="/app" className="btnp" style={{ ...btnPrimary, fontSize: "1rem", padding: "1rem 2.25rem" }}>Plan my first project</a>
          <a href="#how-it-works" className="btns" style={btnSecondary}>See how it works</a>
        </div>
        <div className="h4" style={{ display: "flex", justifyContent: "center", gap: "3.5rem", flexWrap: "wrap" }}>
          {[{ val: "5 min", label: "To your first risk score" }, { val: "3 pillars", label: "Scope, Time, Budget" }, { val: "0 guesses", label: "Backed by dependency logic" }].map(({ val, label }) => (
            <div key={val} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.75rem", fontWeight: 300, color: T.green, letterSpacing: "-0.02em", marginBottom: "0.2rem" }}>{val}</div>
              <div style={{ fontSize: "0.72rem", color: T.textDim, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "80px 2rem", maxWidth: "860px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "0.7rem", color: T.green, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "1rem" }}>Sound familiar?</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 300, lineHeight: 1.2, letterSpacing: "-0.02em" }}>Every delay was visible<br />from day one.</h2>
        </div>
        <div className="paingrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          {pain.map((text, i) => (
            <div key={i} className="card" style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: "16px", padding: "1.25rem 1.5rem", display: "flex", gap: "0.85rem", alignItems: "flex-start", gridColumn: i === 4 ? "1 / -1" : undefined }}>
              <span style={{ color: "#F87171", flexShrink: 0, fontSize: "1rem" }}>x</span>
              <span style={{ fontSize: "0.92rem", color: T.textMid, lineHeight: 1.65, fontWeight: 300 }}>{text}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" style={{ padding: "80px 2rem", maxWidth: "960px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <div style={{ fontSize: "0.7rem", color: T.green, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "1rem" }}>How it works</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 300, lineHeight: 1.2, letterSpacing: "-0.02em" }}>From tasks to execution clarity<br />in under 5 minutes.</h2>
        </div>
        <div className="sgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
          {steps.map(({ n, title, body }) => (
            <div key={n} className="card" style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: "20px", padding: "2rem" }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "2.5rem", fontWeight: 300, color: T.green, opacity: 0.4, lineHeight: 1, marginBottom: "1rem" }}>{n}</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: T.text, marginBottom: "0.6rem", letterSpacing: "-0.01em" }}>{title}</h3>
              <p style={{ fontSize: "0.88rem", color: T.textMid, lineHeight: 1.75, fontWeight: 300 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRIANGLE SECTION ── */}
      <section style={{ padding: "80px 2rem", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>

          {/* Headline block */}
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <div style={{ fontSize: "0.7rem", color: T.green, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "1rem" }}>The prescription</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 300, lineHeight: 1.2, letterSpacing: "-0.02em", marginBottom: "1.25rem" }}>
              Most tools tell you you are behind.
              <br />
              <em style={{ color: T.green, fontStyle: "italic" }}>Pathflo tells you why — and exactly what to do about it.</em>
            </h2>
            <p style={{ fontSize: "1rem", color: T.textMid, lineHeight: 1.75, maxWidth: "560px", margin: "0 auto", fontWeight: 300 }}>
              Every project has one dominant constraint. Scope. Time. Budget. Pathflo back-engineers your plan to find it, then gives you a concrete move for each pillar — so you walk away with a prescription, not just a diagnosis.
            </p>
          </div>

          {/* Three pillars */}
          <div className="sgrid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem", marginBottom: "2.5rem" }}>
            {[
              {
                icon: "◈",
                pillar: "Scope",
                color: "#818CF8",
                question: "Are you doing too much?",
                lever: "Pathflo identifies the tasks on your critical path with the fewest downstream dependencies — the ones you can cut or defer without cascading damage.",
                tag: "Cut or defer",
              },
              {
                icon: "⏱",
                pillar: "Time",
                color: T.green,
                question: "Is your deadline the hard constraint?",
                lever: "Pathflo finds the best parallelization opportunity in your task map — work that can run simultaneously instead of sequentially, compressing your timeline at zero cost.",
                tag: "Compress the schedule",
              },
              {
                icon: "◎",
                pillar: "Budget",
                color: "#FBBF24",
                question: "Can you not add resources?",
                lever: "Pathflo surfaces unowned bottleneck tasks and single-resource dependencies — the places where one targeted hire or reassignment removes the most risk.",
                tag: "Protect the envelope",
              },
            ].map(({ icon, pillar, color, question, lever, tag }) => (
              <div key={pillar} className="card" style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: "20px", padding: "2rem", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: color, opacity: 0.6 }} />
                <div style={{ fontSize: "1.5rem", color: color, marginBottom: "0.75rem" }}>{icon}</div>
                <div style={{ display: "inline-block", background: color + "18", border: "1px solid " + color + "40", borderRadius: "100px", padding: "0.2rem 0.75rem", fontSize: "0.65rem", fontWeight: 600, color: color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1rem" }}>{tag}</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: T.text, marginBottom: "0.4rem", letterSpacing: "-0.01em" }}>{pillar}</h3>
                <p style={{ fontSize: "0.8rem", color: color, fontWeight: 500, marginBottom: "0.85rem", fontStyle: "italic" }}>{question}</p>
                <p style={{ fontSize: "0.87rem", color: T.textMid, lineHeight: 1.75, fontWeight: 300 }}>{lever}</p>
              </div>
            ))}
          </div>

          {/* Bottom closer */}
          <div style={{ textAlign: "center", padding: "2.5rem", background: T.surface, border: "1px solid " + T.border, borderRadius: "20px" }}>
            <p style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.2rem, 3vw, 1.6rem)", fontWeight: 300, lineHeight: 1.4, color: T.text, marginBottom: "0.75rem", letterSpacing: "-0.02em" }}>
              When a project slips, it is always one of three things.
            </p>
            <p style={{ fontSize: "0.95rem", color: T.textMid, fontWeight: 300, lineHeight: 1.7 }}>
              Too much work. Not enough time. A budget that cannot flex.
              <br />
              Pathflo identifies your constraint before execution begins — and shows you what each lever is worth.
            </p>
          </div>

        </div>
      </section>

      <section id="pricing" style={{ padding: "80px 2rem 100px", maxWidth: "1000px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <div style={{ fontSize: "0.7rem", color: T.green, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "1rem" }}>Pricing</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 300, lineHeight: 1.2, letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>One blown deadline costs more<br />than a year of Pathflo.</h2>
          <p style={{ color: T.textMid, fontSize: "1rem", fontWeight: 300 }}>Start free. Upgrade when it earns it.</p>
        </div>
        <div className="pgrid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
          {pricing.map(({ name, price, period, tag, desc, items, cta, primary }) => (
            <div key={name} className="card" style={{ background: primary ? (dark ? "linear-gradient(135deg, #0F2B1A 0%, #0D110D 100%)" : "linear-gradient(135deg, #E8F5EE 0%, #F7F8F5 100%)") : T.surface, border: primary ? "1px solid " + T.green : "1px solid " + T.border, borderRadius: "24px", padding: "2.25rem", position: "relative", boxShadow: primary ? "0 0 0 1px " + T.green + ", 0 24px 80px rgba(62,203,111,0.15)" : T.shadow }}>
              {tag && <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: T.green, color: dark ? "#080A08" : "#fff", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", padding: "0.3rem 1rem", borderRadius: "100px", whiteSpace: "nowrap" }}>{tag.toUpperCase()}</div>}
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: primary ? T.green : T.textDim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1.25rem" }}>{name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.2rem", marginBottom: "0.75rem" }}>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: "3rem", fontWeight: 300, color: T.text, letterSpacing: "-0.03em", lineHeight: 1 }}>{price}</span>
                <span style={{ fontSize: "0.8rem", color: T.textDim }}>{period}</span>
              </div>
              <p style={{ fontSize: "0.85rem", color: T.textMid, lineHeight: 1.65, marginBottom: "1.75rem", fontWeight: 300, minHeight: "52px" }}>{desc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "2rem" }}>
                {items.map(item => (
                  <div key={item} style={{ display: "flex", gap: "0.75rem", fontSize: "0.87rem", color: T.textMid }}>
                    <span style={{ color: T.green, flexShrink: 0 }}>v</span>
                    <span style={{ fontWeight: 300 }}>{item}</span>
                  </div>
                ))}
              </div>
              <a href="/app" className={primary ? "btnp" : "btns"} style={primary ? { ...btnPrimary, width: "100%" } : { ...btnSecondary, width: "100%" }}>{cta}</a>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.75rem", color: T.textDim, fontWeight: 300 }}>No credit card required. Cancel any time.</p>
      </section>

      <section style={{ padding: "80px 2rem 120px", textAlign: "center", borderTop: "1px solid " + T.border, position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "580px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2.2rem, 6vw, 3.8rem)", fontWeight: 300, lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: "1.25rem" }}>
            Plan smarter.
            <br />
            <em style={{ color: T.green, fontStyle: "italic" }}>Deliver on time.</em>
          </h2>
          <p style={{ color: T.textMid, fontSize: "1rem", lineHeight: 1.75, marginBottom: "2.5rem", fontWeight: 300 }}>
            Operational clarity and execution predictability before work begins, not after things go wrong.
          </p>
          <a href="/app" className="btnp" style={{ ...btnPrimary, fontSize: "1.05rem", padding: "1.1rem 2.5rem" }}>Plan my first project, free</a>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid " + T.border, padding: "2rem 2.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", position: "relative", zIndex: 1 }}>
        <span style={{ fontSize: "0.75rem", color: T.textDim, fontWeight: 300 }}>2026 Pathflo. Operational clarity. Execution predictability.</span>
        <div style={{ display: "flex", gap: "1.75rem" }}>
          {["Privacy", "Terms", "Contact"].map(l => (
            <a key={l} href="#" style={{ fontSize: "0.75rem", color: T.textDim, textDecoration: "none", fontWeight: 300 }}>{l}</a>
          ))}
        </div>
      </footer>

    </main>
  );
}
