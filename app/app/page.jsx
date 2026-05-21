"use client";
import { useState, useEffect, useRef } from "react";

function computeCPM(tasks, startDate, targetDate, budget = "Flexible") {
  if (!tasks.length) return null;
  const byId = {};
  tasks.forEach(t => { byId[t.id] = { ...t, es: 0, ef: 0, ls: 0, lf: 0, slack: 0 }; });
  const visited = new Set();
  function forwardPass(id) {
    if (visited.has(id)) return byId[id].ef;
    visited.add(id);
    const t = byId[id];
    const predMax = t.predecessors.length ? Math.max(...t.predecessors.map(pid => forwardPass(pid))) : 0;
    if (t.concurrent && t.predecessors.length) { t.es = byId[t.predecessors[0]].es; } else { t.es = predMax; }
    t.ef = t.es + t.days;
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
    if (successors.length) { t.lf = Math.min(...successors.map(s => byId[s.id].ls)); t.ls = t.lf - t.days; }
    t.slack = Math.max(0, t.ls - t.es);
    t.predecessors.forEach(pid => backwardPass(pid));
  }
  const sinks = tasks.filter(t => !tasks.some(s => s.predecessors.includes(t.id)));
  sinks.forEach(t => { byId[t.id].lf = projectDuration; byId[t.id].ls = projectDuration - t.days; byId[t.id].slack = 0; backwardPass(t.id); });
  tasks.forEach(t => { byId[t.id].slack = Math.max(0, byId[t.id].ls - byId[t.id].es); });
  const criticalChain = tasks.filter(t => byId[t.id].slack === 0).map(t => t.name);
  const checkpoints = tasks.filter(t => t.milestone).map(m => ({ name: m.name, completesOnDay: byId[m.id].ef }));
  const riskTasks = tasks.filter(t => byId[t.id].slack === 0).map(t => ({ ...byId[t.id], dependentCount: tasks.filter(s => s.predecessors.includes(t.id)).length, startsOnDay: byId[t.id].es + 1 })).sort((a, b) => b.dependentCount - a.dependentCount).slice(0, 3);
  const start = new Date(startDate);
  const target = new Date(targetDate);
  const availableDays = Math.round((target - start) / (1000 * 60 * 60 * 24));
  const bufferDays = availableDays - projectDuration;
  let verdict, verdictBorder, verdictSub;
  if (bufferDays >= 3) { verdict = "ON TRACK"; verdictBorder = "#3ECB6F"; verdictSub = `You have ${bufferDays} days of breathing room before your deadline.`; }
  else if (bufferDays >= 0) { verdict = "AT RISK"; verdictBorder = "#FBBF24"; verdictSub = `Only ${bufferDays} day${bufferDays === 1 ? "" : "s"} of breathing room. One delay could blow your deadline.`; }
  else { verdict = "DEADLINE OVERRUN"; verdictBorder = "#F87171"; verdictSub = `Your tasks add up to ${Math.abs(bufferDays)} more days than you have. Something needs to change.`; }
  const projectedDate = new Date(start);
  projectedDate.setDate(projectedDate.getDate() + projectDuration);
  const timelineTightness = availableDays > 0 ? projectDuration / availableDays : 2;
  const unownedCount = tasks.filter(t => !t.owner || t.owner === "UNASSIGNED").length;
  const scopeScore = tasks.length + unownedCount;
  const timeScore = timelineTightness >= 0.85 ? 3 : timelineTightness >= 0.65 ? 2 : 1;
  const budgetScore = budget === "Fixed" ? 3 : budget === "Tight" ? 2 : 1;
  let primaryConstraint, primaryReason;
  if (timeScore >= budgetScore && timeScore >= scopeScore / 4) { primaryConstraint = "TIME"; primaryReason = bufferDays < 3 ? `Only ${bufferDays < 0 ? Math.abs(bufferDays) + " days over budget" : bufferDays + " days of buffer"}. The deadline is the hard constraint.` : "Timeline is tight relative to total task volume."; }
  else if (budgetScore >= timeScore && budgetScore >= scopeScore / 4) { primaryConstraint = "BUDGET"; primaryReason = `Budget is ${budget.toLowerCase()} and external dependencies are present.`; }
  else { primaryConstraint = "SCOPE"; primaryReason = `${tasks.length} tasks with ${unownedCount > 0 ? unownedCount + " unowned" : "spread ownership"} — the work volume is the pressure point.`; }
  const concurrentOpportunity = tasks.find(t => !t.concurrent && t.predecessors.length && byId[t.id].slack === 0);
  const cutCandidate = [...tasks].filter(t => byId[t.id].slack === 0).sort((a, b) => tasks.filter(s => s.predecessors.includes(a.id)).length - tasks.filter(s => s.predecessors.includes(b.id)).length)[0];
  const unownedTask = tasks.find(t => !t.owner || t.owner.trim() === "");
  const scopeLever = cutCandidate ? `Cut or defer "${cutCandidate.name}" — it's on the critical path but has the fewest downstream dependencies. Removing it saves ${cutCandidate.days} day${cutCandidate.days > 1 ? "s" : ""}.` : `Review whether all ${tasks.length} tasks are required for this phase.`;
  const timeLever = concurrentOpportunity ? `Run "${concurrentOpportunity.name}" in parallel with its predecessor instead of waiting. This could compress the schedule by up to ${Math.floor(concurrentOpportunity.days * 0.6)} days.` : `Look for tasks that share no dependencies and run them simultaneously.`;
  const budgetLever = unownedTask ? `Assign a dedicated owner to "${unownedTask.name}" — an unowned task is a budget leak waiting to happen.` : `Focus QA effort on critical path tasks first to prevent rework.`;
  const recommendedMove = primaryConstraint === "TIME" ? `Pull the TIME lever first — ${concurrentOpportunity ? `parallelizing "${concurrentOpportunity.name}" costs nothing and buys days.` : "find tasks that can overlap."}` : primaryConstraint === "BUDGET" ? `Pull the SCOPE lever first — reducing scope is cheaper than adding resources.` : `Pull the TIME lever — compress through concurrency before cutting anything.`;
  const triangleDiagnosis = { primaryConstraint, primaryReason, scopeLever, timeLever, budgetLever, recommendedMove };
  return { tasks: Object.values(byId), projectDuration, criticalChain, bufferDays, verdict, verdictBorder, verdictSub, checkpoints, riskTasks, projectedDate: projectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), availableDays, triangleDiagnosis };
}

