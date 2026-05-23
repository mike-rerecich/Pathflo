"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

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
  if (bufferDays >= 3) { verdict = "ON TRACK"; verdictColor = "#3ECB6F"; verdictSub = "You have " + bufferDays + " days of breathing room before your deadline."; }
  else if (bufferDays >= 0) { verdict = "AT RISK"; verdictColor = "#FBBF24"; verdictSub = "Only " + bufferDays + " day" + (bufferDays === 1 ? "" : "s") + " of buffer — one delay and your deadline moves."; }
  else { verdict = "DEADLINE OVERRUN"; verdictColor = "#F87171"; verdictSub = "Your plan runs " + Math.abs(bufferDays) + " days over. Something needs to change before work starts."; }

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
    primaryReason = bufferDays < 3 ? "The deadline is fixed and buffer is almost gone. You cannot add days — so something else has to give." : "Your timeline is tight relative to the volume of work mapped.";
  } else if (budgetScore >= timeScore && budgetScore >= scopeScore) {
    primaryConstraint = "BUDGET";
    primaryReason = "Budget is " + budget.toLowerCase() + " and adding resources is not a free move. The constraint is financial, not structural.";
  } else {
    primaryConstraint = "SCOPE";
    primaryReason = "There are " + tasks.length + " milestones" + (unowned > 0 ? " and " + unowned + " without a clear owner" : "") + ". The volume of work is what's creating pressure.";
  }

  const concOpportunity = tasks.find(t => !t.concurrent && t.predecessors.length && byId[t.id].slack === 0);
  const cutCandidate = [...tasks].filter(t => byId[t.id].slack === 0).sort((a, b) => tasks.filter(s => s.predecessors.includes(a.id)).length - tasks.filter(s => s.predecessors.includes(b.id)).length)[0];
  const unownedTask = tasks.find(t => !t.owner || t.owner.trim() === "" || t.owner === "UNASSIGNED");

  const scopeMove = cutCandidate
    ? "If you want to reduce scope — cut or defer \"" + cutCandidate.name + "\". It sits on the critical path but has the fewest downstream dependencies, so removing it saves " + cutCandidate.days + " day" + (cutCandidate.days > 1 ? "s" : "") + " without cascading into other work."
    : "If you want to reduce scope — review whether every milestone on the list is required for launch, or whether any can be deferred to phase two.";

  const timeMove = concOpportunity
    ? "If you want to compress the schedule — run \"" + concOpportunity.name + "\" at the same time as its predecessor instead of waiting for it to fully finish. This could buy back up to " + Math.floor(concOpportunity.days * 0.6) + " days at zero additional cost."
    : "If you want to compress the schedule — look for milestones with no shared dependencies and assign them to different owners so they run simultaneously.";

  const budgetMove = unownedTask
    ? "If you want to protect the budget — assign a dedicated owner to \"" + unownedTask.name + "\" today. Unowned milestones are where rework happens, and rework costs more than getting it right the first time."
    : "If you want to protect the budget — concentrate your QA effort on critical path milestones first. A mistake there ripples forward and compounds.";

  const recommendedMove = primaryConstraint === "TIME"
    ? (concOpportunity ? "Start with the schedule — running \"" + concOpportunity.name + "\" in parallel costs nothing and buys days immediately." : "Start with the schedule — find any two sequential milestones that can overlap and run them simultaneously.")
    : primaryConstraint === "BUDGET"
    ? "Start with scope — reducing what ships in this phase is cheaper than adding resources or extending the deadline."
    : "Start with the schedule — you have room to compress through concurrency before cutting anything from the plan.";

  const concOps = [];
  tasks.forEach(t => {
    if (!t.concurrent && t.predecessors.length && byId[t.id].slack === 0) {
      const pred = tasks.find(p => p.id === t.predecessors[0]);
      if (pred) concOps.push({ task: t.name, predecessor: pred.name, daysSaved: Math.floor((parseInt(t.days) || 1) * 0.5), reason: "\"" + t.name + "\" can start while \"" + pred.name + "\" is in final review — not after it's fully done. No dependency is broken." });
    }
  });
  tasks.forEach((t, i) => {
    if (i > 0 && byId[t.id].slack === 0 && !t.predecessors.length) {
      const prev = tasks[i - 1];
      if (!t.predecessors.includes(prev.id)) {
        concOps.push({ task: t.name, predecessor: prev.name, daysSaved: Math.floor((parseInt(t.days) || 1) * 0.4), reason: "\"" + t.name + "\" and \"" + prev.name + "\" have no dependency between them — they can run at the same time." });
      }
    }
  });

  return {
    tasks: Object.values(byId), projectDuration, bufferDays, verdict, verdictColor, verdictSub,
    projectedDate: projDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    availableDays, primaryConstraint, primaryReason, scopeMove, timeMove, budgetMove, recommendedMove,
    criticalPath: tasks.filter(t => byId[t.id].slack === 0).map(t => t.name),
    bottlenecks: tasks.filter(t => byId[t.id].slack === 0).map(t => ({ ...byId[t.id], dependents: tasks.filter(s => s.predecessors.includes(t.id)).length })).sort((a, b) => b.dependents - a.dependents).slice(0, 3),
    shuffleOps: concOps.slice(0, 3),
    startDate,
  };
}

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
      <div style={{ minWidth: 500 }}>
        <div style={{ display: "flex", marginLeft: 130, marginBottom: "0.5rem", position: "relative", height: 18 }}>
          {ticks.map(tick => (
            <div key={tick} style={{ position: "absolute", left: (tick / totalDays * 100) + "%", transform: "translateX(-50%)", fontSize: "0.58rem", color: "#4A5A4A", fontFamily: "monospace", whiteSpace: "nowrap" }}>{dayToDate(tick)}</div>
          ))}
        </div>
        {result.tasks.map((t, i) => {
          const isCritical = critSet.has(t.name);
          const barColor = isCritical ? "#3ECB6F" : t.slack < 3 ? "#FBBF24" : "#2E3D38";
          const pct = v => (v / totalDays * 100) + "%";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: "0.35rem", height: 30 }}>
              <div style={{ width: 130, flexShrink: 0, paddingRight: "0.6rem", fontSize: "0.68rem", color: isCritical ? "#3ECB6F" : "#8A9E8A", fontWeight: isCritical ? 600 : 400, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {isCritical && <span style={{ marginRight: 3, opacity: 0.7 }}>⬡</span>}{t.name}
              </div>
              <div style={{ flex: 1, position: "relative", height: "100%" }}>
                <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: 0, right: 0, height: 2, background: "#1E251E" }} />
                {t.slack > 0 && <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: pct(t.es), width: pct(t.ef - t.es + t.slack), height: 10, background: "#1A2420", borderRadius: 2, opacity: 0.5 }} />}
                <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: pct(t.es), width: pct(t.ef - t.es), height: 20, background: barColor, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 6 }}>
                  {(t.ef - t.es) / totalDays > 0.1 && <span style={{ fontSize: "0.58rem", color: "#080A08", fontWeight: 700, padding: "0 4px" }}>{t.days}d</span>}
                </div>
                {t.milestone && <div style={{ position: "absolute", top: "50%", left: pct(t.ef), transform: "translate(-50%, -50%) rotate(45deg)", width: 9, height: 9, background: isCritical ? "#3ECB6F" : "#FBBF24", border: "2px solid #080A08" }} />}
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: "1.25rem", marginLeft: 130, marginTop: "0.75rem" }}>
          {[{ c: "#3ECB6F", l: "Critical path" }, { c: "#FBBF24", l: "Limited buffer" }, { c: "#2E3D38", l: "Float available" }].map(({ c, l }) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <div style={{ width: 12, height: 4, background: c, borderRadius: 2 }} />
              <span style={{ fontSize: "0.63rem", color: "#4A5A4A" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState(null);
  const [result, setResult] = useState(null);
  const [aiReadout, setAiReadout] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const raw = searchParams.get("data");
    if (!raw) return;
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      setData(parsed);
      const r = computeCPM(parsed.tasks, parsed.startDate, parsed.targetDate, parsed.budget || "Flexible");
      setResult(r);
      setAiLoading(true);
      fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectData: parsed }) })
        .then(res => res.json()).then(d => { setAiReadout(d.readout || null); setAiLoading(false); }).catch(() => setAiLoading(false));
    } catch (e) { console.error(e); }
  }, []);

  if (!data || !result) return <div style={{ minHeight: "100vh", background: "#080A08", display: "flex", alignItems: "center", justifyContent: "center", color: "#8A9E8A", fontFamily: "system-ui" }}>Loading your results...</div>;

  const C = {
    bg: "#080A08", surface: "#111511", surface2: "#161A16",
    border: "#1E251E", border2: "#252D25",
    text: "#EEF2EE", textMid: "#8A9E8A", textDim: "#4A5A4A",
    green: "#3ECB6F", greenDim: "#0F2B1A", greenMid: "#1A4A28",
    warn: "#FBBF24", danger: "#F87171", info: "#818CF8",
    radius: "16px", radiusSm: "10px",
  };

  const verdictColor = result.verdict === "ON TRACK" ? C.green : result.verdict === "AT RISK" ? C.warn : C.danger;
  const constraintColor = { TIME: C.warn, SCOPE: C.info, BUDGET: C.danger }[result.primaryConstraint] || C.green;

  const hasBudget = data.totalBudget && data.totalBudget !== "";
  const budgetNum = hasBudget ? parseFloat(data.totalBudget.replace(/[^0-9.]/g, "")) : 0;
  const taskCosts = data.tasks.map(t => parseFloat((t.cost || "0").replace(/[^0-9.]/g, "")) || 0);
  const totalTaskCost = taskCosts.reduce((a, b) => a + b, 0);
  const dailyBurn = budgetNum > 0 && result.projectDuration > 0 ? budgetNum / result.projectDuration : 0;
  const overrunCost = result.bufferDays < 0 ? Math.abs(result.bufferDays) * dailyBurn : 0;

  const tabs = [
    { id: 0, label: "Overview" },
    { id: 1, label: "Diagnosis" },
    ...(hasBudget ? [{ id: 2, label: "Financials" }] : []),
    { id: 3, label: "Readout" },
    { id: 4, label: "Details" },
  ];

  const Card = ({ children, style = {} }) => (
    <div style={{ background: C.surface, border: "1px solid " + C.border2, borderRadius: C.radius, padding: "1.5rem", marginBottom: "1rem", ...style }}>
      {children}
    </div>
  );

  const SectionTitle = ({ children, color = C.textMid }) => (
    <div style={{ fontSize: "0.75rem", fontWeight: 600, color, marginBottom: "0.5rem", letterSpacing: "0.02em" }}>{children}</div>
  );

  const Divider = () => <div style={{ height: 1, background: C.border, margin: "1rem 0" }} />;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:ital,opsz,wght@0,9..144,300;1,9..144,300&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #252D25; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotBlink { 0%,80%,100%{opacity:0} 40%{opacity:1} }
        .tab-btn { transition: all 0.2s; white-space: nowrap; }
        .tab-btn:hover { color: #EEF2EE !important; }
        .ms-badge-warn { background: #FB923C; color: #080A08; }
        .ms-badge-ok { background: #3ECB6F; color: #080A08; }
      `}</style>

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100vh", background: "radial-gradient(ellipse 80% 40% at 50% -10%, rgba(62,203,111,0.07) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(8,10,8,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid " + C.border }}>
        <div style={{ padding: "0 1.5rem", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 760, margin: "0 auto" }}>
          <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M4 24 C8 24 10 14 15 14 C20 14 22 6 26 6 C29 6 30 12 31 14" stroke="#3ECB6F" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <circle cx="4" cy="24" r="3" fill="#3ECB6F"/>
              <circle cx="31" cy="14" r="2.5" fill="#3ECB6F" opacity="0.9"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: "1rem", color: C.text }}>Path<span style={{ color: C.green, fontWeight: 300 }}>flo</span></span>
          </a>
          <a href="/app" style={{ fontSize: "0.78rem", color: C.textMid, textDecoration: "none", border: "1px solid " + C.border2, borderRadius: "100px", padding: "0.35rem 0.85rem" }}>New project</a>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", overflowX: "auto", padding: "0 1.5rem", maxWidth: 760, margin: "0 auto", gap: "0", scrollbarWidth: "none" }}>
          {tabs.map(tab => (
            <button key={tab.id} className="tab-btn" onClick={() => setActiveTab(tab.id)} style={{
              background: "transparent", border: "none", borderBottom: activeTab === tab.id ? "2px solid " + C.green : "2px solid transparent",
              color: activeTab === tab.id ? C.green : C.textDim,
              fontFamily: "inherit", fontSize: "0.82rem", fontWeight: activeTab === tab.id ? 600 : 400,
              padding: "0.75rem 1.25rem", cursor: "pointer",
            }}>{tab.label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "1.5rem 1.5rem 6rem", position: "relative", zIndex: 1 }}>

        {/* PROJECT NAME */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.62rem", color: C.textDim, fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: "0.2rem" }}>PROJECT ANALYSIS</div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.5rem, 4vw, 2.2rem)", fontWeight: 300, letterSpacing: "-0.02em" }}>{data.name}</h1>
        </div>

        {/* ── TAB 0: OVERVIEW ── */}
        {activeTab === 0 && (
          <div style={{ animation: "fadeUp 0.3s ease both" }}>

            {/* Status Banner */}
            <Card style={{ border: "1px solid " + verdictColor, boxShadow: "0 0 0 1px " + verdictColor + "40, 0 16px 60px rgba(0,0,0,0.5)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, transparent, " + verdictColor + ", transparent)" }} />
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(1.8rem, 5vw, 2.4rem)", color: verdictColor, lineHeight: 1.1, marginBottom: "0.4rem", fontWeight: 300 }}>{result.verdict}</div>
              <div style={{ fontSize: "0.95rem", color: C.textMid, marginBottom: "0.75rem", lineHeight: 1.6, fontWeight: 300 }}>{result.verdictSub}</div>

              {/* Killer line */}
              <div style={{ background: verdictColor + "12", border: "1px solid " + verdictColor + "30", borderRadius: C.radiusSm, padding: "0.7rem 1rem", marginBottom: "1.25rem" }}>
                <div style={{ fontSize: "0.68rem", color: verdictColor, fontWeight: 600, marginBottom: "0.2rem", letterSpacing: "0.04em" }}>Highest-impact move right now</div>
                <div style={{ fontSize: "0.88rem", color: C.text, lineHeight: 1.6, fontWeight: 300 }}>{result.recommendedMove}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                {[
                  { label: "Projected finish", val: result.projectedDate },
                  { label: "Total work days", val: result.projectDuration + " days" },
                  { label: "Buffer", val: result.bufferDays >= 0 ? result.bufferDays + " days" : Math.abs(result.bufferDays) + " days over" },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <div style={{ fontSize: "0.58rem", color: C.textDim, fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.2rem" }}>{label}</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1rem", color: C.text, fontWeight: 300 }}>{val}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Gantt */}
            <Card>
              <SectionTitle color={C.green}>Timeline</SectionTitle>
              <p style={{ fontSize: "0.82rem", color: C.textDim, marginBottom: "1.25rem", lineHeight: 1.6, fontWeight: 300 }}>
                Green milestones are on the critical path — if any one of them slips, your finish date moves by the same amount. Amber means there's some room but not much.
              </p>
              <GanttChart tasks={data.tasks} result={result} startDate={data.startDate} />
            </Card>

            {/* Critical path pills */}
            <Card>
              <SectionTitle>The chain that controls your deadline</SectionTitle>
              <p style={{ fontSize: "0.82rem", color: C.textDim, marginBottom: "0.85rem", lineHeight: 1.6, fontWeight: 300 }}>These milestones are linked end to end. A slip in any one of them cascades into everything that follows.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
                {result.criticalPath.map((name, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ background: C.greenDim, border: "1px solid " + C.greenMid, borderRadius: "100px", color: C.green, fontSize: "0.75rem", padding: "0.2rem 0.7rem", fontWeight: 500 }}>{name}</span>
                    {i < result.criticalPath.length - 1 && <span style={{ color: C.green, opacity: 0.35, fontSize: "0.8rem" }}>→</span>}
                  </span>
                ))}
              </div>
            </Card>

          </div>
        )}

        {/* ── TAB 1: DIAGNOSIS ── */}
        {activeTab === 1 && (
          <div style={{ animation: "fadeUp 0.3s ease both" }}>
            <Card>
              <SectionTitle color={constraintColor}>What's driving the pressure</SectionTitle>
              <p style={{ fontSize: "0.95rem", color: C.text, lineHeight: 1.75, marginBottom: "0.75rem", fontWeight: 300 }}>
                Every project has one dominant constraint. Yours is <strong style={{ color: constraintColor }}>{result.primaryConstraint}</strong>.
              </p>
              <p style={{ fontSize: "0.88rem", color: C.textMid, lineHeight: 1.7, fontWeight: 300, marginBottom: "1.25rem" }}>{result.primaryReason}</p>

              {/* Pillar pills */}
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                {["SCOPE", "TIME", "BUDGET"].map(k => {
                  const isActive = k === result.primaryConstraint;
                  const col = { TIME: C.warn, SCOPE: C.info, BUDGET: C.danger }[k];
                  return (
                    <div key={k} style={{ background: isActive ? col + "15" : C.surface2, border: "1px solid " + (isActive ? col : C.border), borderRadius: "100px", padding: "0.3rem 1rem", fontSize: "0.72rem", fontWeight: isActive ? 700 : 400, color: isActive ? col : C.textDim, letterSpacing: "0.06em" }}>
                      {k}{isActive ? " ←" : ""}
                    </div>
                  );
                })}
              </div>

              <Divider />

              {/* Three moves — conversational */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {[
                  { color: C.info, text: result.scopeMove },
                  { color: C.warn, text: result.timeMove },
                  { color: C.danger, text: result.budgetMove },
                ].map(({ color, text }, i) => (
                  <p key={i} style={{ fontSize: "0.9rem", color: C.textMid, lineHeight: 1.75, fontWeight: 300, paddingLeft: "1rem", borderLeft: "2px solid " + color + "50" }}>{text}</p>
                ))}
              </div>

              <Divider />

              <div style={{ background: C.greenDim, border: "1px solid " + C.greenMid, borderRadius: C.radiusSm, padding: "1rem 1.1rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: C.green, marginBottom: "0.4rem", letterSpacing: "0.04em" }}>Our recommendation</div>
                <p style={{ fontSize: "0.9rem", color: C.text, lineHeight: 1.7, fontWeight: 300 }}>{result.recommendedMove}</p>
              </div>
            </Card>

            {/* Shuffle */}
            {data.wantsShuffle && result.shuffleOps.length > 0 && (
              <Card>
                <SectionTitle color={C.warn}>Ways to reorder and save time</SectionTitle>
                <p style={{ fontSize: "0.82rem", color: C.textDim, marginBottom: "1rem", lineHeight: 1.6, fontWeight: 300 }}>
                  These milestones can run simultaneously or start earlier without breaking any dependencies. Each one is a real opportunity — not a suggestion to work faster.
                </p>
                {result.shuffleOps.map((op, i) => (
                  <div key={i} style={{ padding: "1rem 0", borderBottom: i < result.shuffleOps.length - 1 ? "1px solid " + C.border : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.35rem" }}>
                      <div style={{ fontSize: "0.9rem", fontWeight: 600, color: C.text }}>{op.task}</div>
                      <div style={{ fontSize: "0.72rem", color: C.warn, fontFamily: "monospace", marginLeft: "1rem", flexShrink: 0 }}>~{op.daysSaved}d back</div>
                    </div>
                    <p style={{ fontSize: "0.84rem", color: C.textMid, lineHeight: 1.65, fontWeight: 300 }}>{op.reason}</p>
                  </div>
                ))}
              </Card>
            )}

            {/* Bottlenecks */}
            {result.bottlenecks.length > 0 && (
              <Card>
                <SectionTitle>Where delays are most likely to hit</SectionTitle>
                <p style={{ fontSize: "0.82rem", color: C.textDim, marginBottom: "1rem", lineHeight: 1.6, fontWeight: 300 }}>
                  These milestones have zero buffer. If anything upstream is late, they get pushed — and everything after them gets pushed too.
                </p>
                {result.bottlenecks.map((t, i) => (
                  <div key={i} style={{ padding: "0.85rem 0", borderBottom: i < result.bottlenecks.length - 1 ? "1px solid " + C.border : "none", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: "0.9rem", fontWeight: 600, color: C.text, marginBottom: "0.2rem" }}>{t.name}</div>
                      <div style={{ fontSize: "0.78rem", color: C.textDim }}>
                        {t.owner} · {t.days} days · no buffer{t.dependents > 0 ? " · " + t.dependents + " milestone" + (t.dependents > 1 ? "s" : "") + " waiting on this" : ""}
                      </div>
                    </div>
                    <div style={{ fontSize: "0.65rem", color: C.warn, fontFamily: "monospace", flexShrink: 0, marginLeft: "1rem", paddingTop: "0.1rem" }}>Day {t.es + 1}</div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {/* ── TAB 2: FINANCIALS ── */}
        {activeTab === 2 && hasBudget && (
          <div style={{ animation: "fadeUp 0.3s ease both" }}>
            <Card>
              <SectionTitle color={result.bufferDays < 0 ? C.danger : C.green}>Budget picture</SectionTitle>
              <p style={{ fontSize: "0.88rem", color: C.textMid, lineHeight: 1.7, marginBottom: "1.25rem", fontWeight: 300 }}>
                {result.bufferDays < 0
                  ? "Your plan currently runs " + Math.abs(result.bufferDays) + " days over. At your burn rate of $" + Math.round(dailyBurn).toLocaleString() + " per day, that's an estimated $" + Math.round(overrunCost).toLocaleString() + " in additional cost if nothing changes."
                  : "Your plan is within budget with " + result.bufferDays + " days of breathing room. At $" + Math.round(dailyBurn).toLocaleString() + " per day burn rate, you have a financial buffer of approximately $" + Math.round(result.bufferDays * dailyBurn).toLocaleString() + "."}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
                {[
                  { label: "Total budget", val: data.totalBudget, color: C.text },
                  { label: "Mapped costs", val: totalTaskCost > 0 ? "$" + totalTaskCost.toLocaleString() : "Not entered", color: C.text },
                  { label: "Daily burn", val: dailyBurn > 0 ? "$" + Math.round(dailyBurn).toLocaleString() + "/day" : "N/A", color: C.textMid },
                  { label: "Overrun exposure", val: overrunCost > 0 ? "$" + Math.round(overrunCost).toLocaleString() : result.bufferDays >= 0 ? "None projected" : "N/A", color: overrunCost > 0 ? C.danger : C.green },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: C.surface2, border: "1px solid " + C.border, borderRadius: C.radiusSm, padding: "0.85rem 1rem" }}>
                    <div style={{ fontSize: "0.6rem", color: C.textDim, fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: "0.3rem" }}>{label.toUpperCase()}</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", color, fontWeight: 300 }}>{val}</div>
                  </div>
                ))}
              </div>

              {data.tasks.filter(t => t.cost).length > 0 && (
                <>
                  <Divider />
                  <SectionTitle>Cost by milestone</SectionTitle>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.75rem" }}>
                    {data.tasks.filter(t => t.cost).map((t, i) => {
                      const cost = parseFloat((t.cost || "0").replace(/[^0-9.]/g, "")) || 0;
                      const pct = totalTaskCost > 0 ? cost / totalTaskCost : 0;
                      return (
                        <div key={i}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                            <span style={{ fontSize: "0.84rem", color: C.textMid, fontWeight: 300 }}>{t.name}</span>
                            <span style={{ fontSize: "0.84rem", color: C.text, fontFamily: "monospace" }}>{t.cost}</span>
                          </div>
                          <div style={{ height: 5, background: C.border, borderRadius: 3 }}>
                            <div style={{ height: "100%", width: (pct * 100) + "%", background: C.green, borderRadius: 3 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </Card>
          </div>
        )}

        {/* ── TAB 3: READOUT ── */}
        {activeTab === 3 && (
          <div style={{ animation: "fadeUp 0.3s ease both" }}>
            <Card>
              <SectionTitle color="#85D44A">Leadership readout</SectionTitle>
              <p style={{ fontSize: "0.82rem", color: C.textDim, marginBottom: "1.25rem", lineHeight: 1.6, fontWeight: 300 }}>
                Written to be forwarded. Copy and paste this directly into an email, a Slack message, or a client update.
              </p>
              {aiLoading ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "1rem 0" }}>
                  <span style={{ fontSize: "0.72rem", color: C.textDim, fontWeight: 300 }}>Writing your readout</span>
                  {[0,1,2].map(i => <span key={i} style={{ width: 4, height: 4, background: C.green, borderRadius: "50%", display: "inline-block", animation: "dotBlink 1.4s " + (i * 0.22) + "s infinite" }} />)}
                </div>
              ) : aiReadout ? (
                <div style={{ fontSize: "0.95rem", color: C.text, lineHeight: 1.9, fontWeight: 300, fontFamily: "'Fraunces', serif" }}>{aiReadout}</div>
              ) : (
                <p style={{ fontSize: "0.88rem", color: C.textDim, fontStyle: "italic", fontWeight: 300 }}>Add your Anthropic API key in Vercel environment variables to generate the AI readout.</p>
              )}
            </Card>
          </div>
        )}

        {/* ── TAB 4: DETAILS ── */}
        {activeTab === 4 && (
          <div style={{ animation: "fadeUp 0.3s ease both" }}>
            <Card>
              <SectionTitle>All milestones</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {result.tasks.map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0", borderBottom: i < result.tasks.length - 1 ? "1px solid " + C.border : "none", gap: "0.75rem" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.88rem", color: t.slack === 0 ? C.green : C.text, fontWeight: t.slack === 0 ? 600 : 400, marginBottom: "0.15rem" }}>
                        {t.slack === 0 && <span style={{ marginRight: "0.35rem", opacity: 0.7 }}>⬡</span>}{t.name}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: C.textDim }}>{t.owner} · {t.days} day{t.days > 1 ? "s" : ""} · starts day {t.es + 1}</div>
                    </div>
                    <span className={t.slack === 0 ? "ms-badge-warn" : "ms-badge-ok"} style={{ fontSize: "0.62rem", fontFamily: "monospace", borderRadius: 4, padding: "0.12rem 0.5rem", flexShrink: 0 }}>
                      {t.slack === 0 ? "no buffer" : t.slack + "d spare"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

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
