"use client";
import { useState, useEffect, useRef } from "react";

const T = {
  bg: "#080A08", surface: "#111511", surface2: "#161D16",
  border: "#1E251E", border2: "#252D25",
  text: "#EEF2EE", textMid: "#8A9E8A", textDim: "#4A5A4A",
  green: "#3ECB6F", greenDim: "#0F2B1A", greenMid: "#1A4A28",
  red: "#EF4444", amber: "#F59E0B",
};

// ── PLAN SO FAR CARD ──────────────────────────────────────────────────────────
function PlanCard({ tasks }) {
  if (!tasks.length) return null;
  return (
    <div style={{ background: T.surface2, border: "1px solid " + T.border, borderRadius: 12, padding: "0.85rem 1rem", marginBottom: "0.85rem" }}>
      <div style={{ fontSize: "0.58rem", color: T.green, fontWeight: 700, letterSpacing: "0.12em", marginBottom: "0.5rem" }}>
        YOUR PLAN — {tasks.length} MILESTONE{tasks.length !== 1 ? "S" : ""}
      </div>
      {tasks.map((t, i) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0", borderBottom: i < tasks.length - 1 ? "1px solid " + T.border : "none" }}>
          <span style={{ fontSize: "0.65rem", color: T.textDim, minWidth: 18 }}>{i + 1}.</span>
          <span style={{ color: T.text, flex: 1, fontSize: "0.85rem" }}>{t.name}</span>
          <span style={{ fontSize: "0.72rem", color: T.textDim }}>{t.days}d</span>
          {t.owner && t.owner !== "UNASSIGNED" && (
            <span style={{ fontSize: "0.68rem", color: T.textDim, maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.owner}</span>
          )}
          {t.predecessors.length > 0 && (
            <span style={{ fontSize: "0.6rem", color: T.amber, background: T.amber + "15", borderRadius: 4, padding: "0.1rem 0.35rem" }}>depends</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AppPage() {
  const [messages, setMessages] = useState([]);
  const [stage, setStage] = useState("INIT");
  const [inputVal, setInputVal] = useState("");
  const [progress, setProgress] = useState(1);
  const [project, setProject] = useState({ name: "", startDate: "", targetDate: "", budgetType: "Flexible", totalBudget: "" });
  const [tasks, setTasks] = useState([]);
  const [currentTask, setCurrentTask] = useState({ name: "", owner: "", days: 0, predecessors: [], concurrent: false, id: "" });
  const [pendingPreds, setPendingPreds] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [showPlan, setShowPlan] = useState(false);

  const counter = useRef(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const stageRef = useRef(stage);
  const tasksRef = useRef(tasks);
  const curRef = useRef(currentTask);
  const projRef = useRef(project);
  const predsRef = useRef(pendingPreds);

  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { curRef.current = currentTask; }, [currentTask]);
  useEffect(() => { projRef.current = project; }, [project]);
  useEffect(() => { predsRef.current = pendingPreds; }, [pendingPreds]);

  // ── BOOT ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const url = new URL(window.location.href);
    const revise = url.searchParams.get("revise");

    if (revise) {
      try {
        const d = JSON.parse(decodeURIComponent(revise));
        setProject({ name: d.name || "", startDate: d.startDate || "", targetDate: d.targetDate || "", budgetType: d.budget || "Flexible", totalBudget: d.totalBudget || "" });
        const loaded = d.tasks || [];
        setTasks(loaded); tasksRef.current = loaded;
        counter.current = loaded.length;
        setProgress(4); setShowPlan(true); setStage("ADD_MORE");
        setTimeout(() => bot(
          `Welcome back to **${d.name}**.\n\nI've got your ${loaded.length} milestone${loaded.length !== 1 ? "s" : ""} loaded. What do you want to change?`,
          "choice", null,
          ["Add a milestone", "Remove a milestone", "Change the dates", "Re-run as-is →"]
        ), 300);
        return;
      } catch (e) {}
    }

    setStage("INTRO");
    setTimeout(() => bot(
      "I'm going to map your project, find every dependency, and tell you exactly what's at risk before a single day of work begins.\n\nMost people are surprised by what they find.\n\nFirst — what's this project called?",
      "text", "e.g. Office renovation, Website relaunch, Product launch..."
    ), 300);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, analyzing]);
  useEffect(() => { if (stage !== "ANALYZING") setTimeout(() => inputRef.current?.focus(), 80); }, [stage, messages]);

  // ── MESSAGING ────────────────────────────────────────────────────────────────
  function bot(text, input, placeholder, choices) {
    setMessages(p => [...p, { from: "bot", text, input: input || "text", placeholder, choices, id: Date.now() + Math.random() }]);
  }
  function usr(text) { setMessages(p => [...p, { from: "user", text, id: Date.now() + Math.random() }]); }
  function handleText(val) { if (!val.trim()) return; usr(val); setInputVal(""); advance(val.trim()); }
  function handleChoice(val) { usr(val); advance(val); }

  // ── TASK SAVE ────────────────────────────────────────────────────────────────
  function saveTask(taskData) {
    setTasks(p => { const u = [...p, { ...taskData }]; tasksRef.current = u; return u; });
    setCurrentTask({ name: "", owner: "", days: 0, predecessors: [], concurrent: false, id: "" });
    setPendingPreds([]); predsRef.current = [];
    setStage("ADD_MORE"); setProgress(4); setShowPlan(true);
    const count = tasksRef.current.length;
    const isFirst = count === 1;
    const needsMore = count < 3;

    setTimeout(() => {
      if (isFirst) {
        bot(
          `**${taskData.name}** is on the board — that's your first milestone.\n\nFor Pathflo to find your critical path and map the risks, I need at least 2 more milestones.\n\nWhat comes next in the project?`,
          "text", "e.g. Design phase, Permit approval, Development..."
        );
        setStage("TASK_NAME");
        return;
      }
      bot(
        needsMore
          ? `**${count} milestones mapped.** Keep going — a few more and I'll have enough to show you the full risk picture.`
          : `**${count} milestones mapped.** That's enough for a solid analysis. Add more for higher accuracy, or run it now.`,
        "choice", null,
        needsMore
          ? ["Add another milestone"]
          : ["Add another milestone", "Run the analysis →"]
      );
    }, 350);
  }

  // ── DEPENDENCY FLOW ───────────────────────────────────────────────────────────
  function askDeps(taskData) {
    setCurrentTask(t => ({ ...t, ...taskData }));
    const tsk = tasksRef.current;

    if (tsk.length === 0) {
      saveTask({ ...taskData, predecessors: [], concurrent: false });
      return;
    }

    setStage("TASK_DEPENDS_FIRST");
    const lastTask = tsk[tsk.length - 1];
    setTimeout(() => bot(
      `Before **${taskData.name}** can start — does it need anything else to be finished first?\n\nFor example, does it wait for **${lastTask.name}** to complete, or can it kick off independently?`,
      "choice", null,
      ["It can start any time — no dependencies", ...tsk.map(t => `Waits for: ${t.name}`)]
    ), 350);
  }

  function askMoreDeps(taskName, currentPreds) {
    const tsk = tasksRef.current;
    const remaining = tsk.filter(t => !currentPreds.includes(t.id));
    if (!remaining.length) { finishDeps(currentPreds); return; }
    setStage("TASK_DEPENDS_MORE");
    setTimeout(() => bot(
      `Does **${taskName}** also depend on anything else finishing first?`,
      "choice", null,
      ["No — that's its only dependency", ...remaining.map(t => `Also waits for: ${t.name}`)]
    ), 350);
  }

  function finishDeps(preds) {
    const cur = curRef.current;
    const tsk = tasksRef.current;
    const primaryPred = tsk.find(t => t.id === preds[0]);
    const predDays = parseInt(primaryPred?.days) || 0;

    if (predDays >= 4 && preds.length === 1) {
      setStage("TASK_CONCURRENT");
      setPendingPreds(preds); predsRef.current = preds;
      setTimeout(() => bot(
        `**${primaryPred.name}** takes ${predDays} days. Can **${cur.name}** begin while **${primaryPred.name}** is still in progress — or does it need to be completely done first?\n\nIf they can overlap even partially, that can save days on your timeline.`,
        "choice", null,
        [`Can start while ${primaryPred.name} is still running`, `Has to wait until ${primaryPred.name} is fully done`]
      ), 350);
    } else {
      saveTask({ ...cur, predecessors: preds, concurrent: false });
    }
  }

  // ── MAIN STATE MACHINE ────────────────────────────────────────────────────────
  function advance(val) {
    const st = stageRef.current;
    const tsk = tasksRef.current;
    const cur = curRef.current;

    switch (st) {

      case "INTRO": {
        const name = val;
        setProject(p => ({ ...p, name }));
        setStage("START_DATE");
        setTimeout(() => bot(
          `**${name}** — I like it.\n\nWhen does work actually start on this?`,
          "date"
        ), 350);
        break;
      }

      case "START_DATE": {
        setProject(p => ({ ...p, startDate: val }));
        setStage("TARGET_DATE");
        setProgress(2);
        setTimeout(() => bot(
          "And what's the deadline — the date it needs to be done?",
          "date"
        ), 350);
        break;
      }

      case "TARGET_DATE": {
        setProject(p => ({ ...p, targetDate: val }));
        setStage("BUDGET");
        setTimeout(() => bot(
          "What's the budget situation?\n\nThis helps Pathflo calculate financial exposure — what a delay actually costs, not just in time.",
          "choice", null,
          ["No budget set yet", "Flexible — can move if needed", "Tight — limited room", "Fixed — absolutely cannot change"]
        ), 350);
        break;
      }

      case "BUDGET": {
        const bt = val === "No budget set yet" ? "Flexible" : val.split(" —")[0];
        setProject(p => ({ ...p, budgetType: bt }));
        if (bt !== "Flexible" && val !== "No budget set yet") {
          setStage("BUDGET_AMOUNT");
          setTimeout(() => bot(
            "What's the total budget?\n\nPathflo uses this to show what each day of delay actually costs you.",
            "text", "e.g. $45,000"
          ), 350);
        } else {
          goToMilestones();
        }
        break;
      }

      case "BUDGET_AMOUNT": {
        setProject(p => ({ ...p, totalBudget: val }));
        goToMilestones();
        break;
      }

      case "TASK_NAME": {
        const id = "t" + counter.current++;
        setCurrentTask({ name: val, owner: "", days: 0, predecessors: [], concurrent: false, id });
        setStage("TASK_DAYS");
        setTimeout(() => bot(
          `**${val}** — how many working days will this take?\n\nBe realistic here. Pathflo's accuracy depends on honest estimates. If you're not sure, go slightly longer rather than shorter.`,
          "number", "e.g. 7"
        ), 350);
        break;
      }

      case "TASK_DAYS": {
        const days = Math.max(1, parseInt(val) || 1);
        setCurrentTask(t => ({ ...t, days }));
        setStage("TASK_OWNER");
        setTimeout(() => bot(
          `Who's responsible for **${cur.name}**?\n\nThis is the person who gets the call if it's running behind. Pathflo uses this to spot if one person is carrying too much of the critical work.`,
          "choice", null,
          ["Skip — not assigned yet", "Enter their name"]
        ), 350);
        break;
      }

      case "TASK_OWNER": {
        if (val === "Enter their name") {
          setStage("TASK_OWNER_INPUT");
          setTimeout(() => bot("Who owns this milestone?", "text", "e.g. Sarah, Dev team, Marcus..."), 350);
        } else {
          const owner = val === "Skip — not assigned yet" ? "UNASSIGNED" : val;
          setCurrentTask(t => ({ ...t, owner }));
          askDeps({ ...curRef.current, owner });
        }
        break;
      }

      case "TASK_OWNER_INPUT": {
        setCurrentTask(t => ({ ...t, owner: val }));
        askDeps({ ...curRef.current, owner: val });
        break;
      }

      case "TASK_DEPENDS_FIRST": {
        if (val.startsWith("It can start")) {
          saveTask({ ...cur, predecessors: [], concurrent: false });
        } else {
          const predName = val.replace("Waits for: ", "");
          const predTask = tsk.find(t => t.name === predName);
          if (predTask) {
            const newPreds = [predTask.id];
            setPendingPreds(newPreds); predsRef.current = newPreds;
            setCurrentTask(t => ({ ...t, predecessors: newPreds }));
            askMoreDeps(cur.name, newPreds);
          }
        }
        break;
      }

      case "TASK_DEPENDS_MORE": {
        if (val.startsWith("No")) {
          finishDeps(predsRef.current);
        } else {
          const predName = val.replace("Also waits for: ", "");
          const predTask = tsk.find(t => t.name === predName);
          if (predTask) {
            const newPreds = [...predsRef.current, predTask.id];
            setPendingPreds(newPreds); predsRef.current = newPreds;
            setCurrentTask(t => ({ ...t, predecessors: newPreds }));
            askMoreDeps(cur.name, newPreds);
          }
        }
        break;
      }

      case "TASK_CONCURRENT": {
        const isConcurrent = val.startsWith("Can start while");
        saveTask({ ...cur, predecessors: predsRef.current, concurrent: isConcurrent });
        break;
      }

      case "ADD_MORE": {
        if (val === "Add another milestone" || val === "Add a milestone") {
          setStage("TASK_NAME");
          setTimeout(() => bot(
            `Milestone ${tsk.length + 1} — what's it called?`,
            "text", "e.g. QA testing, Final inspection, Client sign-off..."
          ), 350);
        } else if (val === "Remove a milestone") {
          setStage("REMOVE_TASK");
          setTimeout(() => bot(
            "Which milestone do you want to remove?",
            "choice", null,
            tsk.map(t => `Remove: ${t.name}`)
          ), 350);
        } else if (val === "Change the dates") {
          setStage("START_DATE");
          setProgress(2);
          setTimeout(() => bot("What's the new start date?", "date"), 350);
        } else if (val === "Re-run as-is →" || val === "Run the analysis →") {
          runAnalysis();
        }
        break;
      }

      case "REMOVE_TASK": {
        const taskName = val.replace("Remove: ", "");
        const removed = tsk.find(t => t.name === taskName);
        const updated = tsk
          .filter(t => t.name !== taskName)
          .map(t => ({ ...t, predecessors: t.predecessors.filter(pid => pid !== removed?.id) }));
        setTasks(updated); tasksRef.current = updated;
        setStage("ADD_MORE");
        setTimeout(() => bot(
          `Removed **${taskName}**. ${updated.length} milestone${updated.length !== 1 ? "s" : ""} remaining.\n\nWhat next?`,
          "choice", null,
          updated.length >= 3
            ? ["Add another milestone", "Run the analysis →"]
            : ["Add another milestone"]
        ), 350);
        break;
      }
    }
  }

  function goToMilestones() {
    setStage("TASK_NAME");
    setProgress(3);
    setTimeout(() => bot(
      "Now let's map the milestones.\n\nThink of these as the key phases — the things that have to happen, in order, for this project to get done. Each one becomes a node in your dependency graph.\n\nStart with the very first thing that needs to happen. What is it?",
      "text", "e.g. Site survey, Design kickoff, Permit filing..."
    ), 350);
  }

  function runAnalysis() {
    if (tasksRef.current.length < 2) {
      setStage("TASK_NAME");
      setTimeout(() => bot(
        "I need at least 2 milestones to build a meaningful analysis. What's the next one?",
        "text", "e.g. Design phase, Development..."
      ), 350);
      return;
    }
    setAnalyzing(true); setStage("ANALYZING"); setProgress(5);
    setTimeout(() => {
      const data = {
        name: projRef.current.name,
        startDate: projRef.current.startDate,
        targetDate: projRef.current.targetDate,
        budget: projRef.current.budgetType || "Flexible",
        totalBudget: projRef.current.totalBudget,
        tasks: tasksRef.current,
      };
      window.location.href = "/results?data=" + encodeURIComponent(JSON.stringify(data));
    }, 2400);
  }

  const lastMsg = messages[messages.length - 1];
  const showInput = stage !== "ANALYZING" && lastMsg?.from === "bot" && lastMsg?.input !== "choice";

  function renderText(text) {
    return text.split(/(\n|\*\*[^*]+\*\*)/).map((p, j) =>
      p.startsWith("**") ? <strong key={j} style={{ color: T.green }}>{p.slice(2, -2)}</strong> :
      p === "\n" ? <br key={j} /> : p
    );
  }

  const stepLabel = {
    INTRO: "Project name", START_DATE: "Start date", TARGET_DATE: "Deadline",
    BUDGET: "Budget", BUDGET_AMOUNT: "Budget amount",
    TASK_NAME: "Milestone name", TASK_DAYS: "Duration", TASK_OWNER: "Owner",
    TASK_OWNER_INPUT: "Owner", TASK_DEPENDS_FIRST: "Dependencies",
    TASK_DEPENDS_MORE: "Dependencies", TASK_CONCURRENT: "Overlap",
    ADD_MORE: "Your plan", REMOVE_TASK: "Remove", ANALYZING: "Analyzing",
  }[stage] || "";

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotBlink { 0%,80%,100%{opacity:0} 40%{opacity:1} }
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes scanLine { from{transform:translateY(0)} to{transform:translateY(100%)} }
        input:focus { outline: none; }
        input::placeholder { color: #4A5A4A; }
        .cbtn { background: #080A08; border: 1px solid #252D25; border-radius: 100px; color: #EEF2EE; font-family: inherit; font-size: 0.86rem; padding: 0.65rem 1rem; cursor: pointer; text-align: left; transition: all 0.15s; display: flex; align-items: center; gap: 0.5rem; }
        .cbtn:hover { border-color: #3ECB6F; color: #3ECB6F; background: #0F2B1A; }
        .cbtn-cta { border-color: #1A4A28; color: #3ECB6F; font-weight: 700; }
        .cbtn-cta:hover { background: #0F2B1A; }
        @media(max-width:640px){ .chat-pad{ padding: 0.85rem !important; } }
      `}</style>

      {/* Ambient glow */}
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse 70% 45% at 50% -5%, rgba(62,203,111,0.06) 0%, transparent 65%)", pointerEvents: "none", zIndex: 0 }} />

      {/* ── NAV ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(8,10,8,0.94)", backdropFilter: "blur(20px)", borderBottom: "1px solid " + T.border, padding: "0 1.25rem", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <path d="M4 24 C8 24 10 14 15 14 C20 14 22 6 26 6 C29 6 30 12 31 14" stroke="#3ECB6F" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <circle cx="4" cy="24" r="3" fill="#3ECB6F"/>
            <circle cx="31" cy="14" r="2.5" fill="#3ECB6F" opacity="0.9"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: "0.95rem", color: T.text }}>Path<span style={{ color: T.green }}>flo</span></span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {stepLabel && (
            <span style={{ fontSize: "0.62rem", color: T.textDim, letterSpacing: "0.08em", fontFamily: "monospace" }}>{stepLabel.toUpperCase()}</span>
          )}
          <div style={{ display: "flex", gap: 3 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ width: i < progress ? 20 : 6, height: 4, borderRadius: 2, background: i < progress ? T.green : T.border, transition: "all 0.35s ease" }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── CHAT ── */}
      <div className="chat-pad" style={{ flex: 1, overflowY: "auto", padding: "1.25rem", maxWidth: 600, width: "100%", margin: "0 auto", position: "relative", zIndex: 1 }}>

        {messages.map((msg, i) => (
          <div key={msg.id} style={{ marginBottom: "0.75rem", display: "flex", justifyContent: msg.from === "user" ? "flex-end" : "flex-start", animation: "fadeUp 0.22s ease both" }}>
            {msg.from === "bot" && (
              <div style={{ maxWidth: "92%" }}>
                <div style={{ background: T.surface, border: "1px solid " + T.border2, borderRadius: "16px 16px 16px 4px", padding: "0.9rem 1.05rem", fontSize: "0.9rem", lineHeight: 1.72, color: T.text }}>
                  {renderText(msg.text)}
                </div>
                {i === messages.length - 1 && msg.input === "choice" && msg.choices && stage !== "ANALYZING" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.45rem" }}>
                    {msg.choices.map(c => {
                      const isCTA = c.includes("Run the analysis") || c.includes("Re-run");
                      return (
                        <button key={c} className={`cbtn${isCTA ? " cbtn-cta" : ""}`} onClick={() => handleChoice(c)}>
                          {isCTA && <span style={{ fontSize: "0.8rem" }}>⚡</span>}
                          {c}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {msg.from === "user" && (
              <div style={{ background: T.greenDim, border: "1.5px solid " + T.greenMid, borderRadius: "16px 16px 4px 16px", padding: "0.65rem 0.95rem", maxWidth: "80%", fontSize: "0.88rem", color: T.green, lineHeight: 1.5 }}>
                {msg.text}
              </div>
            )}
          </div>
        ))}

        {/* Plan so far — shown at ADD_MORE */}
        {showPlan && tasks.length > 0 && stage === "ADD_MORE" && (
          <div style={{ animation: "fadeUp 0.3s ease both" }}>
            <PlanCard tasks={tasks} />
          </div>
        )}

        {/* Analyzing */}
        {analyzing && (
          <div style={{ padding: "1.5rem 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
              <span style={{ fontFamily: "monospace", fontSize: "0.68rem", color: T.green, letterSpacing: "0.14em" }}>BUILDING YOUR EXECUTION INTELLIGENCE</span>
              {[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, background: T.green, borderRadius: "50%", display: "inline-block", animation: `dotBlink 1.4s ${i*0.22}s infinite` }} />)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[
                { label: "Mapping your dependency chain", delay: 0 },
                { label: "Running critical path analysis", delay: 0.3 },
                { label: "Calculating cascade risks", delay: 0.6 },
                { label: "Scoring on-time delivery confidence", delay: 0.9 },
                { label: "Finding scheduling optimizations", delay: 1.2 },
                { label: "Generating your intelligence report", delay: 1.5 },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.55rem", fontSize: "0.8rem", color: T.textMid, animation: `fadeUp 0.4s ${s.delay}s ease both`, opacity: 0, animationFillMode: "forwards" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.green, flexShrink: 0, animation: `pulse 1.8s ${s.delay + 0.2}s infinite` }} />
                  {s.label}
                </div>
              ))}
            </div>
            <div style={{ marginTop: "1.5rem", padding: "0.85rem 1rem", background: T.surface, border: "1px solid " + T.border, borderRadius: 12, fontSize: "0.82rem", color: T.textDim, lineHeight: 1.65 }}>
              Pathflo is mapping every dependency and running the critical path. Most users are surprised by what it finds.
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── INPUT ── */}
      {showInput && (
        <div style={{ padding: "0.8rem 1.25rem", borderTop: "1px solid " + T.border, background: "rgba(8,10,8,0.96)", backdropFilter: "blur(16px)", position: "sticky", bottom: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", gap: "0.45rem" }}>
            <input
              ref={inputRef}
              type={lastMsg?.input === "number" ? "number" : lastMsg?.input === "date" ? "date" : "text"}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleText(inputVal)}
              placeholder={lastMsg?.placeholder || "Type your answer..."}
              min={lastMsg?.input === "number" ? 1 : undefined}
              style={{ flex: 1, background: T.surface, border: "1px solid " + T.border2, borderRadius: 100, color: T.text, fontFamily: "inherit", fontSize: "0.9rem", padding: "0.7rem 1.2rem", transition: "border-color 0.2s" }}
              onFocus={e => e.target.style.borderColor = T.green}
              onBlur={e => e.target.style.borderColor = T.border2}
            />
            <button onClick={() => handleText(inputVal)} style={{ background: T.green, color: "#080A08", border: "none", borderRadius: 100, fontFamily: "inherit", fontWeight: 700, fontSize: "0.9rem", padding: "0.7rem 1.2rem", cursor: "pointer", flexShrink: 0 }}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}