const _store = {};
function saveProject(name, data) { _store[name] = { ...data, savedAt: new Date().toISOString() }; }
function loadProjects() { return { ..._store }; }

async function getAIReadout(projectData) {
  try {
    const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectData }) });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.readout ?? null;
  } catch (err) { console.error("AI readout failed:", err); return null; }
}

const S = { INTRO: "intro", START_DATE: "start_date", TARGET_DATE: "target_date", TASK_NAME: "task_name", TASK_DAYS: "task_days", TASK_OWNER: "task_owner", TASK_CHECKPOINT: "task_checkpoint", TASK_DEPENDS: "task_depends", TASK_PARALLEL: "task_parallel", ADD_MORE: "add_more", BUDGET: "budget", ANALYZING: "analyzing", RESULT: "result" };

const T = { bg: "#0D1210", surface: "#141C17", surface2: "#1A2420", card: "#1E2B25", border: "#263330", border2: "#2E3D38", green: "#3ECB6F", greenDim: "#1A3828", greenGlow: "rgba(62,203,111,0.07)", text: "#E4EDE7", textMid: "#8FA898", textDim: "#526158", accent: "#85D44A", radius: "10px", radiusSm: "6px", shadow: "0 2px 16px rgba(0,0,0,0.35)", shadowLg: "0 8px 40px rgba(0,0,0,0.5)", warn: "#FBBF24", danger: "#F87171" };

