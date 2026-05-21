"use client";
import { useState, useEffect } from "react";

export default function Home() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const green = "#3ECB6F";
  const bg = "#0A0D0B";
  const surface = "#111510";
  const border = "#1E2820";
  const border2 = "#263330";
  const textMid = "#8FA898";
  const textDim = "#4A5E52";
  const greenDim = "#152B1E";
  const text = "#E4EDE7";

  const pill = {
    display: "inline-flex", alignItems: "center", gap: "0.5rem",
    background: greenDim, border: "1px solid #3ECB6F44",
    borderRadius: "100px", padding: "0.3rem 0.85rem",
    fontSize: "0.72rem", color: green, letterSpacing: "0.1em",
  };

  const ctaPrimary = {
    background: green, color: "#0A0D0B", border: "2px solid #000",
    fontWeight: 700, fontSize: "0.95rem", padding: "0.85rem 2rem",
    cursor: "pointer", borderRadius: "6px", textDecoration: "none",
    display: "inline-flex", alignItems: "center", gap: "0.5rem",
    fontFamily: "inherit",
  };

  const ctaSecondary = {
    background: "transparent", color: textMid,
    border: "1px solid #263330",
    fontWeight: 500, fontSize: "0.9rem", padding: "0.85rem 1.75rem",
    cursor: "pointer", borderRadius: "6px", textDecoration: "none",
    display: "inline-flex", alignItems: "center", fontFamily: "inherit",
  };

  const pricingCards = [
    {
      name: "Solo", price: "$49", period: "/month",
      desc: "For independent contractors and consultants.",
      features: ["Unlimited projects", "Critical path analysis", "Triangle Diagnosis", "Leadership readout", "Risk scoring"],
      featured: false,
    },
    {
      name: "Team", price: "$99", period: "/month",
      desc: "For agencies and small teams delivering client work.",
      features: ["Everything in Solo", "Up to 10 team members", "Shared project access", "Team dashboards", "Priority support"],
      featured: true,
    },
    {
      name: "Business", price: "$299", period: "/month",
      desc: "For growing agencies managing multiple teams.",
      features: ["Everything in Team", "Unlimited members", "Client-facing readouts", "Custom risk weights", "Dedicated onboarding"],
      featured: false,
    },
  ];

  const steps = [
    { step: "01", title: "Enter your tasks", desc: "Name each task, assign an owner, set a duration. Pathflo walks you through it one question at a time." },
    { step: "02", title: "Map dependencies", desc: "Tell Pathflo what needs to happen before each task can start. It finds what can run in parallel." },
    { step: "03", title: "Get your risk score", desc: "Pathflo calculates your critical path, scores risk across 5 dimensions, and flags what will blow your deadline." },
    { step: "04", title: "Pull the right lever", desc: "The Triangle Diagnosis tells you if you are Scope, Time, or Budget constrained and gives you one move to fix it." },
  ];

  const stats = [
    { val: "5 min", label: "to your first risk score" },
    { val: "3 pillars", label: "scope, time, budget" },
    { val: "0 guesses", label: "backed by dependency logic" },
  ];

  return (
    <main style={{ background: bg, color: text, fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100vh", background: "radial-gradient(ellipse 70% 45% at 50% -5%, rgba(62,203,111,0.13) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "0 2rem", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", background: scrolled ? "rgba(10,13,11,0.95)" : "transparent", borderBottom: scrolled ? "1px solid #1E2820" : "1px solid transparent", backdropFilter: "blur(16px)", transition: "all 0.3s" }}>
        <svg width="120" height="30" viewBox="0 0 128 32" fill="none">
          <path d="M5 24 C9 24 11 16 15 16 C19 16 21 8 25 8 C29 8 31 16 34 16" stroke="#3ECB6F" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <circle cx="5" cy="24" r="3" fill="#3ECB6F" />
          <circle cx="15" cy="16" r="3" fill="#3ECB6F" opacity="0.7" />
          <circle cx="25" cy="8" r="3" fill="#3ECB6F" opacity="0.5" />
          <circle cx="34" cy="16" r="3" fill="#3ECB6F" opacity="0.85" />
          <text x="46" y="22" fontFamily="sans-serif" fontWeight="700" fontSize="17" fill="#E4EDE7">Path</text>
          <text x="86" y="22" fontFamily="sans-serif" fontWeight="300" fontSize="17" fill="#3ECB6F">flo</text>
        </svg>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <a href="#pricing" style={{ color: textMid, fontSize: "0.85rem", textDecoration: "none" }}>Pricing</a>
          <a href="/app" style={{ ...ctaPrimary, padding: "0.5rem 1.25rem", fontSize: "0.82rem" }}>Launch app</a>
        </div>
      </nav>

      <section style={{ position: "relative", zIndex: 1, padding: "160px 2rem 100px", maxWidth: "720px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <span style={pill}>NOW LIVE — PLAN YOUR FIRST PROJECT FREE</span>
        </div>
        <h1 style={{ fontSize: "clamp(2.4rem, 7vw, 4.5rem)", fontWeight: 700, lineHeight: 1.1, marginBottom: "1.5rem", letterSpacing: "-0.02em" }}>
          Know what will break
          <br />
          <span style={{ color: green }}>your deadline</span>
          <br />
          before it does.
        </h1>
        <p style={{ fontSize: "clamp(1rem, 2.5vw, 1.15rem)", color: textMid, lineHeight: 1.7, maxWidth: "520px", margin: "0 auto 2.5rem" }}>
          Pathflo maps your project dependencies, scores risk, and gives you a confidence-backed completion date before a single task starts.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/app" style={{ ...ctaPrimary, fontSize: "1rem", padding: "1rem 2.25rem" }}>Plan my first project</a>
          <a href="#how-it-works" style={ctaSecondary}>See how it works</a>
        </div>
        <div style={{ marginTop: "3rem", display: "flex", justifyContent: "center", gap: "2.5rem", flexWrap: "wrap" }}>
          {stats.map(({ val, label }) => (
            <div key={val} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", color: green, fontWeight: 700, marginBottom: "0.2rem" }}>{val}</div>
              <div style={{ fontSize: "0.65rem", color: textDim, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" style={{ padding: "80px 2rem", maxWidth: "800px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "0.65rem", color: green, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "0.75rem" }}>How it works</div>
          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)", fontWeight: 700, lineHeight: 1.25 }}>From tasks to execution clarity in under 5 minutes.</h2>
        </div>
        {steps.map(({ step, title, desc }, i) => (
          <div key={step} style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: "1.5rem", padding: "2rem 0", borderBottom: i < 3 ? "1px solid #1E2820" : "none" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: greenDim, border: "1px solid #3ECB6F33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", color: green, margin: "0 auto 0.4rem" }}>o</div>
              <div style={{ fontSize: "0.6rem", color: textDim, letterSpacing: "0.1em" }}>{step}</div>
            </div>
            <div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.5rem" }}>{title}</h3>
              <p style={{ fontSize: "0.9rem", color: textMid, lineHeight: 1.7 }}>{desc}</p>
            </div>
          </div>
        ))}
      </section>

      <section id="pricing" style={{ padding: "80px 2rem 100px", maxWidth: "900px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "0.65rem", color: green, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "0.75rem" }}>Pricing</div>
          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)", fontWeight: 700, lineHeight: 1.25, marginBottom: "0.75rem" }}>One blown deadline costs more than a year of Pathflo.</h2>
          <p style={{ color: textMid, fontSize: "0.9rem" }}>Start free. Upgrade when it earns it.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>
          {pricingCards.map(({ name, price, period, desc, features, featured }) => (
            <div key={name} style={{ background: surface, border: featured ? "1px solid #3ECB6F" : "1px solid #1E2820", borderRadius: "12px", padding: "2rem", position: "relative", boxShadow: featured ? "0 0 0 1px #3ECB6F, 0 20px 60px rgba(62,203,111,0.1)" : "none" }}>
              {featured && (
                <div style={{ position: "absolute", top: "-14px", left: "50%", transform: "translateX(-50%)", background: green, color: "#0A0D0B", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", padding: "0.25rem 0.85rem", borderRadius: "100px", border: "2px solid #000", whiteSpace: "nowrap" }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ fontSize: "0.65rem", color: featured ? green : textDim, letterSpacing: "0.12em", marginBottom: "1rem" }}>{name.toUpperCase()}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "2.5rem", fontWeight: 700 }}>{price}</span>
                <span style={{ fontSize: "0.7rem", color: textDim }}>{period}</span>
              </div>
              <p style={{ fontSize: "0.82rem", color: textMid, lineHeight: 1.6, marginBottom: "1.5rem" }}>{desc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", marginBottom: "2rem" }}>
                {features.map(f => (
                  <div key={f} style={{ display: "flex", gap: "0.6rem", fontSize: "0.84rem", color: textMid }}>
                    <span style={{ color: green, flexShrink: 0 }}>v</span>{f}
                  </div>
                ))}
              </div>
              <a href="/app" style={featured ? { ...ctaPrimary, width: "100%", justifyContent: "center" } : { ...ctaSecondary, width: "100%", justifyContent: "center" }}>
                Start free trial
              </a>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "60px 2rem 100px", textAlign: "center", borderTop: "1px solid #1E2820", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "520px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 700, lineHeight: 1.2, marginBottom: "1.25rem" }}>
            Plan smarter.
            <br />
            <span style={{ color: green }}>Deliver on time.</span>
          </h2>
          <p style={{ color: textMid, fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "2.5rem" }}>
            Operational clarity and execution predictability before work begins, not after things go wrong.
          </p>
          <a href="/app" style={{ ...ctaPrimary, fontSize: "1.05rem", padding: "1.1rem 2.5rem" }}>
            Plan my first project, free
          </a>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid #1E2820", padding: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: "0.65rem", color: textDim, letterSpacing: "0.1em" }}>2026 PATHFLO</div>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          <a href="#" style={{ fontSize: "0.65rem", color: textDim, textDecoration: "none" }}>Privacy</a>
          <a href="#" style={{ fontSize: "0.65rem", color: textDim, textDecoration: "none" }}>Terms</a>
          <a href="#" style={{ fontSize: "0.65rem", color: textDim, textDecoration: "none" }}>Contact</a>
        </div>
      </footer>

    </main>
  );
}