"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ── CPM ENGINE ───────────────────────────────────────────────────────────────
function computeCPM(tasks, startDate, targetDate, budget) {
  if (!tasks.length) return null;
  const byId = {};
  tasks.forEach(t => { byId[t.id] = { ...t, es: 0, ef: 0, ls: 0, lf: 0, slack: 0 }; });
  const visited = new Set();
  function forwardPass(id) {
    if (visited.has(id)) return byId[id].ef;
    visited.add(id);
    const t = byId[id];
    const predMax = t.predecessors.length ? Math.max(...t.predecessors.map(pid => forwardPass(pid))) : 0;
    t.es = (t.concurrent && t.predecessors.length) ? byId[t.predecessors[0]].es : predMax;
    t.ef = t.es + (parseInt(t.days) || 1);
    return t.ef;
  }
  tasks.forEach(t => forwardPass(t.id));
  const projectDuration = Math.max(...tasks.map(t => byId[t.id].ef));
  const visited2 = new Set();
  function backwardPass(id) {
    if (visited2.has(id)) return;
    visited2.add(id);
    const t = byId[id];
    const successors = tasks.filter(s => s.predecessors.includes(id) && !s.concurrent);
    if (successors.length) { t.lf = Math.min(...successors.map(s => byId[s.id].ls)); t.ls = t.lf - (parseInt(t.days) || 1); }
    t.slack = Math.max(0, t.ls - t.es);
    t.predecessors.forEach(pid => backwardPass(pid));
  }
  const sinks = tasks.filter(t => !tasks.some(s => s.predecessors.includes(t.id)));
  sinks.forEach(t => { byId[t.id].lf = projectDuration; byId[t.id].ls = projectDuration - (parseInt(t.days) || 1); byId[t.id].slack = 0; backwardPass(t.id); });
  tasks.forEach(t => { byId[t.id].slack = Math.max(0, byId[t.id].ls - byId[t.id].es); });

  const start = new Date(startDate);
  const target = new Date(targetDate);
  const availableDays = Math.round((target - start) / 86400000);
  const bufferDays = availableDays - projectDuration;

  let verdict, verdictColor, verdictSub;
  if (bufferDays >= 3) { verdict = "ON TRACK"; verdictColor = "#3ECB6F"; verdictSub = "You have " + bufferDays + " days of breathing room."; }
  else if (bufferDays >= 0) { verdict = "AT RISK"; verdictColor = "#FBBF24"; verdictSub = "Only " + bufferDays + " day" + (bufferDays === 1 ? "" : "s") + " of buffer. One delay could blow your deadline."; }
  else { verdict = "DEADLINE OVERRUN"; verdictColor = "#F87171"; verdictSub = "Your plan runs " + Math.abs(bufferDays) + " days over. Something needs to change."; }

  const projDate = new Date(start);
  projDate.setDate(projDate.getDate() + projectDuration);

  const tightness = availableDays > 0 ? projectDuration / availableDays : 2;
  const unowned = tasks.filter(t => !t.owner || t.owner === "UNASSIGNED").length;
  const timeScore = tightness >= 0.85 ? 3 : tightness >= 0.65 ? 2 : 1;
  const budgetScore = budget === "Fixed" ? 3 : budget === "Tight" ? 2 : 1;
  const scopeScore = (tasks.length + unowned) / 4;

  let primaryConstraint, primaryReason;
  if (timeScore >= budgetScore && timeScore >= scopeScore) {
    primaryConstraint = "TIME";
    primaryReason = bufferDays < 3 ? "Deadline is the hard constraint with minimal buffer." : "Timeline is tight relative to task volume.";
  } else if (budgetScore >= timeScore && budgetScore >= scopeScore) {
    primaryConstraint = "BUDGET";
    primaryReason = "Budget is " + budget.toLowerCase() + " — adding resources is constrained.";
  } else {
    primaryConstraint = "SCOPE";
    primaryReason = tasks.length + " milestones" + (unowned > 0 ? " with " + unowned + " unowned" : "") + " — work volume is the pressure point.";
  }

  const concOpportunity = tasks.find(t => !t.concurrent && t.predecessors.length && byId[t.id].slack === 0);
  const cutCandidate = [...tasks].filter(t => byId[t.id].slack === 0).sort((a, b) => tasks.filter(s => s.predecessors.includes(a.id)).length - tasks.filter(s => s.predecessors.includes(b.id)).length)[0];
  const unownedTask = tasks.find(t => !t.owner || t.owner.trim() === "" || t.owner === "UNASSIGNED");

  const scopeLever = cutCandidate ? "Cut or defer \"" + cutCandidate.name + "\" — fewest downstream dependencies on the critical path. Saves " + cutCandidate.days + " day" + (cutCandidate.days > 1 ? "s" : "") + "." : "Review whether all " + tasks.length + " milestones are required for this phase.";
  const timeLever = concOpportunity ? "Run \"" + concOpportunity.name + "\" in parallel with its predecessor. Could compress the schedule by up to " + Math.floor(concOpportunity.days * 0.6) + " days at no extra cost." : "Look for milestones with no shared dependencies that can run simultaneously.";
  const budgetLever = unownedTask ? "Assign a dedicated owner to \"" + unownedTask.name + "\" — unowned milestones are the most common source of budget overrun." : "Focus QA and review effort on critical path milestones first to prevent costly rework.";
  const recommendedMove = primaryConstraint === "TIME" ? (concOpportunity ? "Run \"" + concOpportunity.name + "\" in parallel — costs nothing and buys days." : "Find overlapping milestones to compress the schedule.") : primaryConstraint === "BUDGET" ? "Cut scope before adding resources — it is cheaper and faster." : "Compress through concurrency before cutting any milestones.";

  // ── SHUFFLE OPPORTUNITIES ─────────────────────────────────────────────────
  const shuffleOps = [];
  tasks.forEach(t => {
    if (!t.concurrent && t.predecessors.length && byId[t.id].slack === 0) {
      const pred = tasks.find(p => p.id === t.predecessors[0]);
      if (pred) shuffleOps.push({ task: t.name, predecessor: pred.name, daysSaved: Math.floor((parseInt(t.days) || 1) * 0.5), reason: "Can start while " + pred.name + " is in final review, not after full completion." });
    }
  });
  tasks.forEach((t, i) => {
    if (i > 0 && byId[t.id].slack === 0 && !t.predecessors.length) {
      const prev = tasks[i - 1];
      if (!t.predecessors.includes(prev.id)) {
        shuffleOps.push({ task: t.name, predecessor: prev.name, daysSaved: Math.floor((parseInt(t.days) || 1) * 0.4), reason: "No dependency between these milestones — they can run simultaneously." });
      }
    }
  });

  return {
    tasks: Object.values(byId), projectDuration, bufferDays, verdict, verdictColor, verdictSub,
    projectedDate: projDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    availableDays, primaryConstraint, primaryReason, scopeLever, timeLever, budgetLever, recommendedMove,
    criticalPath: tasks.filter(t => byId[t.id].slack === 0).map(t => t.name),
    bottlenecks: tasks.filter(t => byId[t.id].slack === 0).map(t => ({ ...byId[t.id], dependents: tasks.filter(s => s.predecessors.includes(t.id)).length })).sort((a, b) => b.dependents - a.dependents).slice(0, 3),
    shuffleOps: shuffleOps.slice(0, 3),
    startDate,
  };
}

