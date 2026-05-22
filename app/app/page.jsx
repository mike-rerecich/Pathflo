"use client";
import { useState, useEffect, useRef } from "react";

const T = {
  bg: "#080A08", surface: "#111511", border: "#1E251E", border2: "#252D25",
  text: "#EEF2EE", textMid: "#8A9E8A", textDim: "#4A5A4A",
  green: "#3ECB6F", greenDim: "#0F2B1A", greenMid: "#1A4A28",
  radius: "14px", radiusSm: "8px",
  shadow: "0 4px 24px rgba(0,0,0,0.4)",
};

const TOTAL_STEPS = 6;

export default function AppPage() {
  const [messages, setMessages] = useState([]);
  const [stage, setStage] = useState("INTRO");
  const [inputVal, setInputVal] = useState("");
  const [progress, setProgress] = useState(0);
  const [project, setProject] = useState({ name: "", startDate: "", targetDate: "", budget: "", budgetType: "", totalBudget: "" });
  const [tasks, setTasks] = useState([]);
  const [currentTask, setCurrentTask] = useState({ name: "", owner: "", days: "", cost: "", predecessors: [], concurrent: false, milestone: false, id: "" });
  const [wantsShuffle, setWantsShuffle] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const taskCounter = useRef(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const stageRef = useRef(stage);
  const tasksRef = useRef(tasks);
  const currentTaskRef = useRef(currentTask);
  const projectRef = useRef(project);
  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { currentTaskRef.current = currentTask; }, [currentTask]);
  useEffect(() => { projectRef.current = project; }, [project]);

  useEffect(() => {
    setTimeout(() => pushBot(
      "Let's build your project plan. I'll ask a few questions and map everything behind the scenes.\n\nFirst — what's this project called?",
      "text", "e.g. Website relaunch, Office buildout, Q3 campaign..."
    ), 300);
    setProgress(1);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, analyzing]);
  useEffect(() => {
    if (!["RESULT", "ANALYZING"].includes(stage)) setTimeout(() => inputRef.current?.focus(), 100);
  }, [stage]);

  function pushBot(text, input, placeholder, choices) {
    setMessages(prev => [...prev, { from: "bot", text, input: input || "text", placeholder, choices, id: Date.now() + Math.random() }]);
  }
  function pushUser(text) {
    setMessages(prev => [...prev, { from: "user", text, id: Date.now() + Math.random() }]);
  }
  function handleText(val) { if (!val.trim()) return; pushUser(val); setInputVal(""); advance(val.trim()); }
  function handleChoice(val) { pushUser(val); advance(val); }

  function advance(val) {
    const st = stageRef.current;
    const tsk = tasksRef.current;
    const cur = currentTaskRef.current;

    switch (st) {
      case "INTRO": {
        setProject(p => ({ ...p, name: val }));
        setStage("START_DATE");
        setProgress(1);
        setTimeout(() => pushBot("When does work kick off?", "date", ""), 350);
        break;
      }
      case "START_DATE": {
        setProject(p => ({ ...p, startDate: val }));
        setStage("TARGET_DATE");
        setTimeout(() => pushBot("And what's the target completion date?", "date", ""), 350);
        break;
      }
      case "TARGET_DATE": {
        setProject(p => ({ ...p, targetDate: val }));
        setStage("TOTAL_BUDGET");
        setProgress(2);
        setTimeout(() => pushBot(
          "What's the total budget for this project?",
          "choice", null,
          ["Skip — no budget yet", "Enter budget amount"]
        ), 350);
        break;
      }
      case "TOTAL_BUDGET": {
        if (val === "Skip — no budget yet") {
          setProject(p => ({ ...p, totalBudget: "", budgetType: "Flexible" }));
          setStage("TASK_NAME");
          setProgress(3);
          setTimeout(() => pushBot(
            "Let's map your milestones.\n\nWhat's the first thing that needs to happen?",
            "text", "e.g. Brand discovery, Permit approval, Design kickoff..."
          ), 350);
        } else {
          setStage("TOTAL_BUDGET_AMOUNT");
          setTimeout(() => pushBot("What's the total budget?", "text", "e.g. $45,000"), 350);
        }
        break;
      }
      case "TOTAL_BUDGET_AMOUNT": {
        setProject(p => ({ ...p, totalBudget: val }));
        setStage("BUDGET_TYPE");
        setTimeout(() => pushBot(
          "How flexible is that budget?",
          "choice", null,
          ["Flexible — we can adjust", "Tight — limited room", "Fixed — cannot change"]
        ), 350);
        break;
      }
      case "BUDGET_TYPE": {
        const bt = val.split(" —")[0];
        setProject(p => ({ ...p, budgetType: bt }));
        setStage("TASK_NAME");
        setProgress(3);
        setTimeout(() => pushBot(
          "Let's map your milestones.\n\nWhat's the first one?",
          "text", "e.g. Brand discovery, Permit approval, Design kickoff..."
        ), 350);
        break;
      }
      case "TASK_NAME": {
        const id = "t" + taskCounter.current++;
        setCurrentTask({ name: val, owner: "", days: "", cost: "", predecessors: [], concurrent: false, milestone: true, id });
        setStage("TASK_OWNER");
        setProgress(3);
        setTimeout(() => pushBot(
          `Who owns **${val}**?`,
          "choice", null,
          ["Skip", "Enter owner"]
        ), 350);
        break;
      }
      case "TASK_OWNER": {
        if (val === "Skip") {
          setCurrentTask(t => ({ ...t, owner: "UNASSIGNED" }));
        } else if (val === "Enter owner") {
          setStage("TASK_OWNER_INPUT");
          setTimeout(() => pushBot("Who owns this milestone?", "text", "e.g. Sarah, Design team, Marcus..."), 350);
          return;
        } else {
          setCurrentTask(t => ({ ...t, owner: val }));
        }
        setStage("TASK_DAYS");
        setTimeout(() => pushBot(`How many working days will **${cur.name}** take?`, "number", "e.g. 7"), 350);
        break;
      }
      case "TASK_OWNER_INPUT": {
        setCurrentTask(t => ({ ...t, owner: val }));
        setStage("TASK_DAYS");
        setTimeout(() => pushBot(`How many working days will **${cur.name}** take?`, "number", "e.g. 7"), 350);
        break;
      }
      case "TASK_DAYS": {
        setCurrentTask(t => ({ ...t, days: parseInt(val) || 1 }));
        setStage("TASK_COST");
        setProgress(4);
        setTimeout(() => pushBot(
          `What does **${cur.name}** cost?`,
          "choice", null,
          ["Skip", "Enter cost"]
        ), 350);
        break;
      }
      case "TASK_COST": {
        if (val === "Skip") {
          setCurrentTask(t => ({ ...t, cost: "" }));
        } else if (val === "Enter cost") {
          setStage("TASK_COST_INPUT");
          setTimeout(() => pushBot("What's the cost for this milestone?", "text", "e.g. $4,500"), 350);
          return;
        } else {
          setCurrentTask(t => ({ ...t, cost: val }));
        }
        setStage("TASK_DEPENDS");
        setProgress(4);
        if (tsk.length === 0) {
          setTimeout(() => pushBot(
            `Does **${cur.name}** start on day one, or does it need something to finish first?`,
            "choice", null, ["Starts on day one"]
          ), 350);
        } else {
          setTimeout(() => pushBot(
            `Does **${cur.name}** depend on anything finishing first?`,
            "choice", null,
            ["No — starts any time", ...tsk.map(t => "Waits for: " + t.name)]
          ), 350);
        }
        break;
      }
      case "TASK_COST_INPUT": {
        setCurrentTask(t => ({ ...t, cost: val }));
        setStage("TASK_DEPENDS");
        if (tsk.length === 0) {
          setTimeout(() => pushBot(
            `Does **${cur.name}** start on day one?`,
            "choice", null, ["Starts on day one"]
          ), 350);
        } else {
          setTimeout(() => pushBot(
            `Does **${cur.name}** depend on anything finishing first?`,
            "choice", null,
            ["No — starts any time", ...tsk.map(t => "Waits for: " + t.name)]
          ), 350);
        }
        break;
      }
      case "TASK_DEPENDS": {
        const isIndependent = val.startsWith("No") || val.includes("day one") || val.includes("any time");
        if (isIndependent) {
          const ft = { ...cur, predecessors: [], concurrent: false };
          setTasks(prev => { const u = [...prev, ft]; tasksRef.current = u; return u; });
          setCurrentTask({ name: "", owner: "", days: "", cost: "", predecessors: [], concurrent: false, milestone: true, id: "" });
          setStage("ADD_MORE");
          setProgress(5);
          const count = tsk.length + 1;
          setTimeout(() => pushBot(
            `**${count} milestone${count !== 1 ? "s" : ""} mapped.**\n\nAdd another or move to analysis?`,
            "choice", null, ["Add another milestone", "Run the analysis →"]
          ), 350);
        } else {
          const predName = val.replace("Waits for: ", "");
          const predTask = tsk.find(t => t.name === predName);
          setCurrentTask(t => ({ ...t, predecessors: predTask ? [predTask.id] : [] }));
          setStage("TASK_CONCURRENT");
          setTimeout(() => pushBot(
            `Can **${cur.name}** run at the same time as **${predName}**, or does it wait until it's fully done?`,
            "choice", null,
            ["Runs at the same time", "Waits until it's done"]
          ), 350);
        }
        break;
      }
      case "TASK_CONCURRENT": {
        const isConcurrent = val.startsWith("Runs");
        const ft = { ...cur, concurrent: isConcurrent };
        setTasks(prev => { const u = [...prev, ft]; tasksRef.current = u; return u; });
        setCurrentTask({ name: "", owner: "", days: "", cost: "", predecessors: [], concurrent: false, milestone: true, id: "" });
        setStage("ADD_MORE");
        setProgress(5);
        const count = tsk.length + 1;
        setTimeout(() => pushBot(
          `**${count} milestone${count !== 1 ? "s" : ""} mapped.**\n\nAdd another or move to analysis?`,
          "choice", null, ["Add another milestone", "Run the analysis →"]
        ), 350);
        break;
      }
      case "ADD_MORE": {
        if (val === "Add another milestone") {
          setStage("TASK_NAME");
          setTimeout(() => pushBot(
            `Milestone ${tsk.length + 1} — what's it called?`,
            "text", "e.g. QA testing, Client approval, Launch..."
          ), 350);
        } else {
          setStage("SHUFFLE");
          setProgress(6);
          setTimeout(() => pushBot(
            "One last question — want me to check if any milestones can be reordered or run simultaneously to save time or money?",
            "choice", null,
            ["Yes — find opportunities", "No — analyze as-is"]
          ), 350);
        }
        break;
      }
      case "SHUFFLE": {
        const wants = val.startsWith("Yes");
        setWantsShuffle(wants);
        setAnalyzing(true);
        setStage("ANALYZING");
        setTimeout(() => {
          const data = {
            name: projectRef.current.name,
            startDate: projectRef.current.startDate,
            targetDate: projectRef.current.targetDate,
            budget: projectRef.current.budgetType || "Flexible",
            totalBudget: projectRef.current.totalBudget,
            tasks: tasksRef.current,
            wantsShuffle: wants,
          };
          const encoded = encodeURIComponent(JSON.stringify(data));
          window.location.href = "/results?data=" + encoded;
        }, 1800);
        break;
      }
    }
  }

  const lastMsg = messages[messages.length - 1];
  const showInput = !["ANALYZING"].includes(stage) && lastMsg?.from === "bot" && !["choice"].includes(lastMsg?.input);

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:ital,opsz,wght@0,9..144,300;1,9..144,300&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotBlink { 0%,80%,100%{opacity:0} 40%{opacity:1} }
        input:focus { outline: none; }
        input::placeholder { color: #4A5A4A; }
        .choice-btn:hover { border-color: #3ECB6F !important; color: #3ECB6F !important; background: #0F2B1A !important; }
      `}</style>

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100vh", background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(62,203,111,0.1) 0%, transparent 65%)", pointerEvents: "none", zIndex: 0 }} />

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
        {/* Progress */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} style={{ width: 24, height: 3, borderRadius: 2, background: i < progress ? T.green : T.border, transition: "background 0.3s" }} />
            ))}
          </div>
          <span style={{ fontFamily: "monospace", fontSize: "0.65rem", color: T.textDim, letterSpacing: "0.08em" }}>{progress} of {TOTAL_STEPS}</span>
        </div>
      </div>

      {/* CHAT */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", maxWidth: 640, width: "100%", margin: "0 auto", position: "relative", zIndex: 1 }}>
        {messages.map((msg, i) => (
          <div key={msg.id} style={{ marginBottom: "0.85rem", display: "flex", justifyContent: msg.from === "user" ? "flex-end" : "flex-start", animation: "fadeUp 0.25s ease both" }}>
            {msg.from === "bot" && (
              <div style={{ maxWidth: "88%" }}>
                <div style={{ background: T.surface, border: "1px solid " + T.border2, borderRadius: "18px 18px 18px 4px", padding: "0.9rem 1.1rem", fontSize: "0.92rem", lineHeight: 1.65, color: T.text }}>
                  {msg.text.split(/(\*\*[^*]+\*\*)/).map((p, j) =>
                    p.startsWith("**") ? <strong key={j} style={{ color: T.green }}>{p.slice(2, -2)}</strong> : p
                  )}
                </div>
                {i === messages.length - 1 && msg.input === "choice" && msg.choices && !["ANALYZING"].includes(stage) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
                    {msg.choices.map(c => (
                      <button key={c} className="choice-btn" onClick={() => handleChoice(c)} style={{ background: T.bg, border: "1px solid " + T.border2, borderRadius: "100px", color: T.text, fontFamily: "inherit", fontSize: "0.88rem", padding: "0.7rem 1.1rem", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {msg.from === "user" && (
              <div style={{ background: T.greenDim, border: "1.5px solid " + T.greenMid, borderRadius: "18px 18px 4px 18px", padding: "0.7rem 1rem", maxWidth: "76%", fontSize: "0.88rem", color: T.green }}>
                {msg.text}
              </div>
            )}
          </div>
        ))}
        {analyzing && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.75rem 0" }}>
            <span style={{ fontFamily: "monospace", fontSize: "0.68rem", color: T.green, letterSpacing: "0.12em" }}>ANALYZING YOUR PLAN</span>
            {[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, background: T.green, borderRadius: "50%", display: "inline-block", animation: "dotBlink 1.4s " + (i * 0.22) + "s infinite" }} />)}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      {showInput && (
        <div style={{ padding: "0.9rem 1.5rem", borderTop: "1px solid " + T.border, background: "rgba(8,10,8,0.92)", backdropFilter: "blur(12px)", maxWidth: 640, width: "100%", margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              ref={inputRef}
              type={lastMsg?.input === "number" ? "number" : lastMsg?.input === "date" ? "date" : "text"}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleText(inputVal)}
              placeholder={lastMsg?.placeholder || "Type your answer..."}
              min={lastMsg?.input === "number" ? 1 : undefined}
              style={{ flex: 1, background: T.surface, border: "1px solid " + T.border2, borderRadius: "100px", color: T.text, fontFamily: "inherit", fontSize: "0.92rem", padding: "0.72rem 1.25rem", transition: "border-color 0.2s" }}
              onFocus={e => e.target.style.borderColor = T.green}
              onBlur={e => e.target.style.borderColor = T.border2}
            />
            <button onClick={() => handleText(inputVal)} style={{ background: T.green, color: "#080A08", border: "none", borderRadius: "100px", fontFamily: "inherit", fontWeight: 700, fontSize: "0.9rem", padding: "0.72rem 1.25rem", cursor: "pointer" }}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}