function VerdictScreen({ result, project, onNew, onSave, saved, aiReadout }) {
  const { verdict, verdictBorder, verdictSub, projectedDate, bufferDays, criticalChain, riskTasks, checkpoints, projectDuration, tasks, triangleDiagnosis } = result;
  const verdictAccent = verdict === "ON TRACK" ? T.green : verdict === "AT RISK" ? T.warn : T.danger;
  const Card = ({ children, style = {} }) => (<div style={{ background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.radius, boxShadow: T.shadow, padding: "1.25rem", marginBottom: "0.85rem", overflow: "hidden", ...style }}>{children}</div>);
  const SecLabel = ({ color = T.green, children }) => (<div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.58rem", color, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.4rem" }}>{children}</div>);
  return (
    <div style={{ animation: "fadeUp 0.5s ease both" }}>
      <Card style={{ border: `1px solid ${verdictAccent}`, boxShadow: `0 0 0 1px ${verdictAccent}, ${T.shadowLg}`, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg, transparent, ${verdictAccent}, transparent)` }} />
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.58rem", color: T.textDim, letterSpacing: "0.15em", marginBottom: "0.4rem" }}>{project.name.toUpperCase()} · PROJECT STATUS</div>
        <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(1.8rem,5vw,2.6rem)", color: verdictAccent, lineHeight: 1.1, marginBottom: "0.5rem" }}>{verdict}</div>
        <div style={{ fontSize: "0.86rem", color: T.textMid, lineHeight: 1.6, marginBottom: "1.25rem" }}>{verdictSub}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
          {[{ label: "Finishes on", val: projectedDate }, { label: "Total work days", val: `${projectDuration} days` }, { label: "Float", val: bufferDays >= 0 ? `${bufferDays} days` : `${Math.abs(bufferDays)} days over` }].map(({ label, val }) => (
            <div key={label}><div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.55rem", color: T.textDim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.2rem" }}>{label}</div><div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "1rem", color: T.text }}>{val}</div></div>
          ))}
        </div>
      </Card>
      <Card><SecLabel>Critical Path</SecLabel><div style={{ fontSize: "0.72rem", color: T.textDim, marginBottom: "0.75rem" }}>These tasks control your finish date. If any slips, your deadline slips.</div><div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>{criticalChain.map((name, i) => (<span key={i} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><span style={{ background: T.greenDim, border: "1.5px solid #000", outline: `1px solid ${T.green}`, borderRadius: "6px", color: T.green, fontFamily: "'DM Mono', monospace", fontSize: "0.62rem", padding: "0.2rem 0.55rem" }}>{name}</span>{i < criticalChain.length - 1 && <span style={{ color: T.green, opacity: 0.4 }}>→</span>}</span>))}</div></Card>
      {riskTasks.length > 0 && (<Card><SecLabel color={T.warn}>Bottlenecks</SecLabel><div style={{ fontSize: "0.72rem", color: T.textDim, marginBottom: "0.75rem" }}>No wiggle room. Upstream delays push everything after.</div>{riskTasks.map((t, i) => (<div key={i} style={{ background: T.surface2, border: `1px solid rgba(251,191,36,0.18)`, borderRadius: T.radiusSm, padding: "0.85rem 1rem", marginBottom: i < riskTasks.length - 1 ? "0.5rem" : 0 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}><div style={{ fontSize: "0.86rem", fontWeight: 600, color: T.text }}>{t.name}</div><div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.58rem", color: T.warn }}>Day {t.startsOnDay}</div></div><div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.6rem", color: T.textDim }}>{t.owner} · {t.days}d · No wiggle room{t.dependentCount > 0 && ` · ${t.dependentCount} waiting`}</div></div>))}</Card>)}
      {triangleDiagnosis && (() => {
        const { primaryConstraint, primaryReason, scopeLever, timeLever, budgetLever, recommendedMove } = triangleDiagnosis;
        const cc = { TIME: "#FBBF24", SCOPE: "#818CF8", BUDGET: "#F87171" };
        const col = cc[primaryConstraint] || T.green;
        return (<Card style={{ border: `1px solid ${col}22` }}>
          <SecLabel color={col}>Triangle Diagnosis</SecLabel>
          <div style={{ fontSize: "0.72rem", color: T.textDim, marginBottom: "0.85rem" }}>Every project has one dominant constraint. Here's yours.</div>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>{["SCOPE", "TIME", "BUDGET"].map(k => { const isA = k === primaryConstraint; const c = cc[k]; return (<div key={k} style={{ flex: 1, background: isA ? `${c}15` : T.surface2, border: `1px solid ${isA ? c : T.border}`, borderRadius: T.radiusSm, padding: "0.65rem", textAlign: "center" }}><div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.6rem", color: isA ? c : T.textDim, letterSpacing: "0.1em" }}>{k}</div>{isA && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.55rem", color: c, marginTop: "0.2rem" }}>PRIMARY</div>}</div>); })}</div>
          <div style={{ background: `${col}10`, border: `1px solid ${col}30`, borderRadius: T.radiusSm, padding: "0.75rem", marginBottom: "1rem" }}><div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.58rem", color: col, marginBottom: "0.3rem" }}>PRIMARY CONSTRAINT: {primaryConstraint}</div><div style={{ fontSize: "0.82rem", color: T.text }}>{primaryReason}</div></div>
          {[{ icon: "◈", label: "SCOPE lever", text: scopeLever, c: cc.SCOPE }, { icon: "⏱", label: "TIME lever", text: timeLever, c: cc.TIME }, { icon: "◎", label: "BUDGET lever", text: budgetLever, c: cc.BUDGET }].map(({ icon, label, text, c }, i, arr) => (<div key={label} style={{ display: "flex", gap: "0.75rem", padding: "0.7rem 0", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}><div style={{ color: c, flexShrink: 0, width: 20, fontFamily: "'DM Mono', monospace" }}>{icon}</div><div><div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.58rem", color: c, letterSpacing: "0.1em", marginBottom: "0.2rem" }}>{label}</div><div style={{ fontSize: "0.82rem", color: T.textMid, lineHeight: 1.6 }}>{text}</div></div></div>))}
          <div style={{ marginTop: "1rem", background: T.greenDim, border: "1px solid #000", outline: `1px solid ${T.green}`, borderRadius: T.radiusSm, padding: "0.75rem", display: "flex", gap: "0.6rem" }}><span style={{ color: T.green }}>→</span><div><div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.58rem", color: T.green, marginBottom: "0.2rem" }}>RECOMMENDED MOVE</div><div style={{ fontSize: "0.84rem", color: T.text }}>{recommendedMove}</div></div></div>
        </Card>);
      })()}
      {checkpoints.length > 0 && (<Card><SecLabel color={T.accent}>Milestones</SecLabel>{checkpoints.map((m, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.45rem 0", borderBottom: i < checkpoints.length - 1 ? `1px solid ${T.border}` : "none" }}><span style={{ fontSize: "0.84rem", color: T.text }}>⬡ {m.name}</span><span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.62rem", color: T.accent }}>Day {m.completesOnDay}</span></div>))}</Card>)}
      <Card><SecLabel>All Tasks</SecLabel>{tasks.map((t, i) => (<div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.75rem", alignItems: "center", padding: "0.4rem 0", borderBottom: i < tasks.length - 1 ? `1px solid ${T.border}` : "none" }}><div style={{ fontSize: "0.82rem", color: t.slack === 0 ? T.green : T.text }}>{t.slack === 0 && <span style={{ marginRight: "0.35rem", opacity: 0.7 }}>⬡</span>}{t.name}</div><div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.6rem", color: T.textDim }}>{t.days}d · {t.owner}</div>{t.slack === 0 ? (<span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.58rem", color: "#0D1210", background: "#FB923C", border: "1.5px solid #000", borderRadius: "4px", padding: "0.12rem 0.45rem" }}>no wiggle room</span>) : (<span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.58rem", color: "#0D1210", background: T.green, border: "1.5px solid #000", borderRadius: "4px", padding: "0.12rem 0.45rem" }}>{t.slack}d spare</span>)}</div>))}</Card>
      <div style={{ display: "flex", gap: "0.65rem" }}>
        <button onClick={onSave} style={{ flex: 1, background: saved ? T.greenDim : T.green, color: saved ? T.green : "#0D1210", border: "1.5px solid #000", outline: saved ? `1px solid ${T.green}` : "none", borderRadius: T.radiusSm, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: "0.9rem", padding: "0.85rem", cursor: "pointer" }}>{saved ? "✓ Saved" : "Save plan"}</button>
        <button onClick={onNew} style={{ flex: 1, background: "transparent", color: T.textMid, border: `1px solid ${T.border2}`, borderRadius: T.radiusSm, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "0.9rem", padding: "0.85rem", cursor: "pointer" }}>New project →</button>
      </div>
      <Card style={{ marginTop: "0.85rem" }}>
        <SecLabel color={T.accent}>AI Leadership Readout</SecLabel>
        <div style={{ fontSize: "0.72rem", color: T.textDim, marginBottom: "0.75rem" }}>Full Claude analysis — risk rationale, dependency logic, 5-sentence executive summary.</div>
        {aiReadout ? (<div style={{ fontSize: "0.83rem", color: T.textMid, lineHeight: 1.8, whiteSpace: "pre-wrap", borderTop: `1px solid ${T.border}`, paddingTop: "0.85rem" }}>{aiReadout}</div>) : (<div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}><span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.65rem", color: T.textDim, letterSpacing: "0.1em" }}>GENERATING</span>{[0,1,2].map(i => (<span key={i} style={{ width: 4, height: 4, background: T.green, borderRadius: "50%", display: "inline-block", animation: `dotBlink 1.4s ${i * 0.22}s infinite` }} />))}</div>)}
      </Card>
    </div>
  );
}

export default function AppPage() {
  const [messages, setMessages] = useState([]);
  const [stage, setStage] = useState(S.INTRO);
  const [project, setProject] = useState({ name: "", startDate: "", targetDate: "", budget: "" });
  const [tasks, setTasks] = useState([]);
  const [currentTask, setCurrentTask] = useState({ name: "", days: 0, owner: "", milestone: false, predecessors: [], concurrent: false, id: "" });
  const [inputVal, setInputVal] = useState("");
  const [result, setResult] = useState(null);
  const [aiReadout, setAiReadout] = useState(null);
  const [saved, setSaved] = useState(false);
  const [savedProjects, setSavedProjects] = useState({});
  const [showSaved, setShowSaved] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const taskCounter = useRef(0);
  const stageRef = useRef(stage);
  const tasksRef = useRef(tasks);
  const currentTaskRef = useRef(currentTask);
  const projectRef = useRef(project);
  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { currentTaskRef.current = currentTask; }, [currentTask]);
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { setSavedProjects(loadProjects()); setTimeout(() => pushBot("Let's build your project plan.\n\nFirst — what's this project called?", "text", "e.g. Kitchen remodel, Website launch..."), 300); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, analyzing]);
  useEffect(() => { if (stage !== S.RESULT && stage !== S.ANALYZING) setTimeout(() => inputRef.current?.focus(), 120); }, [stage]);
  function pushBot(text, input, placeholder, choices) { setMessages(prev => [...prev, { from: "bot", text, input: input || "text", placeholder, choices, id: Date.now() + Math.random() }]); }
  function pushUser(text) { setMessages(prev => [...prev, { from: "user", text, id: Date.now() + Math.random() }]); }
  function handleText(val) { if (!val.trim()) return; pushUser(val); setInputVal(""); advance(val.trim()); }
  function handleChoice(choice) { pushUser(choice); advance(choice); }
  function advance(val) {
    const st = stageRef.current; const tsk = tasksRef.current; const cur = currentTaskRef.current;
    switch (st) {
      case S.INTRO: { setProject(p => ({ ...p, name: val })); setStage(S.START_DATE); setTimeout(() => pushBot(`Got it — **${val}**.\n\nWhat date does work kick off?`, "date"), 380); break; }
      case S.START_DATE: { setProject(p => ({ ...p, startDate: val })); setStage(S.TARGET_DATE); setTimeout(() => pushBot("And what's the deadline?", "date"), 380); break; }
      case S.TARGET_DATE: { setProject(p => ({ ...p, targetDate: val })); setStage(S.TASK_NAME); setTimeout(() => pushBot("Now let's map the work.\n\nWhat's the first thing that needs to happen?", "text", "e.g. Client kickoff, Permits, Design..."), 380); break; }
      case S.TASK_NAME: { const id = `t${taskCounter.current++}`; setCurrentTask({ name: val, days: 0, owner: "", milestone: false, predecessors: [], concurrent: false, id }); setStage(S.TASK_DAYS); setTimeout(() => pushBot(`How many working days will **${val}** take?`, "number", "Number of days"), 380); break; }
      case S.TASK_DAYS: { const days = parseInt(val) || 1; setCurrentTask(t => ({ ...t, days })); setStage(S.TASK_OWNER); setTimeout(() => pushBot(`Who owns **${cur.name}**?`, "text", "Name or team"), 380); break; }
      case S.TASK_OWNER: { setCurrentTask(t => ({ ...t, owner: val })); setStage(S.TASK_CHECKPOINT); setTimeout(() => pushBot(`Is **${cur.name}** a milestone — a moment you'd report progress to a client or team?`, "choice", null, ["Yes — it's a phase checkpoint", "No — internal work only"]), 380); break; }
      case S.TASK_CHECKPOINT: { const isMilestone = val.startsWith("Yes"); setCurrentTask(t => ({ ...t, milestone: isMilestone })); setStage(S.TASK_DEPENDS); setTimeout(() => { if (tsk.length === 0) { pushBot(`Does **${cur.name}** kick off on its own from day one?`, "choice", null, ["It starts on day one"]); } else { pushBot(`Does **${cur.name}** need anything to finish first?`, "multi-choice", null, ["No — it can start any time", ...tsk.map(t => `Waits for: ${t.name}`)]); } }, 380); break; }
      case S.TASK_DEPENDS: { const isIndependent = val.startsWith("No") || val.includes("day one") || val.includes("any time"); if (isIndependent) { const ft = { ...cur, predecessors: [], concurrent: false }; setTasks(prev => { const u = [...prev, ft]; tasksRef.current = u; return u; }); setCurrentTask({ name: "", days: 0, owner: "", milestone: false, predecessors: [], concurrent: false, id: "" }); setStage(S.ADD_MORE); const count = tsk.length + 1; setTimeout(() => pushBot(`**${count} task${count !== 1 ? "s" : ""} mapped.**\n\nAdd another task, or run the analysis?`, "choice", null, ["Add another task", "Analyze my project →"]), 380); } else { const predName = val.replace("Waits for: ", ""); const predTask = tsk.find(t => t.name === predName); setCurrentTask(t => ({ ...t, predecessors: predTask ? [predTask.id] : [] })); setStage(S.TASK_PARALLEL); setTimeout(() => pushBot(`Can **${cur.name}** run at the same time as **${predName}**, or wait until it's done?`, "choice", null, [`Runs at the same time as ${predName}`, `Waits until ${predName} is done`]), 380); } break; }
      case S.TASK_PARALLEL: { const isConcurrent = val.startsWith("Runs"); const ft = { ...cur, concurrent: isConcurrent }; setTasks(prev => { const u = [...prev, ft]; tasksRef.current = u; return u; }); setCurrentTask({ name: "", days: 0, owner: "", milestone: false, predecessors: [], concurrent: false, id: "" }); setStage(S.ADD_MORE); const count = tsk.length + 1; setTimeout(() => pushBot(`**${count} task${count !== 1 ? "s" : ""} mapped.**\n\nAdd another task, or run the analysis?`, "choice", null, ["Add another task", "Analyze my project →"]), 380); break; }
      case S.ADD_MORE: { if (val === "Add another task") { setStage(S.TASK_NAME); setTimeout(() => pushBot(`Task ${tsk.length + 1} — what's it called?`, "text", "Next task..."), 380); } else { setStage(S.BUDGET); setTimeout(() => pushBot("Last question — how flexible is your budget?", "choice", null, ["💚 Flexible — we can adjust", "⚠️ Tight — limited room", "🔒 Fixed — cannot change"]), 380); } break; }
      case S.BUDGET: { const bm = { "💚 Flexible — we can adjust": "Flexible", "⚠️ Tight — limited room": "Tight", "🔒 Fixed — cannot change": "Fixed" }; const budget = bm[val] || "Flexible"; setProject(p => ({ ...p, budget })); setAnalyzing(true); setStage(S.ANALYZING); setAiReadout(null); setTimeout(async () => { const r = computeCPM(tasksRef.current, projectRef.current.startDate, projectRef.current.targetDate, projectRef.current.budget); setResult(r); setStage(S.RESULT); setAnalyzing(false); const readout = await getAIReadout({ name: projectRef.current.name, startDate: projectRef.current.startDate, targetDate: projectRef.current.targetDate, budget: projectRef.current.budget, tasks: tasksRef.current }); setAiReadout(readout); }, 1800); break; }
    }
  }
  function handleSave() { if (!result) return; saveProject(project.name, { project, tasks, result }); setSaved(true); setSavedProjects(loadProjects()); }
  function handleNew() { setMessages([]); setStage(S.INTRO); setProject({ name: "", startDate: "", targetDate: "", budget: "" }); setTasks([]); setCurrentTask({ name: "", days: 0, owner: "", milestone: false, predecessors: [], concurrent: false, id: "" }); setResult(null); setSaved(false); setInputVal(""); setAiReadout(null); taskCounter.current = 0; setTimeout(() => pushBot("New project — what's it called?", "text", "Project name..."), 300); }
  function loadSaved(name) { const p = savedProjects[name]; if (!p) return; setProject(p.project); setTasks(p.tasks); setResult(p.result); setStage(S.RESULT); setShowSaved(false); setMessages([{ from: "bot", text: `Loaded **${name}**`, id: Date.now() }]); }
  const lastMsg = messages[messages.length - 1];
  const showTextInput = stage !== S.RESULT && stage !== S.ANALYZING && lastMsg?.from === "bot" && lastMsg?.input !== "choice" && lastMsg?.input !== "multi-choice";
  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'Bricolage Grotesque', sans-serif", display: "flex", flexDirection: "column", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap');
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotBlink { 0%,80%,100%{opacity:0} 40%{opacity:1} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:${T.border2}}
        input:focus{outline:none}
      `}</style>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100vh", background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(62,203,111,0.11) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1.5rem", height: "60px", borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, background: "rgba(13,18,16,0.88)", backdropFilter: "blur(14px)", zIndex: 100 }}>
        <a href="/" style={{ textDecoration: "none" }}>
          <svg width="128" height="32" viewBox="0 0 128 32" fill="none"><path d="M5 24 C9 24 11 16 15 16 C19 16 21 8 25 8 C29 8 31 16 34 16" stroke="#3ECB6F" strokeWidth="2.2" strokeLinecap="round" fill="none"/><circle cx="5" cy="24" r="3" fill="#3ECB6F"/><circle cx="15" cy="16" r="3" fill="#3ECB6F" opacity="0.7"/><circle cx="25" cy="8" r="3" fill="#3ECB6F" opacity="0.5"/><circle cx="34" cy="16" r="3" fill="#3ECB6F" opacity="0.85"/><text x="46" y="22" fontFamily="'Bricolage Grotesque',sans-serif" fontWeight="700" fontSize="17" fill="#E4EDE7">Path</text><text x="86" y="22" fontFamily="'Bricolage Grotesque',sans-serif" fontWeight="300" fontSize="17" fill="#3ECB6F">flo</text></svg>
        </a>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {Object.keys(savedProjects).length > 0 && (<button onClick={() => setShowSaved(s => !s)} style={{ background: "transparent", border: `1px solid ${T.border2}`, borderRadius: T.radiusSm, color: T.textDim, fontFamily: "'DM Mono', monospace", fontSize: "0.62rem", letterSpacing: "0.1em", padding: "0.38rem 0.75rem", cursor: "pointer" }}>SAVED ({Object.keys(savedProjects).length})</button>)}
          {stage === S.RESULT && (<button onClick={handleNew} style={{ background: T.green, color: "#0D1210", border: "1.5px solid #000", borderRadius: T.radiusSm, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: "0.82rem", padding: "0.38rem 0.9rem", cursor: "pointer" }}>New project</button>)}
        </div>
      </div>
      {showSaved && (<div style={{ position: "fixed", top: "64px", right: "1rem", background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.radius, boxShadow: T.shadowLg, padding: "1rem", zIndex: 200, minWidth: "220px" }}><div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.6rem", color: T.textDim, letterSpacing: "0.12em", marginBottom: "0.65rem" }}>SAVED PROJECTS</div>{Object.keys(savedProjects).map(name => (<div key={name} onClick={() => loadSaved(name)} style={{ padding: "0.5rem 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer", fontSize: "0.86rem", color: T.text }}>{name}</div>))}</div>)}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", maxWidth: 680, width: "100%", margin: "0 auto", position: "relative", zIndex: 1 }}>
        {messages.map((msg, i) => (
          <div key={msg.id} style={{ marginBottom: "0.85rem", display: "flex", justifyContent: msg.from === "user" ? "flex-end" : "flex-start", animation: "fadeUp 0.28s ease both" }}>
            {msg.from === "bot" && (<div style={{ maxWidth: "88%" }}><div style={{ background: T.surface, border: `1px solid ${T.border2}`, borderRadius: `${T.radius} ${T.radius} ${T.radius} 4px`, boxShadow: T.shadow, padding: "0.9rem 1.1rem", fontSize: "0.9rem", lineHeight: 1.65, color: T.text }}>{msg.text.split(/(\*\*[^*]+\*\*)/).map((p, j) => p.startsWith("**") ? <strong key={j} style={{ color: T.green, fontWeight: 700 }}>{p.slice(2, -2)}</strong> : p)}</div>{i === messages.length - 1 && (msg.input === "choice" || msg.input === "multi-choice") && msg.choices && stage !== S.RESULT && (<div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.45rem" }}>{msg.choices.map(c => (<button key={c} onClick={() => handleChoice(c)} style={{ background: T.bg, border: `1px solid ${T.border2}`, borderRadius: T.radiusSm, color: T.text, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "0.86rem", padding: "0.65rem 1rem", cursor: "pointer", textAlign: "left" }}>{c}</button>))}</div>)}</div>)}
            {msg.from === "user" && (<div style={{ background: T.greenDim, border: "1.5px solid #000", outline: `1px solid ${T.green}`, borderRadius: `${T.radius} ${T.radius} 4px ${T.radius}`, padding: "0.65rem 1rem", maxWidth: "76%", fontSize: "0.87rem", color: T.green }}>{msg.text}</div>)}
          </div>
        ))}
        {analyzing && (<div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.75rem 0" }}><span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.68rem", color: T.green, letterSpacing: "0.12em" }}>ANALYZING</span>{[0,1,2].map(i => (<span key={i} style={{ width: 5, height: 5, background: T.green, borderRadius: "50%", display: "inline-block", animation: `dotBlink 1.4s ${i * 0.22}s infinite` }} />))}</div>)}
        {stage === S.RESULT && result && (<VerdictScreen result={result} project={project} tasks={tasks} onNew={handleNew} onSave={handleSave} saved={saved} aiReadout={aiReadout} />)}
        <div ref={bottomRef} />
      </div>
      {showTextInput && (<div style={{ padding: "0.9rem 1.5rem", borderTop: `1px solid ${T.border}`, background: "rgba(13,18,16,0.92)", backdropFilter: "blur(12px)", maxWidth: 680, width: "100%", margin: "0 auto", position: "relative", zIndex: 1 }}><div style={{ display: "flex", gap: "0.5rem" }}><input ref={inputRef} type={lastMsg?.input === "number" ? "number" : lastMsg?.input === "date" ? "date" : "text"} value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key === "Enter" && handleText(inputVal)} placeholder={lastMsg?.placeholder || "Type your answer..."} min={lastMsg?.input === "number" ? 1 : undefined} style={{ flex: 1, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: T.radiusSm, color: T.text, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "0.92rem", padding: "0.72rem 1rem" }} /><button onClick={() => handleText(inputVal)} style={{ background: T.green, color: "#0D1210", border: "1.5px solid #000", borderRadius: T.radiusSm, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: "0.9rem", padding: "0.72rem 1.2rem", cursor: "pointer" }}>→</button></div></div>)}
    </div>
  );
}