// ── GANTT CHART ───────────────────────────────────────────────────────────────
function GanttChart({ tasks, result, startDate }) {
  if (!result || !tasks.length) return null;
  const totalDays = result.projectDuration + Math.max(result.bufferDays, 0) + 2;
  const start = new Date(startDate);

  function dayToDate(day) {
    const d = new Date(start);
    d.setDate(d.getDate() + day);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const tickInterval = totalDays <= 14 ? 1 : totalDays <= 30 ? 5 : totalDays <= 60 ? 7 : 14;
  const ticks = [];
  for (let i = 0; i <= totalDays; i += tickInterval) ticks.push(i);

  const critSet = new Set(result.criticalPath);

  return (
    <div style={{ overflowX: "auto", paddingBottom: "0.5rem" }}>
      <div style={{ minWidth: 560 }}>
        {/* Header ticks */}
        <div style={{ display: "flex", marginLeft: 140, marginBottom: "0.5rem", position: "relative", height: 20 }}>
          {ticks.map(tick => (
            <div key={tick} style={{ position: "absolute", left: (tick / totalDays * 100) + "%", transform: "translateX(-50%)", fontSize: "0.6rem", color: "#4A5A4A", fontFamily: "monospace", whiteSpace: "nowrap" }}>
              {dayToDate(tick)}
            </div>
          ))}
        </div>

        {/* Task rows */}
        {result.tasks.map((t, i) => {
          const isCritical = critSet.has(t.name);
          const barColor = isCritical ? "#3ECB6F" : t.slack < 3 ? "#FBBF24" : "#2E3D38";
          const floatColor = "#1A2420";
          const pct = (v) => (v / totalDays * 100) + "%";

          return (
            <div key={t.id || i} style={{ display: "flex", alignItems: "center", marginBottom: "0.4rem", height: 32 }}>
              {/* Label */}
              <div style={{ width: 140, flexShrink: 0, paddingRight: "0.75rem", fontSize: "0.72rem", color: isCritical ? "#3ECB6F" : "#8A9E8A", fontWeight: isCritical ? 600 : 400, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {isCritical && <span style={{ marginRight: 4, opacity: 0.7 }}>⬡</span>}
                {t.name}
              </div>

              {/* Bar area */}
              <div style={{ flex: 1, position: "relative", height: "100%" }}>
                {/* Background track */}
                <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: 0, right: 0, height: 2, background: "#1E251E" }} />

                {/* Float bar */}
                {t.slack > 0 && (
                  <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: pct(t.es), width: pct(t.ef - t.es + t.slack), height: 12, background: floatColor, borderRadius: 2, opacity: 0.5 }} />
                )}

                {/* Task bar */}
                <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: pct(t.es), width: pct(t.ef - t.es), height: 20, background: barColor, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 6 }}>
                  {(t.ef - t.es) / totalDays > 0.08 && (
                    <span style={{ fontSize: "0.6rem", color: "#080A08", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", padding: "0 4px" }}>{t.days}d</span>
                  )}
                </div>

                {/* Milestone diamond */}
                {t.milestone && (
                  <div style={{ position: "absolute", top: "50%", left: pct(t.ef), transform: "translate(-50%, -50%) rotate(45deg)", width: 10, height: 10, background: isCritical ? "#3ECB6F" : "#FBBF24", border: "2px solid #080A08" }} />
                )}
              </div>
            </div>
          );
        })}

        {/* Today line */}
        <div style={{ position: "relative", marginLeft: 140, height: 8 }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: "#F87171", opacity: 0.5 }} />
          <span style={{ position: "absolute", left: 4, top: 0, fontSize: "0.6rem", color: "#F87171", fontFamily: "monospace" }}>TODAY</span>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: "1.25rem", marginLeft: 140, marginTop: "0.75rem", flexWrap: "wrap" }}>
          {[{ color: "#3ECB6F", label: "Critical path" }, { color: "#FBBF24", label: "At risk" }, { color: "#2E3D38", label: "Float available" }].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <div style={{ width: 12, height: 4, background: color, borderRadius: 2 }} />
              <span style={{ fontSize: "0.65rem", color: "#4A5A4A" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── RESULTS CONTENT ───────────────────────────────────────────────────────────
function ResultsContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState(null);
  const [result, setResult] = useState(null);
  const [aiReadout, setAiReadout] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const raw = searchParams.get("data");
    if (!raw) return;
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      setData(parsed);
      const r = computeCPM(parsed.tasks, parsed.startDate, parsed.targetDate, parsed.budget || "Flexible");
      setResult(r);
      setAiLoading(true);
      fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectData: parsed }),
      }).then(res => res.json()).then(d => { setAiReadout(d.readout || null); setAiLoading(false); }).catch(() => setAiLoading(false));
    } catch (e) { console.error("Parse error", e); }
  }, []);

  if (!data || !result) return (
    <div style={{ minHeight: "100vh", background: "#080A08", display: "flex", alignItems: "center", justifyContent: "center", color: "#8A9E8A", fontFamily: "system-ui" }}>
      Loading your results...
    </div>
  );

  const T = {
    bg: "#080A08", surface: "#111511", surface2: "#161A16", border: "#1E251E", border2: "#252D25",
    text: "#EEF2EE", textMid: "#8A9E8A", textDim: "#4A5A4A",
    green: "#3ECB6F", greenDim: "#0F2B1A", greenMid: "#1A4A28",
    warn: "#FBBF24", danger: "#F87171", info: "#818CF8",
    radius: "16px", radiusSm: "10px",
    shadow: "0 4px 24px rgba(0,0,0,0.4)",
    shadowLg: "0 16px 60px rgba(0,0,0,0.6)",
  };

  const verdictAccent = result.verdict === "ON TRACK" ? T.green : result.verdict === "AT RISK" ? T.warn : T.danger;
  const cc = { TIME: T.warn, SCOPE: T.info, BUDGET: T.danger };

  const Card = ({ children, style = {} }) => (
    <div style={{ background: T.surface, border: "1px solid " + T.border2, borderRadius: T.radius, padding: "1.5rem", marginBottom: "1rem", ...style }}>
      {children}
    </div>
  );

  const SectionLabel = ({ color = T.green, children }) => (
    <div style={{ fontSize: "0.62rem", color, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.75rem", fontFamily: "monospace" }}>
      {children}
    </div>
  );

  const hasBudget = data.totalBudget && data.totalBudget !== "";
  const budgetNum = hasBudget ? parseFloat(data.totalBudget.replace(/[^0-9.]/g, "")) : 0;
  const taskCosts = data.tasks.map(t => parseFloat((t.cost || "0").replace(/[^0-9.]/g, "")) || 0);
  const totalTaskCost = taskCosts.reduce((a, b) => a + b, 0);
  const dailyBurn = budgetNum > 0 && result.projectDuration > 0 ? budgetNum / result.projectDuration : 0;
  const overrunCost = result.bufferDays < 0 ? Math.abs(result.bufferDays) * dailyBurn : 0;

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:ital,opsz,wght@0,9..144,300;1,9..144,300&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #252D25; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotBlink { 0%,80%,100%{opacity:0} 40%{opacity:1} }
      `}</style>

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100vh", background: "radial-gradient(ellipse 80% 40% at 50% -10%, rgba(62,203,111,0.08) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(8,10,8,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid " + T.border, padding: "0 1.5rem", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <path d="M4 24 C8 24 10 14 15 14 C20 14 22 6 26 6 C29 6 30 12 31 14" stroke="#3ECB6F" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <circle cx="4" cy="24" r="3" fill="#3ECB6F"/>
            <circle cx="31" cy="14" r="2.5" fill="#3ECB6F" opacity="0.9"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: T.text }}>Path<span style={{ color: T.green, fontWeight: 300 }}>flo</span></span>
        </a>
        <a href="/app" style={{ fontSize: "0.8rem", color: T.textMid, textDecoration: "none", border: "1px solid " + T.border2, borderRadius: "100px", padding: "0.4rem 1rem" }}>
          Plan new project
        </a>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.5rem 6rem", position: "relative", zIndex: 1 }}>

        {/* Project name */}
        <div style={{ marginBottom: "1.5rem", animation: "fadeUp 0.5s ease both" }}>
          <div style={{ fontSize: "0.65rem", color: T.textDim, fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>PROJECT ANALYSIS</div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 300, letterSpacing: "-0.02em" }}>{data.name}</h1>
        </div>

        {/* 1 — STATUS BANNER */}
        <Card style={{ border: "1px solid " + verdictAccent, boxShadow: "0 0 0 1px " + verdictAccent + ", " + T.shadowLg, position: "relative", overflow: "hidden", animation: "fadeUp 0.5s 0.05s ease both" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, transparent, " + verdictAccent + ", transparent)" }} />
          <div style={{ fontFamily: "monospace", fontSize: "0.58rem", color: T.textDim, letterSpacing: "0.15em", marginBottom: "0.4rem" }}>
            {data.name.toUpperCase()} · PROJECT STATUS
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.8rem, 5vw, 2.6rem)", color: verdictAccent, lineHeight: 1.1, marginBottom: "0.5rem", fontWeight: 300 }}>
            {result.verdict}
          </div>
          <div style={{ fontSize: "0.88rem", color: T.textMid, marginBottom: "1.5rem", lineHeight: 1.6 }}>{result.verdictSub}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
            {[
              { label: "Projected finish", val: result.projectedDate },
              { label: "Total work days", val: result.projectDuration + " days" },
              { label: "Buffer", val: result.bufferDays >= 0 ? result.bufferDays + " days" : Math.abs(result.bufferDays) + " days over" },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize: "0.58rem", color: T.textDim, fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.2rem" }}>{label}</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1rem", color: T.text, fontWeight: 300 }}>{val}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* 2 — GANTT CHART */}
        <Card style={{ animation: "fadeUp 0.5s 0.1s ease both" }}>
          <SectionLabel>Visual Timeline</SectionLabel>
          <div style={{ fontSize: "0.75rem", color: T.textDim, marginBottom: "1.25rem", lineHeight: 1.5 }}>
            Green bars are on the critical path — if any slip, your finish date slips. Amber bars have limited buffer.
          </div>
          <GanttChart tasks={data.tasks} result={result} startDate={data.startDate} />
        </Card>

        {/* 3 — TRIANGLE DIAGNOSIS */}
        <Card style={{ animation: "fadeUp 0.5s 0.15s ease both" }}>
          <SectionLabel color={cc[result.primaryConstraint]}>Triangle Diagnosis</SectionLabel>
          <div style={{ fontSize: "0.75rem", color: T.textDim, marginBottom: "1rem", lineHeight: 1.5 }}>
            Every project has one dominant constraint. Here is yours — and a concrete lever for each pillar.
          </div>

          {/* Pillars */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.6rem", marginBottom: "1rem" }}>
            {["SCOPE", "TIME", "BUDGET"].map(k => {
              const isActive = k === result.primaryConstraint;
              const c = cc[k];
              return (
                <div key={k} style={{ background: isActive ? c + "12" : T.surface2, border: "1px solid " + (isActive ? c : T.border), borderRadius: T.radiusSm, padding: "0.65rem", textAlign: "center" }}>
                  <div style={{ fontSize: "0.62rem", fontFamily: "monospace", color: isActive ? c : T.textDim, letterSpacing: "0.1em", fontWeight: isActive ? 700 : 400 }}>{k}</div>
                  {isActive && <div style={{ fontSize: "0.55rem", color: c, fontFamily: "monospace", marginTop: "0.2rem" }}>PRIMARY</div>}
                </div>
              );
            })}
          </div>

          <div style={{ background: cc[result.primaryConstraint] + "10", border: "1px solid " + cc[result.primaryConstraint] + "30", borderRadius: T.radiusSm, padding: "0.85rem 1rem", marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.58rem", fontFamily: "monospace", color: cc[result.primaryConstraint], letterSpacing: "0.1em", marginBottom: "0.3rem" }}>PRIMARY CONSTRAINT: {result.primaryConstraint}</div>
            <div style={{ fontSize: "0.85rem", color: T.text, lineHeight: 1.6 }}>{result.primaryReason}</div>
          </div>

          {[
            { icon: "◈", label: "SCOPE lever", text: result.scopeLever, c: T.info },
            { icon: "⏱", label: "TIME lever", text: result.timeLever, c: T.warn },
            { icon: "◎", label: "BUDGET lever", text: result.budgetLever, c: T.danger },
          ].map(({ icon, label, text, c }, i, arr) => (
            <div key={label} style={{ display: "flex", gap: "0.75rem", padding: "0.7rem 0", borderBottom: i < arr.length - 1 ? "1px solid " + T.border : "none" }}>
              <div style={{ color: c, flexShrink: 0, width: 20, fontFamily: "monospace" }}>{icon}</div>
              <div>
                <div style={{ fontSize: "0.58rem", fontFamily: "monospace", color: c, letterSpacing: "0.1em", marginBottom: "0.2rem" }}>{label}</div>
                <div style={{ fontSize: "0.84rem", color: T.textMid, lineHeight: 1.65 }}>{text}</div>
              </div>
            </div>
          ))}

          <div style={{ marginTop: "1rem", background: T.greenDim, border: "1px solid " + T.greenMid, borderRadius: T.radiusSm, padding: "0.85rem 1rem", display: "flex", gap: "0.6rem" }}>
            <span style={{ color: T.green }}>→</span>
            <div>
              <div style={{ fontSize: "0.58rem", fontFamily: "monospace", color: T.green, letterSpacing: "0.1em", marginBottom: "0.2rem" }}>RECOMMENDED MOVE</div>
              <div style={{ fontSize: "0.86rem", color: T.text, lineHeight: 1.6 }}>{result.recommendedMove}</div>
            </div>
          </div>
        </Card>

        {/* 4 — SHUFFLE OPPORTUNITIES */}
        {data.wantsShuffle && result.shuffleOps.length > 0 && (
          <Card style={{ animation: "fadeUp 0.5s 0.2s ease both" }}>
            <SectionLabel color={T.warn}>Shuffle Opportunities</SectionLabel>
            <div style={{ fontSize: "0.75rem", color: T.textDim, marginBottom: "1rem", lineHeight: 1.5 }}>
              These milestones can be reordered or run simultaneously without breaking dependencies.
            </div>
            {result.shuffleOps.map((op, i) => (
              <div key={i} style={{ background: T.surface2, border: "1px solid rgba(251,191,36,0.15)", borderRadius: T.radiusSm, padding: "1rem", marginBottom: i < result.shuffleOps.length - 1 ? "0.6rem" : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.35rem" }}>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600, color: T.text }}>{op.task}</div>
                  <div style={{ fontSize: "0.65rem", fontFamily: "monospace", color: T.warn, flexShrink: 0, marginLeft: "1rem" }}>~{op.daysSaved}d saved</div>
                </div>
                <div style={{ fontSize: "0.8rem", color: T.textMid, lineHeight: 1.6 }}>{op.reason}</div>
              </div>
            ))}
          </Card>
        )}

        {/* 5 — BUDGET INTELLIGENCE */}
        {hasBudget && (
          <Card style={{ animation: "fadeUp 0.5s 0.25s ease both" }}>
            <SectionLabel color={result.bufferDays < 0 ? T.danger : T.green}>Budget Intelligence</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              {[
                { label: "Total budget", val: data.totalBudget, color: T.text },
                { label: "Mapped milestone costs", val: totalTaskCost > 0 ? "$" + totalTaskCost.toLocaleString() : "Not entered", color: T.text },
                { label: "Daily burn rate", val: dailyBurn > 0 ? "$" + Math.round(dailyBurn).toLocaleString() + "/day" : "N/A", color: T.textMid },
                { label: "Overrun cost", val: overrunCost > 0 ? "$" + Math.round(overrunCost).toLocaleString() : result.bufferDays >= 0 ? "None projected" : "N/A", color: overrunCost > 0 ? T.danger : T.green },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: T.surface2, border: "1px solid " + T.border, borderRadius: T.radiusSm, padding: "0.85rem 1rem" }}>
                  <div style={{ fontSize: "0.58rem", fontFamily: "monospace", color: T.textDim, letterSpacing: "0.08em", marginBottom: "0.3rem" }}>{label.toUpperCase()}</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", color, fontWeight: 300 }}>{val}</div>
                </div>
              ))}
            </div>
            {data.tasks.filter(t => t.cost).length > 0 && (
              <div>
                <div style={{ fontSize: "0.62rem", fontFamily: "monospace", color: T.textDim, letterSpacing: "0.08em", marginBottom: "0.6rem" }}>COST PER MILESTONE</div>
                {data.tasks.filter(t => t.cost).map((t, i) => {
                  const cost = parseFloat((t.cost || "0").replace(/[^0-9.]/g, "")) || 0;
                  const pct = totalTaskCost > 0 ? cost / totalTaskCost : 0;
                  return (
                    <div key={i} style={{ marginBottom: "0.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                        <span style={{ fontSize: "0.82rem", color: T.textMid }}>{t.name}</span>
                        <span style={{ fontSize: "0.82rem", color: T.text, fontFamily: "monospace" }}>{t.cost}</span>
                      </div>
                      <div style={{ height: 4, background: T.border, borderRadius: 2 }}>
                        <div style={{ height: "100%", width: (pct * 100) + "%", background: T.green, borderRadius: 2, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* 6 — BOTTLENECKS */}
        {result.bottlenecks.length > 0 && (
          <Card style={{ animation: "fadeUp 0.5s 0.3s ease both" }}>
            <SectionLabel color={T.warn}>Top Bottlenecks</SectionLabel>
            <div style={{ fontSize: "0.75rem", color: T.textDim, marginBottom: "1rem", lineHeight: 1.5 }}>Zero buffer. Anything upstream running late pushes these — and everything after them.</div>
            {result.bottlenecks.map((t, i) => (
              <div key={i} style={{ background: T.surface2, border: "1px solid rgba(251,191,36,0.15)", borderRadius: T.radiusSm, padding: "0.85rem 1rem", marginBottom: i < result.bottlenecks.length - 1 ? "0.5rem" : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600, color: T.text }}>{t.name}</div>
                  <div style={{ fontSize: "0.58rem", fontFamily: "monospace", color: T.warn }}>Day {t.es + 1}</div>
                </div>
                <div style={{ fontSize: "0.75rem", fontFamily: "monospace", color: T.textDim }}>
                  {t.owner} · {t.days}d · No buffer{t.dependents > 0 ? " · " + t.dependents + " milestone" + (t.dependents > 1 ? "s" : "") + " waiting" : ""}
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* 7 — AI LEADERSHIP READOUT */}
        <Card style={{ animation: "fadeUp 0.5s 0.35s ease both" }}>
          <SectionLabel color="#85D44A">AI Leadership Readout</SectionLabel>
          <div style={{ fontSize: "0.75rem", color: T.textDim, marginBottom: "1rem", lineHeight: 1.5 }}>
            A 5-sentence executive summary you can forward to a client or share in a leadership meeting.
          </div>
          {aiLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "0.65rem", fontFamily: "monospace", color: T.textDim, letterSpacing: "0.1em" }}>GENERATING</span>
              {[0,1,2].map(i => <span key={i} style={{ width: 4, height: 4, background: T.green, borderRadius: "50%", display: "inline-block", animation: "dotBlink 1.4s " + (i * 0.22) + "s infinite" }} />)}
            </div>
          ) : aiReadout ? (
            <div style={{ fontSize: "0.86rem", color: T.textMid, lineHeight: 1.85, whiteSpace: "pre-wrap", borderTop: "1px solid " + T.border, paddingTop: "1rem" }}>{aiReadout}</div>
          ) : (
            <div style={{ fontSize: "0.82rem", color: T.textDim, fontStyle: "italic" }}>Add your Anthropic API key in Vercel environment variables to enable AI readout.</div>
          )}
        </Card>

        {/* All milestones */}
        <Card style={{ animation: "fadeUp 0.5s 0.4s ease both" }}>
          <SectionLabel>All Milestones</SectionLabel>
          {result.tasks.map((t, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.75rem", alignItems: "center", padding: "0.45rem 0", borderBottom: i < result.tasks.length - 1 ? "1px solid " + T.border : "none" }}>
              <div style={{ fontSize: "0.84rem", color: t.slack === 0 ? T.green : T.text }}>
                {t.slack === 0 && <span style={{ marginRight: "0.35rem", opacity: 0.7 }}>⬡</span>}
                {t.name}
              </div>
              <div style={{ fontSize: "0.65rem", fontFamily: "monospace", color: T.textDim }}>{t.days}d · {t.owner}</div>
              {t.slack === 0 ? (
                <span style={{ fontSize: "0.62rem", fontFamily: "monospace", color: "#080A08", background: "#FB923C", borderRadius: 4, padding: "0.1rem 0.45rem", whiteSpace: "nowrap" }}>no buffer</span>
              ) : (
                <span style={{ fontSize: "0.62rem", fontFamily: "monospace", color: "#080A08", background: T.green, borderRadius: 4, padding: "0.1rem 0.45rem", whiteSpace: "nowrap" }}>{t.slack}d spare</span>
              )}
            </div>
          ))}
        </Card>

      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#080A08", display: "flex", alignItems: "center", justifyContent: "center", color: "#8A9E8A", fontFamily: "system-ui" }}>Loading...</div>}>
      <ResultsContent />
    </Suspense>
  );
}
