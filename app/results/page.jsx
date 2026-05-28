"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ── COLOR SYSTEM (v7.1 locked) ────────────────────────────────────────────────
const C = {
  bg: "#0D1117", surface: "#161B22", surface2: "#1C2128", surface3: "#21262D",
  border: "#30363D", border2: "#21262D",
  text: "#E6EDF3", textMid: "#8B949E", textDim: "#484F58",
  purple: "#7C3AED", purpleLight: "#A78BFA", purpleDim: "#1A1035",
  green: "#22C55E", greenDim: "#0D2818", greenLight: "#4ADE80",
  amber: "#F59E0B", amberDim: "#2D1F00",
  red: "#EF4444", redDim: "#2D0808",
  blue: "#3B82F6",
};

// ── CONFIDENCE ENGINE ─────────────────────────────────────────────────────────
function computeConfidence(tasks, availableDays, projectDuration, budget, bufferDays, shuffleOps, byId) {
  const totalTasks = tasks.length;
  if (!totalTasks) return { score: 0, band: C.red, reason: "Not enough milestones.", breakdown: [] };
  const criticalTasks = tasks.filter(t => byId[t.id].slack === 0);
  const ownersMap = {};
  tasks.forEach(t => { if (t.owner && t.owner !== "UNASSIGNED") ownersMap[t.owner] = (ownersMap[t.owner] || 0) + 1; });
  const ownerCount = Object.keys(ownersMap).length || 1;
  const criticalPerOwner = {};
  criticalTasks.forEach(t => { if (t.owner && t.owner !== "UNASSIGNED") criticalPerOwner[t.owner] = (criticalPerOwner[t.owner] || 0) + 1; });
  const maxCriticalByOne = Math.max(...Object.values(criticalPerOwner), 0);
  const tightness = availableDays > 0 ? projectDuration / availableDays : 2;
  const timelineScore = tightness >= 1.1 ? 0 : tightness >= 0.95 ? 10 : tightness >= 0.85 ? 25 : tightness >= 0.7 ? 55 : tightness >= 0.5 ? 80 : 100;
  const budgetScore = budget === "Fixed" ? 15 : budget === "Tight" ? 45 : 90;
  const scopeRatio = totalTasks / ownerCount;
  const scopeScore = scopeRatio > 8 ? 15 : scopeRatio > 5 ? 35 : scopeRatio > 3 ? 60 : scopeRatio > 1.5 ? 80 : 95;
  const externalCount = tasks.filter(t => t.predecessors.length > 1).length;
  const externalScore = externalCount >= 5 ? 20 : externalCount >= 3 ? 45 : externalCount >= 1 ? 70 : 95;
  const concentrationRatio = criticalTasks.length > 0 ? maxCriticalByOne / criticalTasks.length : 0;
  const concentrationScore = concentrationRatio >= 0.8 ? 10 : concentrationRatio >= 0.6 ? 30 : concentrationRatio >= 0.4 ? 60 : concentrationRatio >= 0.2 ? 80 : 95;
  const concurrentCount = tasks.filter(t => t.concurrent).length;
  const sequencingScore = totalTasks > 3 && concurrentCount === 0 ? 20 : concurrentCount / totalTasks > 0.3 ? 90 : 60;
  const optimizationScore = shuffleOps.length >= 3 ? 20 : shuffleOps.length >= 1 ? 55 : 90;
  const raw = timelineScore*0.25 + budgetScore*0.25 + scopeScore*0.25 + externalScore*0.10 + concentrationScore*0.08 + sequencingScore*0.04 + optimizationScore*0.03;
  const score = Math.round(Math.min(Math.max(raw, 2), 98));
  let band;
  if (score >= 75) band = C.green;
  else if (score >= 55) band = C.amber;
  else band = C.red;
  const factors = [
    { name: "Timeline tightness", score: timelineScore, weight: 25 },
    { name: "Budget pressure", score: budgetScore, weight: 25 },
    { name: "Scope vs capacity", score: scopeScore, weight: 25 },
    { name: "External dependencies", score: externalScore, weight: 10 },
    { name: "Owner concentration", score: concentrationScore, weight: 8 },
    { name: "Plan sequencing", score: sequencingScore, weight: 4 },
    { name: "Optimization gaps", score: optimizationScore, weight: 3 },
  ];
  const lowest = [...factors].sort((a,b) => a.score - b.score)[0];
  let reason = "";
  if (lowest.name === "Timeline tightness") reason = bufferDays < 0 ? `Critical path runs ${Math.abs(bufferDays)} days over deadline` : `Only ${bufferDays} days of buffer on critical path`;
  else if (lowest.name === "Budget pressure") reason = `${budget} budget eliminates resource acceleration options`;
  else if (lowest.name === "Scope vs capacity") reason = "Too much work concentrated on too few owners";
  else if (lowest.name === "Owner concentration") reason = `One person owns ${maxCriticalByOne} of ${criticalTasks.length} critical path tasks`;
  else if (lowest.name === "External dependencies") reason = `${externalCount} tasks have multi-dependency exposure`;
  else if (lowest.name === "Plan sequencing") reason = "Fully sequential plan — no concurrent work identified";
  else reason = "Scheduling opportunities exist to measurably improve outcome";
  return { score, band, reason, breakdown: factors };
}

// ── PREDICTIVE RISK ENGINE ────────────────────────────────────────────────────
function computePredictiveRisk(tasks, byId, projectDuration, availableDays, bufferDays) {
  if (!tasks.length) return null;
  const criticalTasks = tasks.filter(t => byId[t.id].slack === 0);
  const milestoneRisks = tasks.map(t => {
    const task = byId[t.id];
    let prob = 0;
    const slackRatio = task.slack === 0 ? 1.0 : Math.max(0, 1 - (task.slack / Math.max(projectDuration * 0.1, 3)));
    prob += slackRatio * 0.40;
    const ownerCriticalCount = criticalTasks.filter(ct => ct.owner === t.owner && t.owner && t.owner !== "UNASSIGNED").length;
    const ownerConcentration = ownerCriticalCount >= 4 ? 1.0 : ownerCriticalCount >= 3 ? 0.8 : ownerCriticalCount >= 2 ? 0.55 : ownerCriticalCount >= 1 ? 0.3 : 0.1;
    prob += ownerConcentration * 0.25;
    function chainDepth(id, visited = new Set()) {
      if (visited.has(id)) return 0;
      visited.add(id);
      const tk = byId[id];
      if (!tk || !tk.predecessors || !tk.predecessors.length) return 0;
      return 1 + Math.max(...tk.predecessors.map(pid => chainDepth(pid, visited)));
    }
    const depth = chainDepth(t.id);
    const depthRisk = depth >= 6 ? 1.0 : depth >= 4 ? 0.8 : depth >= 2 ? 0.55 : depth >= 1 ? 0.35 : 0.1;
    prob += depthRisk * 0.20;
    const dependents = tasks.filter(s => s.predecessors && s.predecessors.includes(t.id)).length;
    const dependentRisk = dependents >= 5 ? 1.0 : dependents >= 3 ? 0.75 : dependents >= 1 ? 0.45 : 0.1;
    prob += dependentRisk * 0.15;
    const finalProb = Math.min(Math.max(Math.round(prob * 100), 5), 97);
    let reason = "";
    if (task.slack === 0 && dependents >= 3) reason = `Zero buffer · ${dependents} tasks waiting`;
    else if (task.slack === 0) reason = "Zero float — any slip cascades forward";
    else if (ownerCriticalCount >= 3) reason = `${t.owner} owns ${ownerCriticalCount} critical tasks`;
    else if (depth >= 4) reason = `${depth} dependencies deep — upstream risk compounds`;
    else if (dependents >= 3) reason = `${dependents} downstream tasks waiting`;
    else reason = "Limited buffer on critical path";
    return { id: t.id, name: t.name, owner: t.owner || "Unassigned", days: parseInt(t.days) || 1, slack: task.slack, prob: finalProb, reason, dependents, isCritical: task.slack === 0 };
  });
  const ranked = [...milestoneRisks].sort((a, b) => b.prob - a.prob);
  const top3 = ranked.slice(0, 3);
  const criticalRisks = milestoneRisks.filter(m => m.isCritical);
  const maxCriticalProb = criticalRisks.length > 0 ? Math.max(...criticalRisks.map(m => m.prob)) : 30;
  const bufferRatio = availableDays > 0 ? bufferDays / availableDays : -0.1;
  const bufferMultiplier = bufferRatio >= 0.15 ? 0.75 : bufferRatio >= 0.05 ? 0.88 : bufferRatio >= 0 ? 1.0 : 1.15;
  const zeroFloatCount = criticalTasks.length;
  const chainMultiplier = zeroFloatCount >= 6 ? 1.15 : zeroFloatCount >= 4 ? 1.05 : 1.0;
  const planProb = Math.min(Math.max(Math.round(maxCriticalProb * bufferMultiplier * chainMultiplier), 10), 96);
  const planBand = planProb >= 75 ? C.red : planProb >= 55 ? C.amber : C.green;
  return { planProb, planBand, top3, milestoneRisks };
}

// ── CPM ENGINE ────────────────────────────────────────────────────────────────
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
    if (successors.length) { t.lf = Math.min(...successors.map(s => byId[s.id].ls)); t.ls = t.lf - (parseInt(t.days)||1); }
    t.slack = Math.max(0, t.ls - t.es);
    t.predecessors.forEach(pid => backwardPass(pid));
  }
  const sinks = tasks.filter(t => !tasks.some(s => s.predecessors.includes(t.id)));
  sinks.forEach(t => { byId[t.id].lf = projectDuration; byId[t.id].ls = projectDuration-(parseInt(t.days)||1); byId[t.id].slack=0; backwardPass(t.id); });
  tasks.forEach(t => { byId[t.id].slack = Math.max(0, byId[t.id].ls - byId[t.id].es); });
  const start = new Date(startDate);
  const target = new Date(targetDate);
  const availableDays = Math.round((target-start)/86400000);
  const bufferDays = availableDays - projectDuration;
  const projDate = new Date(start); projDate.setDate(projDate.getDate()+projectDuration);
  let verdict, verdictColor, delayRisk, bottleneckSeverity;
  if (bufferDays >= 5) { verdict="ON TRACK"; verdictColor=C.green; delayRisk="Low"; bottleneckSeverity="Low"; }
  else if (bufferDays >= 0) { verdict="AT RISK"; verdictColor=C.amber; delayRisk="Moderate"; bottleneckSeverity="Moderate"; }
  else { verdict="DEADLINE OVERRUN"; verdictColor=C.red; delayRisk="High"; bottleneckSeverity="High"; }
  const criticalPath = tasks.filter(t=>byId[t.id].slack===0).map(t=>t.name);
  const totalTasks = tasks.length;
  const ownersSet = new Set(tasks.map(t=>t.owner).filter(Boolean));
  // Find SIBLING tasks — same predecessor, don't depend on each other
  // These can genuinely run concurrently (unlike parent→child which cannot)
  const concOps = [];
  const seen = new Set();
  tasks.forEach(taskA => {
    if (byId[taskA.id].slack !== 0) return; // only care about critical path
    tasks.forEach(taskB => {
      if (taskA.id === taskB.id) return;
      if (seen.has(taskA.id + "_" + taskB.id) || seen.has(taskB.id + "_" + taskA.id)) return;
      // They must share at least one predecessor
      const sharedPreds = taskA.predecessors.filter(pid => taskB.predecessors.includes(pid));
      if (sharedPreds.length === 0) return;
      // Neither can be a predecessor of the other
      if (taskA.predecessors.includes(taskB.id) || taskB.predecessors.includes(taskA.id)) return;
      // Neither can already be concurrent
      if (taskA.concurrent || taskB.concurrent) return;
      seen.add(taskA.id + "_" + taskB.id);
      const sharedPred = tasks.find(p => p.id === sharedPreds[0]);
      const daysSaved = Math.min(parseInt(taskB.days)||1, parseInt(taskA.days)||1);
      concOps.push({
        task: taskB.name,
        predecessor: taskA.name,
        sharedPredecessor: sharedPred?.name,
        daysSaved: Math.floor(daysSaved * 0.5),
        reason: sharedPred
          ? `"${taskA.name}" and "${taskB.name}" both start after "${sharedPred.name}" — they can run at the same time instead of back-to-back.`
          : `"${taskA.name}" and "${taskB.name}" can run in parallel — they don't depend on each other.`,
      });
    });
  });
  // If no sibling ops found, look for tasks that could start earlier (partial overlap)
  if (concOps.length === 0) {
    tasks.forEach(t => {
      if (!t.concurrent && t.predecessors.length && byId[t.id].slack === 0) {
        const pred = tasks.find(p => p.id === t.predecessors[0]);
        // Only suggest overlap if the predecessor is long enough to allow a head start
        if (pred && (parseInt(pred.days)||1) >= 4) {
          concOps.push({
            task: t.name,
            predecessor: pred.name,
            daysSaved: Math.floor((parseInt(pred.days)||1) * 0.3),
            reason: `"${t.name}" could start in the final days of "${pred.name}" — a partial overlap instead of waiting for full completion.`,
          });
        }
      }
    });
  }
  const shuffleOps = concOps.slice(0,3);
  // Current score — plan as entered, no changes made
  const confidence = computeConfidence(tasks, availableDays, projectDuration, budget||"Flexible", bufferDays, shuffleOps, byId);
  // Optimized score — if all recommended concurrency changes are applied
  const optimizedDaysSaved = shuffleOps.reduce((a,o)=>a+o.daysSaved,0);
  const optimizedBufferDays = bufferDays + optimizedDaysSaved;
  // Re-run confidence with optimized tasks marked concurrent and better buffer
  const optimizedTasks = tasks.map(t => {
    const op = shuffleOps.find(o => o.task === t.name);
    return op ? { ...t, concurrent: true } : t;
  });
  const confidenceOptimized = computeConfidence(optimizedTasks, availableDays, projectDuration, budget||"Flexible", optimizedBufferDays, [], byId);
  const predictiveRisk = computePredictiveRisk(tasks, byId, projectDuration, availableDays, bufferDays);
  const criticalTasks = tasks.filter(t=>byId[t.id].slack===0);
  const ownersMap = {};
  tasks.forEach(t => { if(t.owner) ownersMap[t.owner]=(ownersMap[t.owner]||0)+1; });
  const maxOwner = Object.entries(ownersMap).sort((a,b)=>b[1]-a[1])[0];
  const bottleneck = criticalTasks.length > 0 ? {
    name: criticalTasks.sort((a,b)=>tasks.filter(s=>s.predecessors.includes(b.id)).length - tasks.filter(s=>s.predecessors.includes(a.id)).length)[0]?.name,
    owner: maxOwner?.[0],
    reason: maxOwner ? `${maxOwner[0]} owns ${maxOwner[1]} of ${totalTasks} tasks` : "Single-threaded critical path",
  } : null;
  return {
    tasks: Object.values(byId), projectDuration, bufferDays, verdict, verdictColor,
    projectedDate: projDate.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}),
    projectedRange: `${projDate.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${new Date(projDate.getTime()+4*86400000).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`,
    availableDays, criticalPath, shuffleOps, confidence, confidenceOptimized, predictiveRisk,
    delayRisk, bottleneckSeverity, totalTasks, teamSize: ownersSet.size,
    bottleneck, startDate,
  };
}


// ── P1-2: CASCADE IMPACT SIMULATOR ENGINE ────────────────────────────────────
function computeCascadeImpact(tasks, result, slippingTaskId, delayDays, startDate, targetDate, budget) {
  if (!slippingTaskId || !delayDays) return null;
  const slippingTask = tasks.find(t => t.id === slippingTaskId);
  const slippingResultTask = result.tasks.find(t => t.id === slippingTaskId);
  if (!slippingTask || !slippingResultTask) return null;
  const float = slippingResultTask.slack || 0;
  const netDelay = Math.max(0, delayDays - float);
  const floatAbsorbed = Math.min(float, delayDays);
  function getDownstream(id) {
    const set = new Set();
    function walk(tid) { tasks.filter(t => t.predecessors.includes(tid)).forEach(t => { if (!set.has(t.id)) { set.add(t.id); walk(t.id); } }); }
    walk(id);
    return [...set];
  }
  const downstreamIds = getDownstream(slippingTaskId);
  const downstreamTasks = downstreamIds.map(id => tasks.find(t => t.id === id)).filter(Boolean);
  const criticalDownstream = downstreamTasks.filter(t => result.tasks.find(r => r.id === t.id)?.slack === 0);
  if (netDelay === 0) {
    return { noImpact: true, taskName: slippingTask.name, delayDays, floatAbsorbed,
      message: `${slippingTask.name} has ${float} days of float — a ${delayDays}-day slip is fully absorbed. Deadline unchanged.` };
  }
  const modifiedTasks = tasks.map(t => t.id === slippingTaskId ? { ...t, days: (parseInt(t.days)||1) + delayDays } : t);
  const newResult = computeCPM(modifiedTasks, startDate, targetDate, budget);
  if (!newResult) return null;
  const daysAdded = newResult.projectDuration - result.projectDuration;
  const start = new Date(startDate);
  const newFinish = new Date(start); newFinish.setDate(newFinish.getDate() + newResult.projectDuration);
  const oldFinish = new Date(start); oldFinish.setDate(oldFinish.getDate() + result.projectDuration);
  const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const totalCost = tasks.reduce((a,t)=>{const c=parseFloat((t.cost||"0").replace(/[^0-9.]/g,""))||0;return a+c;},0);
  const dailyBurn = totalCost > 0 && result.projectDuration > 0 ? totalCost / result.projectDuration : 0;
  const costExposure = daysAdded * dailyBurn;
  const newConf = newResult.confidence.score;
  const oldConf = result.confidence.score;
  const newRisk = newResult.predictiveRisk?.planProb || 0;
  const oldRisk = result.predictiveRisk?.planProb || 0;
  const fix = result.shuffleOps.find(op => op.task === slippingTask.name || op.predecessor === slippingTask.name);
  const newlyBlocked = downstreamTasks.filter(t => {
    const wasOk = (result.tasks.find(r => r.id === t.id)?.slack || 0) > 0;
    const nowCrit = (newResult.tasks.find(r => r.id === t.id)?.slack || 0) === 0;
    return wasOk && nowCrit;
  });
  return { noImpact: false, taskName: slippingTask.name, taskOwner: slippingTask.owner, delayDays, netDelay, floatAbsorbed, daysAdded,
    oldFinish: fmt(oldFinish), newFinish: fmt(newFinish), downstreamCount: downstreamIds.length,
    criticalDownstreamCount: criticalDownstream.length, newlyBlocked, oldConf, newConf, confDelta: newConf - oldConf,
    oldRisk, newRisk, costExposure, dailyBurn, fix, newResult };
}

// ── P1-2: CASCADE SIMULATOR PANEL ────────────────────────────────────────────
function CascadeSimulator({ tasks, result, simulatorTaskId, onTaskChange, startDate, targetDate, budget }) {
  const [delayDays, setDelayDays] = useState(3);
  const impact = simulatorTaskId ? computeCascadeImpact(tasks, result, simulatorTaskId, delayDays, startDate, targetDate, budget) : null;
  const selectedResultTask = result.tasks.find(t => t.id === simulatorTaskId);
  const card2 = (extra={}) => ({ background: C.surface2, border: "1px solid " + C.border, borderRadius: 10, ...extra });
  return (
    <div style={{ border: "1px solid " + C.border, borderRadius: 12, overflow: "hidden", marginTop: "1rem" }}>
      <div style={{ background: C.surface, borderBottom: "1px solid " + C.border, padding: "0.85rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.12em", color: C.amber, textTransform: "uppercase" }}>⚡ Cascade Impact Simulator</div>
        <div style={{ fontSize: "0.75rem", color: C.textMid }}>What if a task slips? See the full downstream effect instantly.</div>
      </div>
      <div style={{ padding: "1.25rem", background: C.surface }}>
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: "0.6rem", color: C.textDim, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.4rem" }}>SELECT TASK</div>
            <select value={simulatorTaskId || ""} onChange={e => onTaskChange(e.target.value || null)}
              style={{ width: "100%", background: C.surface2, border: "1px solid " + C.border, borderRadius: 8, color: C.text, fontFamily: "inherit", fontSize: "0.85rem", padding: "0.55rem 0.85rem", cursor: "pointer", appearance: "none" }}>
              <option value="">— Pick a task to simulate —</option>
              {tasks.map(t => { const rt = result.tasks.find(r => r.id === t.id); const isCrit = rt?.slack === 0;
                return <option key={t.id} value={t.id}>{isCrit?"◆ ":""}{t.name} ({t.days}d{rt?.slack>0?` · +${rt.slack}d float`:" · zero float"})</option>; })}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: "0.6rem", color: C.textDim, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
              SLIP BY — <span style={{ color: C.red }}>{delayDays} {delayDays===1?"day":"days"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <input type="range" min={1} max={21} value={delayDays} onChange={e => setDelayDays(parseInt(e.target.value))} style={{ flex: 1, accentColor: C.red }}/>
              <span style={{ fontSize: "0.75rem", color: C.textDim, whiteSpace: "nowrap" }}>1–21d</span>
            </div>
            {selectedResultTask && selectedResultTask.slack > 0 && (
              <div style={{ fontSize: "0.68rem", color: C.amber, marginTop: "0.3rem" }}>{selectedResultTask.slack}d float absorbs first {selectedResultTask.slack} day{selectedResultTask.slack>1?"s":""} of slip</div>
            )}
          </div>
        </div>
        {!simulatorTaskId && (
          <div style={{ textAlign: "center", padding: "2rem", color: C.textDim, fontSize: "0.85rem", border: "1px dashed " + C.border, borderRadius: 10 }}>
            Select a task above — or click ⚡ Simulate delay on any node in the graph
          </div>
        )}
        {impact?.noImpact && (
          <div style={{ background: C.greenDim, border: "1px solid " + C.green + "30", borderRadius: 10, padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.2rem" }}>✓</span>
            <div><div style={{ fontSize: "0.82rem", fontWeight: 700, color: C.green, marginBottom: "0.2rem" }}>No cascade impact</div><div style={{ fontSize: "0.78rem", color: C.textMid }}>{impact.message}</div></div>
          </div>
        )}
        {impact && !impact.noImpact && (
          <div>
            <div style={{ background: "#160404", border: "1px solid " + C.red + "40", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1rem", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: C.red }}/>
              <div style={{ fontSize: "0.68rem", color: C.red, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                CASCADE IMPACT — IF {impact.taskName.toUpperCase()} SLIPS {impact.delayDays} DAY{impact.delayDays>1?"S":""}
              </div>
              <div style={{ fontSize: "1rem", color: C.text, fontWeight: 600, lineHeight: 1.6 }}>
                {impact.floatAbsorbed > 0 && <span style={{ color: C.amber }}>{impact.floatAbsorbed}d float absorbed → </span>}
                <span style={{ color: C.red }}>+{impact.netDelay} day{impact.netDelay>1?"s":""} added to project</span>
              </div>
              <div style={{ fontSize: "0.82rem", color: C.textMid, marginTop: "0.3rem" }}>
                Finish moves from <strong style={{ color: C.text }}>{impact.oldFinish}</strong> to <strong style={{ color: C.red }}>{impact.newFinish}</strong>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.65rem", marginBottom: "1rem" }}>
              {[
                { label: "NEW FINISH DATE", val: impact.newFinish, sub: `was ${impact.oldFinish}`, color: C.red },
                { label: "DAYS ADDED", val: `+${impact.daysAdded}d`, sub: impact.floatAbsorbed>0?`${impact.floatAbsorbed}d float absorbed`:"zero float — full slip", color: C.red },
                { label: "TASKS BLOCKED", val: impact.downstreamCount, sub: `${impact.criticalDownstreamCount} on critical path`, color: C.amber },
                { label: "CONFIDENCE", val: `${impact.newConf}%`, sub: `was ${impact.oldConf}% (${impact.confDelta>0?"+":""}${impact.confDelta}pts)`, color: impact.confDelta<-10?C.red:impact.confDelta<0?C.amber:C.green },
                { label: "DEADLINE RISK", val: `${impact.newRisk}%`, sub: `was ${impact.oldRisk}% (+${impact.newRisk-impact.oldRisk}pts)`, color: impact.newRisk>=75?C.red:impact.newRisk>=55?C.amber:C.green },
                ...(impact.dailyBurn>0?[{ label: "COST EXPOSURE", val: `$${Math.round(impact.costExposure).toLocaleString()}`, sub: `at $${Math.round(impact.dailyBurn)}/day`, color: C.amber }]:[]),
              ].map((m, i) => (
                <div key={i} style={{ ...card2(), padding: "0.75rem 0.85rem" }}>
                  <div style={{ fontSize: "0.55rem", color: C.textDim, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.3rem" }}>{m.label}</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.val}</div>
                  <div style={{ fontSize: "0.68rem", color: C.textDim, marginTop: "0.25rem" }}>{m.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ ...card2(), padding: "0.85rem 1rem", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.6rem", color: C.textDim, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.65rem" }}>ON-TIME DELIVERY CONFIDENCE</div>
              {[{ label: "Before slip", val: impact.oldConf, color: C.amber }, { label: `After ${impact.delayDays}d slip`, val: impact.newConf, color: impact.newConf<35?C.red:C.amber }].map((b, i) => (
                <div key={i} style={{ marginBottom: i===0?"0.5rem":0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.72rem", color: C.textMid }}>{b.label}</span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: b.color }}>{b.val}%</span>
                  </div>
                  <div style={{ height: 6, background: C.border2, borderRadius: 3 }}>
                    <div style={{ height: "100%", width: b.val+"%", background: b.color, borderRadius: 3, transition: "width 0.4s ease" }}/>
                  </div>
                </div>
              ))}
            </div>
            {impact.newlyBlocked.length > 0 && (
              <div style={{ ...card2(), padding: "0.85rem 1rem", marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.6rem", color: C.red, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>NEWLY CRITICAL — tasks that lose all float</div>
                {impact.newlyBlocked.map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.35rem 0", borderBottom: i<impact.newlyBlocked.length-1?"1px solid "+C.border2:"none" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.red, flexShrink: 0 }}/>
                    <span style={{ fontSize: "0.8rem", color: C.text }}>{t.name}</span>
                    <span style={{ fontSize: "0.68rem", color: C.textDim, marginLeft: "auto" }}>{t.owner}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ background: C.greenDim, border: "1px solid " + C.green + "30", borderRadius: 10, padding: "1rem 1.25rem" }}>
              <div style={{ fontSize: "0.6rem", color: C.green, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>PATHFLO RECOMMENDATION</div>
              {impact.fix ? (
                <div>
                  <div style={{ fontSize: "0.85rem", color: C.text, fontWeight: 600, marginBottom: "0.3rem" }}>Run "{impact.fix.task}" concurrently with "{impact.fix.predecessor}"</div>
                  <div style={{ fontSize: "0.78rem", color: C.textMid, lineHeight: 1.6 }}>Recovers ~{impact.fix.daysSaved} of the {impact.daysAdded} days added at zero additional cost.{impact.daysAdded<=impact.fix.daysSaved?" Fully offsets this slip.":" Net delay reduced to "+(impact.daysAdded-impact.fix.daysSaved)+" days."}</div>
                </div>
              ) : (
                <div style={{ fontSize: "0.82rem", color: C.textMid, lineHeight: 1.6 }}>Validate {impact.taskOwner||"owner"} availability immediately. With zero float and {impact.downstreamCount} downstream tasks waiting, this slip has no buffer to absorb it. Consider whether any downstream tasks can be started earlier or run in parallel.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DEPENDENCY GRAPH — P1-1 INTERACTIVE ──────────────────────────────────────
function DependencyGraph({ tasks, result, onNodeClick, simulatorTaskId }) {
  const canvasRef = useRef(null);
  const nodePositionsRef = useRef({});
  const hoveredRef = useRef(null);
  const selectedRef = useRef(null);

  // Build node positions — extracted so both draw + hit-test can use
  const buildLayout = useCallback((W, H) => {
    const nodeW = 110, nodeH = 46, padX = 60;
    const levels = {};
    function assignLevel(id, lvl) {
      if (levels[id] !== undefined && levels[id] >= lvl) return;
      levels[id] = lvl;
      tasks.filter(t => t.predecessors.includes(id)).forEach(s => assignLevel(s.id, lvl + 1));
    }
    tasks.filter(t => t.predecessors.length === 0).forEach(t => assignLevel(t.id, 0));
    tasks.forEach(t => { if (levels[t.id] === undefined) assignLevel(t.id, 0); });

    const maxLevel = Math.max(...Object.values(levels), 0);
    const levelGroups = {};
    tasks.forEach(t => {
      const lvl = levels[t.id] || 0;
      if (!levelGroups[lvl]) levelGroups[lvl] = [];
      levelGroups[lvl].push(t);
    });

    const totalLevels = maxLevel + 1;
    const colW = Math.max(nodeW + padX, (W - 40) / totalLevels);
    const positions = {};
    Object.entries(levelGroups).forEach(([lvl, group]) => {
      const x = 20 + lvl * colW + colW / 2 - nodeW / 2;
      const totalH = group.length * (nodeH + 16) - 16;
      const startY = (H - totalH) / 2;
      group.forEach((t, i) => {
        positions[t.id] = { x, y: Math.max(28, startY) + i * (nodeH + 16), w: nodeW, h: nodeH };
      });
    });
    return positions;
  }, [tasks]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result || !tasks.length) return;
    const dpr = window.devicePixelRatio || 1;
    const containerW = canvas.parentElement.clientWidth || 700;
    // On mobile, use minimum width so nodes don't crunch — allow horizontal scroll
    const minW = Math.max(containerW, tasks.length * 130 + 80);
    const W = minW;
    const H = 420;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const byId = {};
    result.tasks.forEach(t => { byId[t.id] = t; });

    const positions = buildLayout(W, H);
    nodePositionsRef.current = positions;

    const criticalIds = new Set(result.tasks.filter(t => t.slack === 0).map(t => t.id));
    const hoveredId = hoveredRef.current;
    const selectedId = selectedRef.current;

    // Connected node sets for hover highlight
    const upstreamOf = (id) => {
      const set = new Set();
      function walk(tid) {
        const t = tasks.find(t => t.id === tid);
        if (!t) return;
        t.predecessors.forEach(pid => { if (!set.has(pid)) { set.add(pid); walk(pid); } });
      }
      walk(id);
      return set;
    };
    const downstreamOf = (id) => {
      const set = new Set();
      function walk(tid) {
        tasks.filter(t => t.predecessors.includes(tid)).forEach(t => {
          if (!set.has(t.id)) { set.add(t.id); walk(t.id); }
        });
      }
      walk(id);
      return set;
    };

    const focusId = hoveredId || selectedId;
    const upstream = focusId ? upstreamOf(focusId) : new Set();
    const downstream = focusId ? downstreamOf(focusId) : new Set();
    const connected = new Set([...upstream, ...downstream]);

    // Cascade zone
    const cascadeNodes = [...criticalIds].map(id => positions[id]).filter(Boolean);
    if (cascadeNodes.length > 2) {
      const minX = Math.min(...cascadeNodes.map(n => n.x)) - 12;
      const minY = Math.min(...cascadeNodes.map(n => n.y)) - 12;
      const maxX = Math.max(...cascadeNodes.map(n => n.x + 110)) + 12;
      const maxY = Math.max(...cascadeNodes.map(n => n.y + 46)) + 12;
      ctx.fillStyle = "rgba(239,68,68,0.04)";
      ctx.strokeStyle = "rgba(239,68,68,0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.roundRect(minX, minY, maxX - minX, maxY - minY, 12);
      ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "rgba(239,68,68,0.7)";
      ctx.font = "700 9px system-ui";
      ctx.fillText("CASCADE IMPACT ZONE", minX + 8, minY + 14);
    }

    // Draw edges
    tasks.forEach(t => {
      t.predecessors.forEach(pid => {
        const from = positions[pid];
        const to = positions[t.id];
        if (!from || !to) return;
        const isCritEdge = criticalIds.has(pid) && criticalIds.has(t.id);
        const isConnectedEdge = focusId && (
          (pid === focusId || t.id === focusId) ||
          (upstream.has(pid) && upstream.has(t.id)) ||
          (downstream.has(pid) && downstream.has(t.id)) ||
          (upstream.has(pid) && t.id === focusId) ||
          (pid === focusId && downstream.has(t.id))
        );
        const dimmed = focusId && !isConnectedEdge;

        ctx.strokeStyle = dimmed
          ? "rgba(72,79,88,0.15)"
          : isConnectedEdge
            ? (isCritEdge ? "rgba(239,68,68,0.9)" : "rgba(124,58,237,0.7)")
            : (isCritEdge ? "rgba(239,68,68,0.5)" : "rgba(139,148,158,0.3)");
        ctx.lineWidth = isConnectedEdge ? 2.5 : (isCritEdge ? 2 : 1.5);
        ctx.setLineDash(t.concurrent ? [5, 4] : []);

        const fx = from.x + 110, fy = from.y + 23;
        const tx2 = to.x, ty = to.y + 23;
        const cp = (tx2 - fx) * 0.45;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.bezierCurveTo(fx + cp, fy, tx2 - cp, ty, tx2, ty);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrowhead
        const ang = Math.atan2(ty - fy, tx2 - fx);
        ctx.fillStyle = dimmed
          ? "rgba(72,79,88,0.15)"
          : isConnectedEdge
            ? (isCritEdge ? "rgba(239,68,68,0.9)" : "rgba(124,58,237,0.7)")
            : (isCritEdge ? "rgba(239,68,68,0.7)" : "rgba(139,148,158,0.4)");
        ctx.beginPath();
        ctx.moveTo(tx2, ty);
        ctx.lineTo(tx2 - 8 * Math.cos(ang - 0.35), ty - 8 * Math.sin(ang - 0.35));
        ctx.lineTo(tx2 - 8 * Math.cos(ang + 0.35), ty - 8 * Math.sin(ang + 0.35));
        ctx.closePath(); ctx.fill();
      });
    });

    // Draw nodes
    tasks.forEach(t => {
      const pos = positions[t.id];
      if (!pos) return;
      const task = result.tasks.find(rt => rt.id === t.id);
      const isCrit = task?.slack === 0;
      const isBottleneck = task && result.bottleneck?.name === t.name;
      const isHovered = t.id === hoveredId;
      const isSelected = t.id === selectedId;
      const isUpstream = upstream.has(t.id);
      const isDownstream = downstream.has(t.id);
      const dimmed = focusId && t.id !== focusId && !connected.has(t.id);

      let bg, border, textColor;
      if (t.id === simulatorTaskId) {
        bg = "rgba(245,158,11,0.2)"; border = C.amber; textColor = C.amber;
      } else if (isSelected) {
        bg = "rgba(124,58,237,0.25)"; border = C.purple; textColor = C.purpleLight;
      } else if (isUpstream) {
        bg = "rgba(59,130,246,0.15)"; border = "rgba(59,130,246,0.8)"; textColor = C.blue;
      } else if (isDownstream) {
        bg = "rgba(239,68,68,0.12)"; border = "rgba(239,68,68,0.6)"; textColor = "#F87171";
      } else if (isCrit && result.bufferDays < 0) {
        bg = "rgba(239,68,68,0.15)"; border = C.red; textColor = C.red;
      } else if (isCrit) {
        bg = "rgba(239,68,68,0.1)"; border = "rgba(239,68,68,0.7)"; textColor = "#F87171";
      } else if (t.concurrent) {
        bg = "rgba(34,197,94,0.08)"; border = "rgba(34,197,94,0.4)"; textColor = C.green;
      } else {
        bg = "rgba(28,33,40,0.8)"; border = C.border; textColor = C.textMid;
      }

      if (dimmed) { bg = "rgba(22,27,34,0.4)"; border = "rgba(48,54,61,0.3)"; textColor = C.textDim; }

      if (isBottleneck && !dimmed) { ctx.shadowColor = C.amber; ctx.shadowBlur = 12; }
      if (isHovered && !isSelected) { ctx.shadowColor = C.purple; ctx.shadowBlur = 10; }

      ctx.fillStyle = bg;
      ctx.strokeStyle = border;
      ctx.lineWidth = (isSelected || isHovered) ? 2.5 : (isCrit ? 2 : 1);
      ctx.beginPath();
      ctx.roundRect(pos.x, pos.y, 110, 46, 8);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;

      // Selected ring
      if (isSelected) {
        ctx.strokeStyle = C.purple;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.roundRect(pos.x - 3, pos.y - 3, 116, 52, 11);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = dimmed ? C.textDim : textColor;
      ctx.font = `${(isCrit || isSelected) ? "700" : "500"} 10px system-ui`;
      ctx.textAlign = "left";
      const name = t.name.length > 14 ? t.name.slice(0, 13) + "…" : t.name;
      ctx.fillText(name, pos.x + 8, pos.y + 17);

      ctx.fillStyle = dimmed ? "#3a3f46" : C.textDim;
      ctx.font = "400 9px system-ui";
      // Show "Blocked by X" only if this task is critical AND has a critical predecessor
      const critPred = isCrit && t.predecessors.length > 0
        ? t.predecessors.map(pid => tasks.find(p => p.id === pid)).find(p => p && criticalIds.has(p.id))
        : null;
      const subLabel = critPred
        ? `Blocked by ${critPred.name}`.slice(0, 20)
        : `${t.days}d · ${t.owner || "?"}`.slice(0, 18);
      ctx.fillText(subLabel, pos.x + 8, pos.y + 30);

      const dot = isCrit ? C.red : C.green;
      ctx.fillStyle = dimmed ? "#3a3f46" : dot;
      ctx.beginPath();
      ctx.arc(pos.x + 100, pos.y + 10, 3.5, 0, Math.PI * 2);
      ctx.fill();

      if (task?.slack > 0 && !dimmed) {
        ctx.fillStyle = "rgba(34,197,94,0.2)";
        ctx.beginPath();
        ctx.roundRect(pos.x + 82, pos.y + 32, 22, 10, 3);
        ctx.fill();
        ctx.fillStyle = C.green;
        ctx.font = "600 7.5px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(`+${task.slack}d`, pos.x + 93, pos.y + 40);
      }
      ctx.textAlign = "left";
    });

    // Legend
    const legend = [
      { color: C.red, label: "Critical" },
      { color: C.green, label: "On Track" },
      { color: C.amber, label: "Bottleneck" },
      { color: C.blue, label: "Upstream" },
      { color: C.purple, label: "Selected" },
    ];
    legend.forEach((l, i) => {
      const lx = 12 + i * 90, ly = H - 14;
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.arc(lx + 5, ly + 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.textDim;
      ctx.font = "400 9px system-ui";
      ctx.fillText(l.label, lx + 14, ly + 6);
    });

    // Click hint if nothing selected
    if (!selectedId) {
      ctx.fillStyle = "rgba(139,148,158,0.4)";
      ctx.font = "400 9px system-ui";
      ctx.textAlign = "right";
      ctx.fillText("Click any node for details", W - 12, H - 12);
      ctx.textAlign = "left";
    }
  }, [tasks, result, buildLayout]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const h = () => draw();
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [draw]);

  // Hit test
  const hitTest = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const positions = nodePositionsRef.current;
    for (const [id, pos] of Object.entries(positions)) {
      if (x >= pos.x && x <= pos.x + 110 && y >= pos.y && y <= pos.y + 46) {
        return id;
      }
    }
    return null;
  }, []);

  const handleMouseMove = useCallback((e) => {
    const id = hitTest(e.clientX, e.clientY);
    if (id !== hoveredRef.current) {
      hoveredRef.current = id;
      canvasRef.current.style.cursor = id ? "pointer" : "default";
      draw();
    }
  }, [hitTest, draw]);

  const handleMouseLeave = useCallback(() => {
    if (hoveredRef.current !== null) {
      hoveredRef.current = null;
      draw();
    }
  }, [draw]);

  const handleClick = useCallback((e) => {
    const id = hitTest(e.clientX, e.clientY);
    if (id === selectedRef.current) {
      // Deselect on second click
      selectedRef.current = null;
      onNodeClick && onNodeClick(null);
    } else {
      selectedRef.current = id;
      onNodeClick && onNodeClick(id);
    }
    draw();
  }, [hitTest, draw, onNodeClick]);

  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onTouchEnd={(e) => {
          const touch = e.changedTouches[0];
          if (touch) handleClick({ clientX: touch.clientX, clientY: touch.clientY });
        }}
      />
    </div>
  );
}

// ── NODE DETAIL PANEL (P1-1) ──────────────────────────────────────────────────
function NodeDetailPanel({ nodeId, tasks, result, onClose, onSimulate }) {
  if (!nodeId) return null;

  const task = tasks.find(t => t.id === nodeId);
  const resultTask = result.tasks.find(t => t.id === nodeId);
  if (!task || !resultTask) return null;

  const isCritical = resultTask.slack === 0;
  const accentColor = isCritical ? C.red : resultTask.slack < 3 ? C.amber : C.green;

  // Cascade chain — upstream tasks
  const upstream = [];
  function walkUp(id, depth = 0) {
    if (depth > 8) return;
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    t.predecessors.forEach(pid => {
      const pt = tasks.find(t => t.id === pid);
      if (pt && !upstream.find(u => u.id === pid)) {
        upstream.push({ id: pid, name: pt.name, depth });
        walkUp(pid, depth + 1);
      }
    });
  }
  walkUp(nodeId);

  // Downstream tasks
  const downstream = tasks.filter(t => t.predecessors.includes(nodeId));

  // Risk data
  const riskData = result.predictiveRisk?.milestoneRisks?.find(m => m.id === nodeId);
  const riskColor = riskData?.prob >= 75 ? C.red : riskData?.prob >= 55 ? C.amber : C.green;

  // Recommended fix
  const fix = result.shuffleOps.find(op => op.task === task.name || op.predecessor === task.name);
  const fixText = fix
    ? `Run "${fix.task}" concurrently with "${fix.predecessor}" — recovers ~${fix.daysSaved} days`
    : isCritical
      ? `Validate ${task.owner || "owner"} availability before start. Any delay propagates forward with no buffer.`
      : `${resultTask.slack} days of float — monitor but not critical.`;

  return (
    <div style={{
      width: typeof window!=="undefined"&&window.innerWidth<768?"100%":280,
      flexShrink: 0,
      background: C.surface,
      borderLeft: typeof window!=="undefined"&&window.innerWidth>=768?"1px solid "+C.border:"none",
      borderTop: typeof window!=="undefined"&&window.innerWidth<768?"1px solid "+C.border:"none",
      display: "flex", flexDirection: "column",
      animation: "slideIn 0.2s ease both",
      overflowY: "auto",
      maxHeight: typeof window!=="undefined"&&window.innerWidth<768?"60vh":"none",
    }}>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}`}</style>

      {/* Header */}
      <div style={{
        padding: "1rem",
        borderBottom: "1px solid " + C.border,
        position: "relative",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accentColor }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "0.25rem" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.6rem", color: accentColor, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.3rem" }}>
              {isCritical ? "CRITICAL PATH" : "TASK DETAIL"}
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: C.text, lineHeight: 1.3, wordBreak: "break-word" }}>{task.name}</div>
            <div style={{ fontSize: "0.72rem", color: C.textMid, marginTop: "0.25rem" }}>{task.owner || "Unassigned"} · {task.days} days</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.textDim, cursor: "pointer", fontSize: "1.1rem", padding: "0 0 0 0.5rem", flexShrink: 0 }}>✕</button>
        </div>
        {/* Status badge */}
        <div style={{ marginTop: "0.65rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <span style={{ background: accentColor + "20", color: accentColor, fontSize: "0.62rem", fontWeight: 700, padding: "0.15rem 0.55rem", borderRadius: 100, border: "1px solid " + accentColor + "40" }}>
            {isCritical ? "Zero float" : `+${resultTask.slack}d float`}
          </span>
          {riskData && (
            <span style={{ background: riskColor + "15", color: riskColor, fontSize: "0.62rem", fontWeight: 700, padding: "0.15rem 0.55rem", borderRadius: 100, border: "1px solid " + riskColor + "30" }}>
              {riskData.prob}% risk
            </span>
          )}
          {task.concurrent && (
            <span style={{ background: C.green + "15", color: C.green, fontSize: "0.62rem", fontWeight: 700, padding: "0.15rem 0.55rem", borderRadius: 100, border: "1px solid " + C.green + "30" }}>
              Concurrent
            </span>
          )}
        </div>
      </div>

      {/* Timing */}
      <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid " + C.border }}>
        <div style={{ fontSize: "0.58rem", color: C.textDim, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>TIMING</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          {[
            { label: "Starts", val: `Day ${resultTask.es + 1}` },
            { label: "Finishes", val: `Day ${resultTask.ef}` },
            { label: "Duration", val: `${task.days} days` },
            { label: "Float", val: isCritical ? "None" : `${resultTask.slack}d` },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: "0.58rem", color: C.textDim }}>{s.label}</div>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: C.text }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cascade chain */}
      {(upstream.length > 0 || downstream.length > 0) && (
        <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid " + C.border }}>
          <div style={{ fontSize: "0.58rem", color: C.textDim, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>CASCADE CHAIN</div>
          {upstream.length > 0 && (
            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.62rem", color: C.blue, marginBottom: "0.3rem" }}>↑ Upstream ({upstream.length})</div>
              {upstream.slice(0, 4).map((u, i) => (
                <div key={i} style={{ fontSize: "0.75rem", color: C.textMid, padding: "0.2rem 0", borderBottom: i < Math.min(upstream.length, 4) - 1 ? "1px solid " + C.border2 : "none" }}>
                  {u.name}
                </div>
              ))}
              {upstream.length > 4 && <div style={{ fontSize: "0.68rem", color: C.textDim }}>+{upstream.length - 4} more</div>}
            </div>
          )}
          {downstream.length > 0 && (
            <div>
              <div style={{ fontSize: "0.62rem", color: C.red, marginBottom: "0.3rem" }}>↓ Downstream ({downstream.length})</div>
              {downstream.slice(0, 4).map((d, i) => (
                <div key={i} style={{ fontSize: "0.75rem", color: C.textMid, padding: "0.2rem 0", borderBottom: i < Math.min(downstream.length, 4) - 1 ? "1px solid " + C.border2 : "none" }}>
                  {d.name}
                  {result.tasks.find(t => t.id === d.id)?.slack === 0 && <span style={{ color: C.red, marginLeft: "0.35rem", fontSize: "0.6rem" }}>CRITICAL</span>}
                </div>
              ))}
              {downstream.length > 4 && <div style={{ fontSize: "0.68rem", color: C.textDim }}>+{downstream.length - 4} more</div>}
            </div>
          )}
        </div>
      )}

      {/* Risk detail */}
      {riskData && (
        <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid " + C.border }}>
          <div style={{ fontSize: "0.58rem", color: C.textDim, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.5rem" }}>RISK SIGNAL</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
            <div style={{ flex: 1, height: 5, background: C.border2, borderRadius: 3 }}>
              <div style={{ height: "100%", width: riskData.prob + "%", background: riskColor, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: riskColor }}>{riskData.prob}%</span>
          </div>
          <div style={{ fontSize: "0.78rem", color: C.textMid, lineHeight: 1.5 }}>{riskData.reason}</div>
        </div>
      )}

      {/* P1-2: Simulate button */}
      {onSimulate && (
        <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid " + C.border }}>
          <button onClick={() => onSimulate(nodeId)} style={{ width: "100%", background: C.amberDim, border: "1px solid " + C.amber + "40", borderRadius: 8, color: C.amber, fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 700, padding: "0.65rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
            ⚡ Simulate delay on this task
          </button>
        </div>
      )}
      {/* Recommended fix */}
      <div style={{ padding: "0.85rem 1rem", background: C.greenDim, borderTop: "1px solid " + C.green + "20" }}>
        <div style={{ fontSize: "0.58rem", color: C.green, fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.4rem" }}>RECOMMENDED FIX</div>
        <div style={{ fontSize: "0.78rem", color: C.text, lineHeight: 1.6 }}>{fixText}</div>
      </div>
    </div>
  );
}

// ── RADAR CHART (Triangle Pillar) ─────────────────────────────────────────────
function RadarChart({ color, values, labels, title, score, scoreLabel }) {
  const size = 120;
  const cx = size/2, cy = size/2, r = 44;
  const n = 3;
  const points = values.map((v, i) => {
    const angle = (i * 2 * Math.PI / n) - Math.PI/2;
    const dist = r * (v/100);
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  });
  const outerPts = Array.from({length:n},(_,i) => {
    const angle = (i*2*Math.PI/n) - Math.PI/2;
    return { x: cx+r*Math.cos(angle), y: cy+r*Math.sin(angle) };
  });
  const poly = (pts) => pts.map(p=>`${p.x},${p.y}`).join(" ");
  const labelPositions = outerPts.map((p,i) => ({
    x: cx + (r+14)*Math.cos((i*2*Math.PI/n)-Math.PI/2),
    y: cy + (r+14)*Math.sin((i*2*Math.PI/n)-Math.PI/2),
  }));
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow:"visible"}}>
        <polygon points={poly(outerPts)} fill="none" stroke={color} strokeWidth="1" opacity="0.2"/>
        <polygon points={poly(points)} fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.5"/>
        {outerPts.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} opacity="0.4"/>)}
        {points.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color}/>)}
        {labelPositions.map((p,i) => (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="7" fontFamily="system-ui" fill={color} fontWeight="600" opacity="0.65">
            {labels[i]}
          </text>
        ))}
        <text x={cx} y={cy-6} textAnchor="middle" fontSize="16" fontFamily="Georgia,serif" fill={color}>{score}</text>
        <text x={cx} y={cy+8} textAnchor="middle" fontSize="7" fontFamily="system-ui" fill={color} fontWeight="600" opacity="0.6">{scoreLabel}</text>
      </svg>
    </div>
  );
}

// ── GANTT (simplified, supporting context only per v7.1) ──────────────────────
function GanttChart({ tasks, result, startDate }) {
  const canvasRef = useRef(null);
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result || !tasks.length) return;
    const dpr = window.devicePixelRatio||1;
    const W = canvas.parentElement.clientWidth||700;
    const LW = 130, DAY_PX = 11;
    const TOTAL = result.projectDuration + 6;
    const CHART_W = TOTAL * DAY_PX;
    const ROW_H = 36, BAR_H = 16, TICK_H = 28, PAD = 24;
    const H = TICK_H + result.tasks.length * ROW_H + PAD;
    const totalW = LW + CHART_W;
    canvas.style.width = totalW+"px"; canvas.style.height = H+"px";
    canvas.width = totalW*dpr; canvas.height = H*dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr,dpr); ctx.clearRect(0,0,totalW,H);
    const start = new Date(startDate);
    function addDays(n) { const d=new Date(start); d.setDate(d.getDate()+n); return d; }
    function fmt(n) { return addDays(n).toLocaleDateString("en-US",{month:"short",day:"numeric"}); }
    const xOf = d => LW + d * DAY_PX;
    for (let d=0;d<=TOTAL;d+=7) {
      const xp=xOf(d);
      ctx.strokeStyle="#21262D"; ctx.lineWidth=1; ctx.setLineDash([2,4]);
      ctx.beginPath(); ctx.moveTo(xp,TICK_H); ctx.lineTo(xp,H-PAD+4); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=C.textDim; ctx.font="400 9px system-ui"; ctx.textAlign="center";
      ctx.fillText(fmt(d), xp, TICK_H-10);
    }
    result.tasks.forEach((t,i) => {
      const isCrit=t.slack===0;
      const y=TICK_H+i*ROW_H; const barY=y+(ROW_H-BAR_H)/2;
      const barX=xOf(t.es); const barW=t.days*DAY_PX;
      if(i%2===0){ctx.fillStyle="rgba(255,255,255,0.012)";ctx.fillRect(LW,y,CHART_W,ROW_H);}
      ctx.textAlign="right";
      ctx.font=(isCrit?"600":"400")+" 10px system-ui";
      ctx.fillStyle=isCrit?C.red:C.textMid;
      ctx.fillText((isCrit?"◆ ":"")+t.name, LW-6, y+ROW_H/2+3.5);
      const barColor = isCrit ? C.red : t.concurrent ? C.green : C.blue;
      ctx.globalAlpha=isCrit?0.8:0.45;
      ctx.fillStyle=barColor;
      ctx.beginPath(); ctx.roundRect(barX,barY,Math.max(barW,4),BAR_H,3); ctx.fill();
      ctx.globalAlpha=1;
      if(barW>24){ctx.fillStyle="#fff";ctx.globalAlpha=0.8;ctx.font="600 8px system-ui";ctx.textAlign="center";ctx.fillText(t.days+"d",barX+barW/2,barY+BAR_H/2+3);ctx.globalAlpha=1;}
      ctx.fillStyle=C.textDim;ctx.font="400 8px system-ui";ctx.textAlign="left";
      ctx.fillText(fmt(t.es), barX+2, barY+BAR_H+9);
    });
    const finX=xOf(result.projectDuration);
    ctx.strokeStyle=C.red; ctx.lineWidth=2; ctx.setLineDash([4,3]); ctx.globalAlpha=0.7;
    ctx.beginPath(); ctx.moveTo(finX,TICK_H); ctx.lineTo(finX,H-PAD+4); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha=1;
    ctx.fillStyle=C.red; ctx.font="600 9px system-ui"; ctx.textAlign="center";
    ctx.fillText("FINISH", finX, H-PAD+16);
  }, [tasks, result, startDate]);
  useEffect(()=>{draw();},[draw]);
  useEffect(()=>{ const h=()=>draw(); window.addEventListener("resize",h); return ()=>window.removeEventListener("resize",h); },[draw]);
  return <div style={{overflowX:"auto"}}><canvas ref={canvasRef} style={{display:"block"}}/></div>;
}

// ── RESULTS CONTENT ───────────────────────────────────────────────────────────
function ResultsContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState(null);
  const [result, setResult] = useState(null);
  const [activeNav, setActiveNav] = useState("overview");
  const [aiReadout, setAiReadout] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null); // P1-1
  const [simulatorTaskId, setSimulatorTaskId] = useState(null); // P1-2

  useEffect(() => {
    const raw = searchParams.get("data");
    if (!raw) return;
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      setData(parsed);
      const r = computeCPM(parsed.tasks, parsed.startDate, parsed.targetDate, parsed.budget||"Flexible");
      setResult(r);
      setAiLoading(true);
      fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectData:parsed})})
        .then(res=>res.json()).then(d=>{setAiReadout(d.readout||null);setAiLoading(false);}).catch(()=>setAiLoading(false));
    } catch(e){ console.error(e); }
  }, []);

  if (!data||!result) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.textMid,fontFamily:"system-ui"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:40,height:40,border:"2px solid "+C.purple,borderTopColor:"transparent",borderRadius:"50%",margin:"0 auto 1rem",animation:"spin 0.8s linear infinite"}}/>
        <div style={{fontSize:"0.9rem"}}>Building your execution intelligence report...</div>
      </div>
    </div>
  );

  const totalCost = data.tasks.reduce((a,t)=>{const c=parseFloat((t.cost||"0").replace(/[^0-9.]/g,""))||0;return a+c;},0);
  const dailyBurn = totalCost > 0 && result.projectDuration > 0 ? totalCost/result.projectDuration : 0;
  const overrunCost = result.bufferDays < 0 && dailyBurn > 0 ? Math.abs(result.bufferDays)*dailyBurn : 0;
  const entityName = data.company || data.name || "Project";

  const confScore = result.confidence.score;
  const confBand = result.confidence.band;
  const confScoreOptimized = result.confidenceOptimized?.score || Math.min(confScore + 22, 97);
  const planRisk = result.predictiveRisk?.planProb || 0;

  const navItems = [
    { id:"overview", label:"Executive Overview", icon:"⬡" },
    { id:"graph", label:"Dependency Graph", icon:"◈" },
    { id:"intelligence", label:"Intelligence Pillars", icon:"△" },
    { id:"bottlenecks", label:"Bottlenecks", icon:"⚠" },
    { id:"gantt", label:"Timeline", icon:"▤" },
    { id:"diagnosis", label:"Diagnosis", icon:"◎" },
    { id:"financials", label:"Financials", icon:"$" },
    { id:"readout", label:"AI Readout", icon:"✦" },
    { id:"details", label:"Details", icon:"≡" },
  ].filter(n => n.id !== "financials" || totalCost > 0);

  const style = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes dotBlink{0%,80%,100%{opacity:0}40%{opacity:1}}
    @keyframes slideIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
    @keyframes navSlideIn{from{opacity:0;transform:translateX(-100%)}to{opacity:1;transform:translateX(0)}}
    ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#30363D;border-radius:2px}
    @media(max-width:768px){
      .topbar-right-label{display:none !important}
      .topbar-project-name{display:none !important}
      .hero-5col{grid-template-columns:1fr !important}
      .grid-2col{grid-template-columns:1fr !important}
      .grid-3col{grid-template-columns:1fr !important}
      .grid-6col{grid-template-columns:repeat(2,1fr) !important}
      .grid-briefing{grid-template-columns:1fr !important}
      .details-header{grid-template-columns:1fr 60px 50px !important}
      .details-row{grid-template-columns:1fr 60px 50px !important}
      .details-owner{display:none !important}
      .details-start{display:none !important}
      .main-pad{padding:0.75rem !important}
    }
  `;

  const card = (extra={}) => ({background:C.surface,border:"1px solid "+C.border,borderRadius:12,...extra});
  const label = (color=C.purple) => ({fontSize:"0.6rem",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color,marginBottom:"0.4rem"});
  const verdColor = result.verdict==="ON TRACK" ? C.green : result.verdict==="AT RISK" ? C.amber : C.red;

  // Graph section with interactive panel
  const GraphSection = ({ preview = false }) => (
    <div style={{ display: "flex", flexDirection: typeof window!=="undefined"&&window.innerWidth<768?"column":"row", overflow: "hidden", borderRadius: 12, border: "1px solid " + C.border }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <DependencyGraph
          tasks={data.tasks}
          result={result}
          simulatorTaskId={simulatorTaskId}
          onNodeClick={(id) => {
            setSelectedNodeId(id);
            if (id !== simulatorTaskId) setSimulatorTaskId(null);
            if (preview && id) setActiveNav("graph");
          }}
        />
      </div>
      {selectedNodeId && (
        <NodeDetailPanel
          nodeId={selectedNodeId}
          tasks={data.tasks}
          result={result}
          onClose={() => setSelectedNodeId(null)}
          onSimulate={(id) => {
            setSimulatorTaskId(id);
            setSelectedNodeId(null);
            if (preview) setActiveNav("graph");
          }}
        />
      )}
    </div>
  );

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"Inter,system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{style}</style>

      {/* ── TOP BAR ── */}
      <div style={{background:C.surface,borderBottom:"1px solid "+C.border,height:52,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 0.75rem",position:"sticky",top:0,zIndex:200,gap:"0.5rem",flexShrink:0,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.5rem",minWidth:0,flex:1}}>
          <button onClick={()=>setNavCollapsed(v=>!v)} style={{background:"transparent",border:"none",color:C.textMid,cursor:"pointer",fontSize:"1.1rem",padding:"0.25rem",flexShrink:0}}>☰</button>
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none" style={{flexShrink:0}}>
            <path d="M4 24 C8 24 10 14 15 14 C20 14 22 6 26 6 C29 6 30 12 31 14" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <circle cx="4" cy="24" r="3" fill={C.green}/>
            <circle cx="15" cy="14" r="2.5" fill={C.green} opacity="0.7"/>
            <circle cx="26" cy="6" r="2.5" fill={C.green} opacity="0.5"/>
            <circle cx="31" cy="14" r="2.5" fill={C.green} opacity="0.9"/>
          </svg>
          <span style={{fontWeight:700,color:C.text,fontSize:"0.9rem",flexShrink:0}}>Path<span style={{color:C.green}}>flo</span></span>
          <span className="topbar-project-name" style={{color:C.textMid,fontSize:"0.78rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>{data.name}</span>
          <span style={{background:verdColor+"20",color:verdColor,fontSize:"0.58rem",fontWeight:700,letterSpacing:"0.06em",padding:"0.18rem 0.5rem",borderRadius:100,border:"1px solid "+verdColor+"40",flexShrink:0,whiteSpace:"nowrap"}}>{result.verdict}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.3rem",fontSize:"0.75rem",color:C.textMid,flexShrink:0}}>
            <span style={{color:verdColor,fontWeight:700}}>{confScore}%</span>
            <span style={{color:C.textDim}}>→</span>
            <span style={{color:C.green,fontWeight:700}}>{confScoreOptimized}%</span>
            <span className="topbar-right-label" style={{color:C.textDim,fontSize:"0.7rem"}}>optimized</span>
          </div>
          <a href="/" style={{background:C.green,color:"#080A08",border:"none",borderRadius:8,fontFamily:"inherit",fontWeight:600,fontSize:"0.75rem",padding:"0.4rem 0.75rem",cursor:"pointer",textDecoration:"none",whiteSpace:"nowrap",flexShrink:0}}>+ New</a>
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ── LEFT NAV — overlay on mobile, push on desktop ── */}
        {!navCollapsed && (
          <nav style={{width:220,background:C.surface,borderRight:"1px solid "+C.border,padding:"1rem 0",display:"flex",flexDirection:"column",overflowY:"auto",flexShrink:0,position:typeof window!=="undefined"&&window.innerWidth<768?"fixed":"relative",top:typeof window!=="undefined"&&window.innerWidth<768?52:0,left:0,bottom:0,zIndex:typeof window!=="undefined"&&window.innerWidth<768?300:1,animation:"navSlideIn 0.2s ease both"}}>
            <div style={{padding:"0 0.75rem 0.75rem",fontSize:"0.6rem",color:C.textDim,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase"}}>{entityName}</div>
            {navItems.map(n => (
              <button key={n.id} onClick={()=>setActiveNav(n.id)} style={{display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.6rem 0.75rem",background:activeNav===n.id?C.greenDim:"transparent",border:"none",borderLeft:activeNav===n.id?`2px solid ${C.green}`:"2px solid transparent",color:activeNav===n.id?C.green:C.textMid,fontFamily:"inherit",fontSize:"0.82rem",fontWeight:activeNav===n.id?600:400,cursor:"pointer",textAlign:"left",width:"100%",transition:"all 0.15s"}}>
                <span style={{fontSize:"0.85rem",opacity:0.8}}>{n.icon}</span>
                {n.label}
              </button>
            ))}
            <div style={{flex:1}}/>
            <div style={{padding:"1rem 0.75rem",borderTop:"1px solid "+C.border}}>
              <div style={{fontSize:"0.62rem",color:C.textDim,marginBottom:"0.3rem"}}>EXECUTION RISK</div>
              <div style={{height:4,background:C.border2,borderRadius:2}}>
                <div style={{height:"100%",width:planRisk+"%",background:result.predictiveRisk?.planBand||C.red,borderRadius:2}}/>
              </div>
              <div style={{fontSize:"0.75rem",color:result.predictiveRisk?.planBand||C.red,fontWeight:700,marginTop:"0.3rem"}}>{planRisk}% failure probability</div>
            </div>
          </nav>
        )}

        {/* Mobile nav backdrop */}
        {!navCollapsed && typeof window!=="undefined" && window.innerWidth<768 && (
          <div onClick={()=>setNavCollapsed(true)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:299,top:52}}/>
        )}

        {/* ── MAIN CONTENT ── */}
        <main className="main-pad" style={{flex:1,overflowY:"auto",padding:"1.5rem",minWidth:0,overflowX:"hidden"}}>

          {/* ══ EXECUTIVE OVERVIEW ══ */}
          {activeNav==="overview" && (
            <div style={{animation:"fadeUp 0.3s ease both"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.25rem",flexWrap:"wrap",gap:"0.75rem"}}>
                <div>
                  <div style={{fontSize:"1.3rem",fontWeight:700,color:C.text}}>Executive Overview</div>
                  <div style={{fontSize:"0.78rem",color:C.textMid,marginTop:"0.15rem"}}>AI COO Report · Your project has been analyzed</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"0.4rem",fontSize:"0.72rem",color:C.green,background:C.greenDim,border:"1px solid "+C.green+"30",borderRadius:100,padding:"0.3rem 0.75rem"}}>
                  <span>✦</span> AI analysis complete
                </div>
              </div>

              {/* HERO METRICS BANNER */}
              <div style={{...card(),padding:"1.25rem",marginBottom:"1rem",border:"1px solid "+verdColor+"40",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${verdColor},transparent)`}}/>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"1rem",alignItems:"start"}}>
                  <div>
                    <div style={label(C.textDim)}>ON-TIME DELIVERY CONFIDENCE</div>
                    <div style={{display:"flex",alignItems:"baseline",gap:"0.5rem",marginBottom:"0.4rem"}}>
                      <div style={{fontFamily:"Georgia,serif",fontSize:"2.2rem",fontWeight:400,color:verdColor,lineHeight:1}}>{confScore}<span style={{fontSize:"1rem"}}>%</span></div>
                      <div style={{color:C.textDim,fontSize:"1.1rem",fontWeight:300}}>→</div>
                      <div style={{fontFamily:"Georgia,serif",fontSize:"2.2rem",fontWeight:400,color:C.green,lineHeight:1}}>{confScoreOptimized}<span style={{fontSize:"1rem"}}>%</span></div>
                    </div>
                    <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
                      <span style={{background:verdColor+"20",color:verdColor,fontSize:"0.6rem",fontWeight:700,padding:"0.12rem 0.5rem",borderRadius:100,border:"1px solid "+verdColor+"40"}}>
                        Current plan
                      </span>
                      <span style={{background:C.green+"20",color:C.green,fontSize:"0.6rem",fontWeight:700,padding:"0.12rem 0.5rem",borderRadius:100,border:"1px solid "+C.green+"40"}}>
                        +{confScoreOptimized - confScore}% if optimized
                      </span>
                    </div>
                    <div style={{fontSize:"0.7rem",color:C.textDim,marginTop:"0.4rem",lineHeight:1.5}}>
                      Likelihood of hitting your deadline as-is vs. with Pathflo's recommended changes applied
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>
                    {[
                      {label:"DELAY RISK",val:result.delayRisk,color:result.delayRisk==="High"?C.red:result.delayRisk==="Moderate"?C.amber:C.green},
                      {label:"BOTTLENECK SEVERITY",val:result.bottleneckSeverity,color:result.bottleneckSeverity==="High"?C.red:result.bottleneckSeverity==="Moderate"?C.amber:C.green},
                      {label:"BUDGET STABILITY",val:overrunCost>0?"At Risk":"Strong",color:overrunCost>0?C.red:C.green},
                    ].map((s,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                        <span style={{color:s.color}}>{s.val==="High"||s.val==="At Risk"?"⚠":"✓"}</span>
                        <div><div style={{fontSize:"0.62rem",color:C.textDim}}>{s.label}</div><div style={{fontSize:"0.85rem",fontWeight:600,color:s.color}}>{s.val}</div></div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={label(C.textDim)}>PROJECTED DELIVERY WINDOW</div>
                    <div style={{fontFamily:"Georgia,serif",fontSize:"1.4rem",color:C.text,lineHeight:1.2}}>{result.projectedRange}</div>
                    <div style={{fontSize:"0.72rem",color:C.textMid,marginTop:"0.3rem"}}>{result.bufferDays>=0?`${result.bufferDays} days buffer`:Math.abs(result.bufferDays)+" days over"}</div>
                  </div>
                  <div>
                    <div style={label(C.red)}>MOST LIKELY FAILURE POINT</div>
                    <div style={{fontSize:"0.85rem",color:C.text,fontWeight:500}}>{result.bottleneck?.name||result.criticalPath[0]||"—"}</div>
                    <div style={{fontSize:"0.72rem",color:C.textMid,marginTop:"0.2rem"}}>{result.bottleneck?.reason||"Critical path constraint"}</div>
                  </div>
                  <div style={{background:C.greenDim,border:"1px solid "+C.green+"30",borderRadius:8,padding:"0.75rem"}}>
                    <div style={label(C.green)}>RECOMMENDED ACTION</div>
                    <div style={{fontSize:"0.82rem",color:C.green,fontWeight:500,lineHeight:1.5}}>
                      {result.shuffleOps[0] ? `Run "${result.shuffleOps[0].task}" concurrently — saves ~${result.shuffleOps[0].daysSaved}d` : "Validate critical path owner availability before start"}
                    </div>
                    <div style={{color:C.green,marginTop:"0.4rem",fontSize:"0.8rem"}}>→</div>
                  </div>
                </div>
              </div>

              {/* AI BRIEFING + KEY INSIGHT */}
              <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:"1rem",marginBottom:"1rem"}}>
                <div style={{...card(),padding:"1.25rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem"}}>
                    <span style={{color:C.purple}}>✦</span>
                    <span style={{...label(C.purple),marginBottom:0}}>AI EXECUTIVE BRIEFING</span>
                  </div>
                  {aiLoading ? (
                    <div style={{display:"flex",alignItems:"center",gap:"0.5rem",color:C.textMid,fontSize:"0.82rem"}}>
                      <span>Writing briefing</span>
                      {[0,1,2].map(i=><span key={i} style={{width:4,height:4,background:C.purple,borderRadius:"50%",display:"inline-block",animation:`dotBlink 1.4s ${i*0.22}s infinite`}}/>)}
                    </div>
                  ) : aiReadout ? (
                    <p style={{fontSize:"0.88rem",color:C.textMid,lineHeight:1.8}}>{aiReadout}</p>
                  ) : (
                    <div>
                      <p style={{fontSize:"0.88rem",color:C.textMid,lineHeight:1.8,marginBottom:"0.75rem"}}>
                        {data.name} has a <strong style={{color:verdColor}}>{confScore}% chance of hitting its deadline</strong> as the plan currently stands. {result.confidence.reason}.
                      </p>
                      <p style={{fontSize:"0.88rem",color:C.textMid,lineHeight:1.8}}>
                        If Pathflo's recommended changes are applied, on-time confidence rises to <strong style={{color:C.green}}>{confScoreOptimized}%</strong> — a <strong style={{color:C.green}}>+{confScoreOptimized - confScore} point improvement</strong>. {result.shuffleOps.length > 0 ? `${result.shuffleOps.length} concurrency change${result.shuffleOps.length > 1?"s":""} could recover up to ${result.shuffleOps.reduce((a,o)=>a+o.daysSaved,0)} days at zero additional cost.` : "No major scheduling optimizations identified."}
                      </p>
                    </div>
                  )}
                </div>
                <div style={{...card(),padding:"1.25rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem"}}>
                    <span style={{color:C.purple}}>◈</span>
                    <span style={{...label(C.purple),marginBottom:0}}>KEY INSIGHT</span>
                  </div>
                  <p style={{fontSize:"0.84rem",color:C.textMid,lineHeight:1.75}}>
                    {result.predictiveRisk && result.predictiveRisk.top3[0] ?
                      `This project's success hinges on "${result.predictiveRisk.top3[0].name}" — ${result.predictiveRisk.top3[0].reason}. ${result.predictiveRisk.planProb}% probability of missing deadline without intervention.` :
                      `Critical path integrity depends on ${result.criticalPath.length} sequential milestones. Any single delay propagates forward with no buffer to absorb it.`
                    }
                  </p>
                </div>
              </div>

              {/* INTELLIGENCE PILLARS — plain language */}
              {(() => {
                const timelineScore = result.confidence.breakdown.find(f=>f.name==="Timeline tightness")?.score||50;
                const resourceScore = result.confidence.breakdown.find(f=>f.name==="Owner concentration")?.score||50;
                const opScore = result.confidence.breakdown.find(f=>f.name==="Optimization gaps")?.score||50;
                const pillars = [
                  {
                    n:"1", title:"Will this finish on time?", color:C.blue,
                    score: timelineScore,
                    what: timelineScore>=75?"Your schedule has breathing room. Even if a task slips a few days, the plan can absorb it.":timelineScore>=45?"Your schedule is tight. The critical path has little room for error — one delay can cascade.":"Your schedule is at serious risk. The critical path is overloaded and has no buffer to absorb slips.",
                    signal: result.bufferDays>=7?`${result.bufferDays} days of buffer — schedule is solid`:result.bufferDays>=3?`${result.bufferDays} days of buffer — tight but workable`:result.bufferDays>=0?`Only ${result.bufferDays} days of buffer — very tight`:`${Math.abs(result.bufferDays)} days over deadline`,
                    signalColor: result.bufferDays>=7?C.green:result.bufferDays>=3?C.amber:C.red,
                  },
                  {
                    n:"2", title:"Can your team handle this?", color:C.purple,
                    score: resourceScore,
                    what: resourceScore>=75?"Work is spread across your team. No single person is a bottleneck.":resourceScore>=45?"Some team members are carrying too much. If they fall behind, it stalls everyone else.":"One or two people are responsible for most of the critical work. That's a serious single point of failure.",
                    signal: result.criticalPath.length <= 3 ? "Critical path owned by multiple people" : result.teamSize<=2?"Most critical tasks on 1–2 people":"Check owner concentration below",
                    signalColor: resourceScore>=65?C.green:resourceScore>=40?C.amber:C.red,
                  },
                  {
                    n:"3", title:"Is the plan built to succeed?", color:C.green,
                    score: Math.round((opScore + (result.shuffleOps.length>0?70:30)) / 2),
                    what: result.shuffleOps.length>0?`There are ${result.shuffleOps.length} task${result.shuffleOps.length>1?"s":""} that could run at the same time but currently run back-to-back. Fixing this could save ${result.shuffleOps.reduce((a,o)=>a+o.daysSaved,0)} days at zero extra cost.`:"Your plan is well-sequenced. Tasks are ordered logically and no obvious scheduling improvements were found.",
                    signal: result.shuffleOps.length>0?`${result.shuffleOps.reduce((a,o)=>a+o.daysSaved,0)} days recoverable at no cost`:"Plan sequencing looks good",
                    signalColor: result.shuffleOps.length>0?C.amber:C.green,
                  },
                ];
                return (
                  <div style={{...card(),padding:"1.25rem",marginBottom:"1rem"}}>
                    <div style={{fontSize:"0.6rem",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:C.green,marginBottom:"0.85rem"}}>EXECUTION INTELLIGENCE — 3 KEY QUESTIONS</div>
                    <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
                      {pillars.map((p,i) => {
                        const pct = Math.min(Math.max(p.score, 2), 98);
                        const barColor = pct>=70?C.green:pct>=45?C.amber:C.red;
                        const rating = pct>=70?"Good":pct>=45?"At Risk":"Critical";
                        return (
                          <div key={i} style={{background:C.surface2,border:"1px solid "+C.border,borderRadius:10,padding:"1rem",borderLeft:"3px solid "+p.color}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"0.5rem"}}>
                              <div style={{fontSize:"0.88rem",fontWeight:700,color:C.text,flex:1,paddingRight:"1rem"}}>{p.n}. {p.title}</div>
                              <span style={{fontSize:"0.68rem",fontWeight:700,padding:"0.2rem 0.6rem",borderRadius:100,background:barColor+"20",color:barColor,border:"1px solid "+barColor+"40",flexShrink:0,whiteSpace:"nowrap"}}>{rating}</span>
                            </div>
                            <div style={{height:5,background:C.border2,borderRadius:3,marginBottom:"0.6rem"}}>
                              <div style={{height:"100%",width:pct+"%",background:barColor,borderRadius:3,transition:"width 0.8s ease"}}/>
                            </div>
                            <p style={{fontSize:"0.8rem",color:C.textMid,lineHeight:1.65,marginBottom:"0.5rem"}}>{p.what}</p>
                            <div style={{fontSize:"0.72rem",fontWeight:600,color:p.signalColor}}>→ {p.signal}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* BOTTLENECKS + OPPORTUNITIES */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"1rem",marginBottom:"1rem"}}>
                <div style={{...card(),padding:"1.25rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"1rem"}}>
                    <span style={{color:C.red}}>⚠</span>
                    <div style={label(C.red)}>TOP BOTTLENECKS</div>
                  </div>
                  {result.predictiveRisk?.top3.map((m,i) => (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.65rem 0",borderBottom:i<2?"1px solid "+C.border:"none"}}>
                      <div style={{width:32,height:32,borderRadius:"50%",background:m.prob>=75?C.red+"20":C.amber+"20",border:"1px solid "+(m.prob>=75?C.red:C.amber),display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.65rem",fontWeight:700,color:m.prob>=75?C.red:C.amber,flexShrink:0}}>{m.owner?m.owner.charAt(0).toUpperCase():"?"}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:"0.82rem",fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name}</div>
                        <div style={{fontSize:"0.72rem",color:C.textDim}}>{m.reason}</div>
                      </div>
                      <div style={{fontSize:"0.72rem",fontWeight:700,color:m.prob>=75?C.red:C.amber,flexShrink:0}}>IMPACT<br/><span style={{fontSize:"0.85rem"}}>{m.prob>=75?"High":"Moderate"}</span></div>
                    </div>
                  ))}
                </div>
                <div style={{...card(),padding:"1.25rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"1rem"}}>
                    <span style={{color:C.green}}>◈</span>
                    <div style={label(C.green)}>TOP OPTIMIZATION OPPORTUNITIES</div>
                  </div>
                  {result.shuffleOps.length > 0 ? result.shuffleOps.map((op,i) => (
                    <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"0.75rem",padding:"0.65rem 0",borderBottom:i<result.shuffleOps.length-1?"1px solid "+C.border:"none"}}>
                      <div style={{width:24,height:24,borderRadius:"50%",background:C.surface3,border:"1px solid "+C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.72rem",fontWeight:700,color:C.textMid,flexShrink:0}}>{i+1}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:"0.82rem",fontWeight:600,color:C.text}}>{op.reason.split('"')[1]||op.task} — run concurrently</div>
                        <div style={{fontSize:"0.72rem",color:C.textDim}}>{op.reason}</div>
                      </div>
                      <div style={{fontSize:"0.72rem",fontWeight:700,color:C.green,flexShrink:0,textAlign:"right"}}>IMPACT<br/><span style={{color:C.green}}>-{Math.round(op.daysSaved/result.projectDuration*100)}% Delay Risk</span></div>
                    </div>
                  )) : (
                    <div style={{fontSize:"0.85rem",color:C.textMid,fontStyle:"italic"}}>No major concurrency opportunities identified. Plan is well-structured.</div>
                  )}
                </div>
              </div>

              {/* DEPENDENCY GRAPH PREVIEW + GANTT PREVIEW */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"1rem",marginBottom:"1rem"}}>
                <div style={{...card(),padding:"1.25rem"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
                    <div style={label(C.purple)}>DEPENDENCY INTELLIGENCE GRAPH</div>
                    <button onClick={()=>setActiveNav("graph")} style={{background:"transparent",border:"none",color:C.purple,fontSize:"0.75rem",cursor:"pointer",fontFamily:"inherit"}}>View full graph →</button>
                  </div>
                  <GraphSection preview={true} />
                </div>
                <div style={{...card(),padding:"1.25rem"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
                    <div style={label(C.purple)}>PROJECT TIMELINE</div>
                    <button onClick={()=>setActiveNav("gantt")} style={{background:"transparent",border:"none",color:C.purple,fontSize:"0.75rem",cursor:"pointer",fontFamily:"inherit"}}>View full Gantt →</button>
                  </div>
                  <GanttChart tasks={data.tasks} result={result} startDate={data.startDate}/>
                </div>
              </div>

              {/* AT A GLANCE FOOTER */}
              <div style={{...card(),padding:"1rem"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:"0.75rem",textAlign:"center"}}>
                  {[
                    {label:"TASKS",val:result.totalTasks,sub:"On Track",subColor:verdColor},
                    {label:"CRITICAL PATH TASKS",val:result.criticalPath.length,sub:"At Risk",subColor:C.red},
                    {label:"TEAM MEMBERS",val:result.teamSize,sub:"Active",subColor:C.green},
                    {label:"DEPENDENCIES",val:data.tasks.filter(t=>t.predecessors.length>0).length,sub:`${result.predictiveRisk?.top3.filter(m=>m.prob>60).length||0} Hidden Risks`,subColor:C.amber},
                    {label:"BUFFER",val:result.bufferDays>=0?result.bufferDays+"d":"Over",sub:result.bufferDays>=0?"Available":"by "+Math.abs(result.bufferDays)+"d",subColor:result.bufferDays>=0?C.green:C.red},
                    {label:"BUDGET",val:totalCost>0?"$"+Math.round(totalCost/1000)+"k":"N/A",sub:overrunCost>0?"At Risk":"On Track",subColor:overrunCost>0?C.red:C.green},
                  ].map((s,i) => (
                    <div key={i}>
                      <div style={{fontSize:"0.55rem",color:C.textDim,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.3rem"}}>{s.label}</div>
                      <div style={{fontSize:"1.1rem",fontWeight:700,color:C.text}}>{s.val}</div>
                      <div style={{fontSize:"0.65rem",color:s.subColor,fontWeight:600}}>{s.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ DEPENDENCY GRAPH (HERO — full interactive) ══ */}
          {activeNav==="graph" && (
            <div style={{animation:"fadeUp 0.3s ease both"}}>
              <div style={{marginBottom:"1.25rem"}}>
                <div style={{fontSize:"1.2rem",fontWeight:700}}>Dependency Intelligence Graph</div>
                <div style={{fontSize:"0.8rem",color:C.textMid,marginTop:"0.2rem"}}>Click any node to see task detail and cascade chain. Hit <strong style={{color:C.amber}}>⚡ Simulate delay</strong> to run the cascade simulator on any task.</div>
              </div>
              <div style={{display:"flex",gap:"1.5rem",marginBottom:"1rem",flexWrap:"wrap"}}>
                {[{label:"Tasks",val:result.totalTasks},{label:"Dependencies",val:data.tasks.filter(t=>t.predecessors.length>0).length},{label:"Critical Path",val:`${result.criticalPath.length} tasks`},{label:"Cascade Risk",val:`${result.predictiveRisk?.planProb||0}%`}].map((s,i)=>(
                  <div key={i} style={{...card({background:C.surface2}),padding:"0.65rem 1rem"}}>
                    <div style={{fontSize:"0.6rem",color:C.textDim,fontWeight:700,letterSpacing:"0.1em"}}>{s.label}</div>
                    <div style={{fontSize:"1rem",fontWeight:700,color:C.text,marginTop:"0.1rem"}}>{s.val}</div>
                  </div>
                ))}
                <div style={{marginLeft:"auto",display:"flex",gap:"0.75rem",flexWrap:"wrap",alignItems:"center"}}>
                  {[{color:C.red,label:"Critical"},{color:C.blue,label:"Upstream"},{color:"#F87171",label:"Downstream"},{color:C.purple,label:"Selected"},{color:C.green,label:"On Track"}].map((l,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:"0.35rem",fontSize:"0.72rem",color:C.textMid}}>
                      <div style={{width:10,height:10,borderRadius:2,background:l.color+"30",border:"1px solid "+l.color}}/>
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Full interactive graph + detail panel side by side */}
              <div style={{...card(),overflow:"visible",marginBottom:"1rem"}}>
                <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",borderRadius:12}}>
                  <GraphSection preview={false} />
                </div>
              </div>

              {/* P1-2: Cascade Impact Simulator */}
              <CascadeSimulator
                tasks={data.tasks}
                result={result}
                simulatorTaskId={simulatorTaskId}
                onTaskChange={setSimulatorTaskId}
                startDate={data.startDate}
                targetDate={data.targetDate}
                budget={data.budget||"Flexible"}
              />

              {/* Critical path chain */}
              <div style={{...card(),padding:"1.25rem",marginTop:"1rem"}}>
                <div style={label(C.red)}>CRITICAL PATH — tasks that control your deadline</div>
                <div style={{fontSize:"0.78rem",color:C.textDim,marginBottom:"0.75rem"}}>Any slip in these propagates forward with zero buffer</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem",alignItems:"center"}}>
                  {result.criticalPath.map((name,i) => (
                    <span key={i} style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
                      <span style={{background:C.red+"15",border:"1px solid "+C.red+"40",borderRadius:6,color:C.red,fontSize:"0.75rem",padding:"0.25rem 0.65rem",fontWeight:600}}>{name}</span>
                      {i<result.criticalPath.length-1&&<span style={{color:C.red,opacity:0.35}}>→</span>}
                    </span>
                  ))}
                </div>
              </div>

              {/* Predicted risk cards */}
              {result.predictiveRisk && (
                <div style={{...card({border:"1px solid "+result.predictiveRisk.planBand+"40"}),padding:"1.25rem",marginTop:"1rem",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${result.predictiveRisk.planBand},transparent)`}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1rem"}}>
                    <div>
                      <div style={label(C.textDim)}>PREDICTED RISK PROFILE</div>
                      <div style={{display:"flex",alignItems:"baseline",gap:"0.5rem"}}>
                        <span style={{fontFamily:"Georgia,serif",fontSize:"2.5rem",color:result.predictiveRisk.planBand,lineHeight:1}}>{result.predictiveRisk.planProb}%</span>
                        <span style={{fontSize:"0.85rem",color:C.textMid}}>probability of missing deadline</span>
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:"0.65rem"}}>
                    {result.predictiveRisk.top3.map((m,i) => {
                      const mColor = m.prob>=75?C.red:m.prob>=55?C.amber:C.green;
                      return (
                        <div key={i} style={{...card({background:C.surface2,border:"1px solid "+mColor+"20"}),padding:"0.85rem 1rem"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"0.3rem"}}>
                            <div style={{fontSize:"0.88rem",fontWeight:600,color:C.text}}>{m.name}</div>
                            <div style={{display:"flex",alignItems:"center",gap:"0.4rem",flexShrink:0,marginLeft:"1rem"}}>
                              <div style={{height:5,width:60,background:C.border2,borderRadius:3}}><div style={{height:"100%",width:m.prob+"%",background:mColor,borderRadius:3}}/></div>
                              <span style={{fontSize:"0.75rem",fontFamily:"monospace",fontWeight:700,color:mColor}}>{m.prob}%</span>
                            </div>
                          </div>
                          <div style={{fontSize:"0.72rem",color:C.textDim,marginBottom:"0.3rem"}}>{m.owner} · {m.days}d · {m.slack===0?"zero float":m.slack+"d float"}{m.dependents>0?` · ${m.dependents} downstream`:""}</div>
                          <div style={{fontSize:"0.8rem",color:C.textMid}}>{m.reason}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ INTELLIGENCE PILLARS ══ */}
          {activeNav==="intelligence" && (
            <div style={{animation:"fadeUp 0.3s ease both"}}>
              <div style={{marginBottom:"1.25rem"}}>
                <div style={{fontSize:"1.2rem",fontWeight:700}}>Intelligence Pillars</div>
                <div style={{fontSize:"0.8rem",color:C.textMid,marginTop:"0.2rem"}}>Three scores that explain exactly why your confidence is {confScore}%. Each one is a different kind of risk.</div>
              </div>

              {/* Overall score */}
              <div style={{...card({border:"1px solid "+verdColor+"40"}),padding:"1.25rem",marginBottom:"1rem",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:verdColor}}/>
                <div style={{display:"flex",alignItems:"center",gap:"1.25rem",flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:"0.6rem",color:C.textDim,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.3rem"}}>ON-TIME DELIVERY CONFIDENCE</div>
                    <div style={{fontFamily:"Georgia,serif",fontSize:"3.5rem",color:verdColor,lineHeight:1}}>{confScore}<span style={{fontSize:"1.5rem"}}>%</span></div>
                  </div>
                  <div style={{flex:1,minWidth:180}}>
                    <div style={{height:8,background:C.border2,borderRadius:4,marginBottom:"0.5rem"}}>
                      <div style={{height:"100%",width:confScore+"%",background:verdColor,borderRadius:4,transition:"width 1s ease"}}/>
                    </div>
                    <div style={{fontSize:"0.82rem",color:C.textMid,lineHeight:1.6}}>{result.confidence.reason}.</div>
                    <div style={{fontSize:"0.78rem",color:C.green,marginTop:"0.4rem",fontWeight:600}}>With Pathflo's fixes: {confScoreOptimized}% (+{confScoreOptimized-confScore} pts)</div>
                  </div>
                </div>
              </div>

              {/* Three pillars */}
              {(() => {
                // Timeline: based directly on buffer days — more buffer = higher score
                const buf = result.bufferDays;
                const tScore = buf >= 14 ? 88 : buf >= 7 ? 75 : buf >= 3 ? 60 : buf >= 0 ? 40 : buf >= -3 ? 20 : 8;
                // Resource: solo operators aren't penalized — single person teams are common
                const ownerConc = result.confidence.breakdown.find(f=>f.name==="Owner concentration")?.score||50;
                const scopeCap = result.confidence.breakdown.find(f=>f.name==="Scope vs capacity")?.score||50;
                const rScore = result.teamSize <= 1
                  ? Math.round((ownerConc * 0.3) + (scopeCap * 0.7)) // solo: weight scope more
                  : Math.round((ownerConc + scopeCap) / 2);
                // Operational: sequencing + optimization
                const oScore = Math.round(((result.confidence.breakdown.find(f=>f.name==="Optimization gaps")?.score||50) + (result.confidence.breakdown.find(f=>f.name==="Plan sequencing")?.score||50)) / 2);

                const pillars = [
                  {
                    id:"time", n:"01", title:"Timeline Health", subtitle:"Will it finish on time?",
                    color:C.blue, score:tScore,
                    triVals:[tScore/100, Math.min((result.confidence.breakdown.find(f=>f.name==="Plan sequencing")?.score||50)/100,1), Math.min(result.bufferDays>=0?0.8:0.2,1)],
                    triLabels:["BUFFER","SEQUENCE","RISK"],
                    plain: result.bufferDays>=14
                      ? `${result.bufferDays} days of buffer on the critical path — you have real breathing room. Even if a task slips by a week, the deadline holds.`
                      : result.bufferDays>=7
                        ? `${result.bufferDays} days of buffer. Healthy, but not unlimited — protect the critical path from unexpected slips.`
                        : result.bufferDays>=3
                          ? `${result.bufferDays} days of buffer. Tight. One task slipping more than a few days and the deadline moves.`
                          : result.bufferDays>=0
                            ? `Only ${result.bufferDays} day${result.bufferDays!==1?"s":""} of buffer. Essentially no room for error on the critical path.`
                            : `The critical path already runs ${Math.abs(result.bufferDays)} day${Math.abs(result.bufferDays)!==1?"s":""} past your target deadline. The plan needs to be compressed.`,
                    fix: result.shuffleOps[0]
                      ? `Run "${result.shuffleOps[0].task}" parallel with "${result.shuffleOps[0].sharedPredecessor||result.shuffleOps[0].predecessor}" — recovers ~${result.shuffleOps[0].daysSaved}d`
                      : result.bufferDays<0 ? "Identify tasks that can overlap to compress the schedule" : "Protect the critical path from scope creep",
                    fixColor: result.bufferDays>=5?C.green:C.amber,
                    stats:[
                      {name:"Buffer days", val:result.bufferDays>=0?result.bufferDays+"d buffer":Math.abs(result.bufferDays)+"d over", color:result.bufferDays>=5?C.green:result.bufferDays>=0?C.amber:C.red},
                      {name:"Critical path tasks", val:result.criticalPath.length, color:result.criticalPath.length<=3?C.green:result.criticalPath.length<=6?C.amber:C.red},
                      {name:"Schedule type", val:result.tasks.filter(t=>t.concurrent).length>0?"Has parallel work":"Fully sequential", color:result.tasks.filter(t=>t.concurrent).length>0?C.green:C.amber},
                    ],
                  },
                  {
                    id:"resource", n:"02", title:"Resource Health", subtitle:"Can your team handle this?",
                    color:C.purple, score:rScore,
                    triVals:[rScore/100, Math.min((result.confidence.breakdown.find(f=>f.name==="Scope vs capacity")?.score||50)/100,1), Math.min(result.teamSize/Math.max(result.criticalPath.length,1),1)],
                    triLabels:["OWNERS","CAPACITY","RISK"],
                    plain: result.teamSize<=1
                      ? `This is a solo project — you own all ${result.totalTasks} tasks. That's normal for contractors. The risk is if you get blocked: there's no one to pick up the slack. Make sure your critical path tasks are clearly time-boxed.`
                      : rScore>=70
                        ? `Work is spread across ${result.teamSize} people. No single person is carrying an outsized share of critical tasks.`
                        : rScore>=45
                          ? `Some team members have multiple critical tasks. If they fall behind, everything waiting on them is delayed.`
                          : `High concentration risk. One or two people own most of the critical work — if they get stuck, the project stalls.`,
                    fix: result.teamSize<=1
                      ? `${result.criticalPath.length} tasks on the critical path — time-box each one and build in a personal buffer for your highest-risk task`
                      : rScore<70
                        ? `${result.criticalPath.length} tasks on the critical path — confirm each owner has the capacity to deliver on schedule`
                        : "Team capacity looks well distributed",
                    fixColor: result.teamSize<=1?C.amber:rScore>=70?C.green:rScore>=45?C.amber:C.red,
                    stats:[
                      {name:"Team size", val:result.teamSize+(result.teamSize===1?" person":" people"), color:C.amber},
                      {name:"Critical tasks", val:result.criticalPath.length+" tasks", color:result.criticalPath.length<=3?C.green:result.criticalPath.length<=6?C.amber:C.red},
                      {name:"Tasks per person", val:Math.round(result.totalTasks/Math.max(result.teamSize,1))+" avg", color:result.totalTasks/Math.max(result.teamSize,1)<=4?C.green:C.amber},
                    ],
                  },
                  {
                    id:"ops", n:"03", title:"Operational Health", subtitle:"Is the plan built to succeed?",
                    color:C.green, score:oScore,
                    triVals:[oScore/100, Math.min((result.confidence.breakdown.find(f=>f.name==="Plan sequencing")?.score||50)/100,1), overrunCost>0?0.2:0.85],
                    triLabels:["STRUCTURE","EFFICIENCY","BUDGET"],
                    plain: result.shuffleOps.length>0
                      ? `${result.shuffleOps.length} task${result.shuffleOps.length!==1?"s are":" is"} running back-to-back that could run at the same time. That's ${result.shuffleOps.reduce((a,o)=>a+o.daysSaved,0)} days left on the table.`
                      : overrunCost>0
                        ? `Schedule is tight and costs are at risk. At $${Math.round(dailyBurn)}/day, the ${Math.abs(result.bufferDays)}-day overrun adds $${Math.round(overrunCost).toLocaleString()} in exposure.`
                        : "Plan is well-structured. Tasks are sequenced efficiently and no major scheduling gaps were found.",
                    fix: result.shuffleOps.length>0
                      ? result.shuffleOps[0].reason
                      : overrunCost>0
                        ? "Compress the schedule to reduce cost exposure"
                        : "No major structural improvements needed",
                    fixColor: result.shuffleOps.length>0||overrunCost>0?C.amber:C.green,
                    stats:[
                      {name:"Parallel opportunities", val:result.shuffleOps.length>0?result.shuffleOps.length+" found":"None needed", color:result.shuffleOps.length>0?C.amber:C.green},
                      {name:"Days recoverable", val:result.shuffleOps.length>0?result.shuffleOps.reduce((a,o)=>a+o.daysSaved,0)+"d at zero cost":"—", color:result.shuffleOps.length>0?C.amber:C.textDim},
                      {name:"Budget status", val:overrunCost>0?"At risk":"On track", color:overrunCost>0?C.red:C.green},
                    ],
                  },
                ];

                const size=120, cx=size/2, cy=size/2, r=42, n=3;
                function makeTriangle(vals, color, labels, scoreText) {
                  const outerPts = Array.from({length:n},(_,i)=>{ const a=(i*2*Math.PI/n)-Math.PI/2; return {x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)}; });
                  const innerPts = vals.map((v,i)=>{ const a=(i*2*Math.PI/n)-Math.PI/2; const d=r*Math.max(v,0.08); return {x:cx+d*Math.cos(a),y:cy+d*Math.sin(a)}; });
                  const labelPts = outerPts.map((p,i)=>({ x:cx+(r+16)*Math.cos((i*2*Math.PI/n)-Math.PI/2), y:cy+(r+16)*Math.sin((i*2*Math.PI/n)-Math.PI/2) }));
                  const poly = pts => pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
                  return (
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow:"visible",display:"block",margin:"0 auto"}}>
                      <polygon points={poly(outerPts)} fill="none" stroke={color} strokeWidth="1" opacity="0.2"/>
                      <polygon points={poly(innerPts)} fill={color} fillOpacity="0.18" stroke={color} strokeWidth="2"/>
                      {outerPts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color} opacity="0.35"/>)}
                      {innerPts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3" fill={color}/>)}
                      {labelPts.map((p,i)=>(
                        <text key={i} x={p.x.toFixed(1)} y={p.y.toFixed(1)} textAnchor="middle" dominantBaseline="middle"
                          fontSize="7.5" fontFamily="system-ui" fill={color} fontWeight="700" opacity="0.7">{labels[i]}</text>
                      ))}
                      <text x={cx} y={cy-5} textAnchor="middle" fontSize="22" fontFamily="Georgia,serif" fill={color} fontWeight="400">{scoreText}</text>
                      <text x={cx} y={cy+10} textAnchor="middle" fontSize="8" fontFamily="system-ui" fill={color} fontWeight="600" opacity="0.6">/ 100</text>
                    </svg>
                  );
                }

                return (
                  <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
                    {pillars.map((p,i)=>{
                      const barColor = p.score>=70?C.green:p.score>=45?C.amber:C.red;
                      const rating = p.score>=70?"Good":p.score>=45?"At Risk":"Critical";
                      return (
                        <div key={i} style={{...card(),padding:"1.25rem",borderTop:"2px solid "+p.color}}>
                          {/* Header row */}
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1rem",gap:"0.75rem"}}>
                            <div>
                              <div style={{fontSize:"0.6rem",color:p.color,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.25rem"}}>{p.n} · {p.title.toUpperCase()}</div>
                              <div style={{fontSize:"0.95rem",fontWeight:700,color:C.text}}>{p.subtitle}</div>
                            </div>
                            <span style={{fontSize:"0.68rem",fontWeight:700,padding:"0.22rem 0.7rem",borderRadius:100,background:barColor+"20",color:barColor,border:"1px solid "+barColor+"40",flexShrink:0,whiteSpace:"nowrap"}}>{rating}</span>
                          </div>

                          {/* Triangle + score side by side */}
                          <div style={{display:"flex",alignItems:"center",gap:"1.5rem",marginBottom:"1rem",flexWrap:"wrap"}}>
                            <div style={{flexShrink:0}}>
                              {makeTriangle(p.triVals, p.color, p.triLabels, p.score)}
                            </div>
                            <div style={{flex:1,minWidth:160}}>
                              <div style={{fontFamily:"Georgia,serif",fontSize:"2.8rem",color:barColor,lineHeight:1,marginBottom:"0.3rem"}}>{p.score}<span style={{fontSize:"1.2rem",color:C.textDim}}>/100</span></div>
                              <div style={{height:6,background:C.border2,borderRadius:3,marginBottom:"0.6rem"}}>
                                <div style={{height:"100%",width:p.score+"%",background:barColor,borderRadius:3,transition:"width 0.8s ease"}}/>
                              </div>
                              <p style={{fontSize:"0.82rem",color:C.textMid,lineHeight:1.65}}>{p.plain}</p>
                            </div>
                          </div>

                          {/* Stats row */}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"0.5rem",marginBottom:"0.85rem"}}>
                            {p.stats.map((s,j)=>(
                              <div key={j} style={{background:C.surface2,borderRadius:8,padding:"0.5rem 0.65rem"}}>
                                <div style={{fontSize:"0.58rem",color:C.textDim,marginBottom:"0.2rem"}}>{s.name}</div>
                                <div style={{fontSize:"0.8rem",fontWeight:700,color:s.color}}>{s.val}</div>
                              </div>
                            ))}
                          </div>

                          {/* Fix */}
                          <div style={{borderTop:"1px solid "+C.border,paddingTop:"0.75rem"}}>
                            <div style={{fontSize:"0.6rem",color:p.fixColor,fontWeight:700,letterSpacing:"0.08em",marginBottom:"0.25rem"}}>PATHFLO {p.score>=70?"INSIGHT":"FIX"}</div>
                            <div style={{fontSize:"0.8rem",color:C.text,lineHeight:1.6}}>→ {p.fix}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}


          {/* ══ BOTTLENECKS ══ */}
          {activeNav==="bottlenecks" && (
            <div style={{animation:"fadeUp 0.3s ease both"}}>
              <div style={{marginBottom:"1.25rem"}}>
                <div style={{fontSize:"1.2rem",fontWeight:700}}>Bottleneck Analysis</div>
                <div style={{fontSize:"0.8rem",color:C.textMid,marginTop:"0.2rem"}}>Where your plan is most likely to break, ranked by cascade impact.</div>
              </div>
              {result.predictiveRisk && (
                <div style={{...card({border:"1px solid "+result.predictiveRisk.planBand+"40"}),padding:"1.25rem",marginBottom:"1rem"}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:"0.75rem",marginBottom:"0.75rem"}}>
                    <span style={{fontFamily:"Georgia,serif",fontSize:"2.5rem",color:result.predictiveRisk.planBand}}>{result.predictiveRisk.planProb}%</span>
                    <span style={{fontSize:"0.88rem",color:C.textMid}}>overall probability of missing deadline</span>
                  </div>
                  <div style={{fontSize:"0.62rem",color:C.textDim,marginBottom:"0.35rem"}}>HIGHEST RISK MILESTONES</div>
                  <div style={{display:"flex",flexDirection:"column",gap:"0.65rem"}}>
                    {result.predictiveRisk.top3.map((m,i)=>{
                      const mColor=m.prob>=75?C.red:m.prob>=55?C.amber:C.green;
                      return(
                        <div key={i} style={{...card({background:C.surface2,border:"1px solid "+mColor+"20"}),padding:"1rem"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"0.4rem"}}>
                            <div style={{fontSize:"0.9rem",fontWeight:700,color:C.text}}>{m.name}</div>
                            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                              <div style={{height:5,width:80,background:C.border2,borderRadius:3}}><div style={{height:"100%",width:m.prob+"%",background:mColor,borderRadius:3}}/></div>
                              <span style={{fontSize:"0.85rem",fontWeight:700,color:mColor}}>{m.prob}%</span>
                            </div>
                          </div>
                          <div style={{fontSize:"0.72rem",color:C.textDim,marginBottom:"0.4rem"}}>{m.owner} · {m.days} days · {m.slack===0?"zero float — critical path":m.slack+"d float"} · {m.dependents} downstream tasks</div>
                          <div style={{fontSize:"0.85rem",color:C.textMid,lineHeight:1.6}}>{m.reason}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {result.shuffleOps.length > 0 && (
                <div style={{...card(),padding:"1.25rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"1rem"}}>
                    <span style={{color:C.green}}>◈</span>
                    <div style={label(C.green)}>OPTIMIZATION OPPORTUNITIES</div>
                  </div>
                  {result.shuffleOps.map((op,i)=>(
                    <div key={i} style={{padding:"0.85rem 0",borderBottom:i<result.shuffleOps.length-1?"1px solid "+C.border:"none"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:"0.35rem"}}>
                        <div style={{fontSize:"0.88rem",fontWeight:600,color:C.text}}>{op.task}</div>
                        <div style={{fontSize:"0.72rem",color:C.green,fontFamily:"monospace"}}>~{op.daysSaved}d recovered</div>
                      </div>
                      <div style={{fontSize:"0.84rem",color:C.textMid,lineHeight:1.65}}>{op.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ TIMELINE ══ */}
          {activeNav==="gantt" && (
            <div style={{animation:"fadeUp 0.3s ease both"}}>
              <div style={{marginBottom:"1.25rem"}}>
                <div style={{fontSize:"1.2rem",fontWeight:700}}>Timeline</div>
                <div style={{fontSize:"0.8rem",color:C.textMid,marginTop:"0.2rem"}}>Supporting context — task sequencing and duration. See Dependency Graph for cascade intelligence.</div>
              </div>
              <div style={{...card(),padding:"1.5rem",marginBottom:"1rem"}}>
                <div style={{display:"flex",gap:"1.5rem",marginBottom:"1rem",flexWrap:"wrap"}}>
                  {[{color:C.red,label:"Critical Path"},{color:C.green,label:"Concurrent"},{color:C.blue,label:"Sequential"}].map((l,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:"0.4rem",fontSize:"0.72rem",color:C.textMid}}>
                      <div style={{width:16,height:5,background:l.color,borderRadius:2,opacity:0.8}}/>
                      {l.label}
                    </div>
                  ))}
                </div>
                <GanttChart tasks={data.tasks} result={result} startDate={data.startDate}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"1rem"}}>
                <div style={{...card({border:"1px solid "+verdColor+"30"}),padding:"1rem"}}>
                  <div style={{fontSize:"0.6rem",color:C.textDim,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.3rem"}}>PROJECTED FINISH</div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",color:C.text}}>{result.projectedDate}</div>
                  <div style={{fontSize:"0.75rem",color:verdColor,marginTop:"0.3rem"}}>{result.bufferDays>=0?result.bufferDays+"d buffer":Math.abs(result.bufferDays)+"d over target"}</div>
                </div>
                <div style={{...card(),padding:"1rem"}}>
                  <div style={{fontSize:"0.6rem",color:C.textDim,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.3rem"}}>CRITICAL PATH LENGTH</div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",color:C.red}}>{result.projectDuration} days</div>
                  <div style={{fontSize:"0.75rem",color:C.textMid,marginTop:"0.3rem"}}>{result.criticalPath.length} sequential tasks</div>
                </div>
              </div>
            </div>
          )}

          {/* ══ DIAGNOSIS ══ */}
          {activeNav==="diagnosis" && (
            <div style={{animation:"fadeUp 0.3s ease both"}}>
              <div style={{marginBottom:"1.25rem"}}>
                <div style={{fontSize:"1.2rem",fontWeight:700}}>Diagnosis</div>
                <div style={{fontSize:"0.8rem",color:C.textMid,marginTop:"0.2rem"}}>What's driving the pressure and what to change.</div>
              </div>
              <div style={{...card({border:"1px solid "+verdColor+"40"}),padding:"1.25rem",marginBottom:"1rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem"}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:verdColor}}/>
                  <div style={{fontSize:"0.75rem",fontWeight:700,color:verdColor}}>{result.verdict}</div>
                  <div style={{fontSize:"0.75rem",color:C.textMid}}>· {confScore}% execution confidence</div>
                </div>
                <p style={{fontSize:"0.88rem",color:C.textMid,lineHeight:1.75}}>{result.confidence.reason}</p>
              </div>
              <div style={{...card(),padding:"1.25rem",marginBottom:"1rem"}}>
                <div style={label(C.purple)}>PRIMARY CONSTRAINT</div>
                <div style={{display:"flex",gap:"0.5rem",marginBottom:"1.25rem",flexWrap:"wrap"}}>
                  {["SCOPE","TIME","BUDGET"].map(k=>{
                    const breakdown = result.confidence.breakdown;
                    const lowestFactor = [...breakdown].sort((a,b)=>a.score-b.score)[0]?.name||"";
                    const isActive = (k==="TIME"&&lowestFactor.includes("timeline"))||(k==="BUDGET"&&lowestFactor.includes("budget"))||(k==="SCOPE");
                    const col = k==="TIME"?C.amber:k==="BUDGET"?C.red:C.blue;
                    return <div key={k} style={{background:isActive?col+"15":"transparent",border:"1px solid "+(isActive?col:C.border),borderRadius:100,padding:"0.3rem 1rem",fontSize:"0.72rem",fontWeight:isActive?700:400,color:isActive?col:C.textDim,letterSpacing:"0.06em"}}>{k}{isActive?" ←":""}</div>;
                  })}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
                  {[
                    {color:C.blue,border:"rgba(59,130,246,0.4)",text:`Scope move: ${result.shuffleOps[0]?`Consider running "${result.shuffleOps[0].task}" concurrently — saves ${result.shuffleOps[0].daysSaved} days without cutting scope.`:"Review whether all milestones are required for this phase."}`},
                    {color:C.amber,border:"rgba(245,158,11,0.4)",text:`Timeline move: ${result.bufferDays<0?`Plan runs ${Math.abs(result.bufferDays)} days over. Identify two sequential tasks that can overlap.`:`${result.bufferDays} days of buffer. Protect critical path — one slip removes it entirely.`}`},
                    {color:C.red,border:"rgba(239,68,68,0.4)",text:`Budget move: ${overrunCost>0?`At $${Math.round(dailyBurn)}/day, ${Math.abs(result.bufferDays)} extra days costs $${Math.round(overrunCost).toLocaleString()} beyond budget.`:"Currently within budget. Daily burn rate is sustainable if plan holds."}`},
                  ].map((m,i)=>(
                    <div key={i} style={{fontSize:"0.88rem",color:C.textMid,lineHeight:1.75,paddingLeft:"1rem",borderLeft:"2px solid "+m.border}}>{m.text}</div>
                  ))}
                </div>
                <div style={{background:C.greenDim,border:"1px solid "+C.green+"30",borderRadius:8,padding:"1rem",marginTop:"1.25rem"}}>
                  <div style={{fontSize:"0.72rem",fontWeight:700,color:C.green,marginBottom:"0.4rem",letterSpacing:"0.04em"}}>OUR RECOMMENDATION</div>
                  <p style={{fontSize:"0.9rem",color:C.text,lineHeight:1.7}}>{result.shuffleOps[0]?`Run "${result.shuffleOps[0].task}" concurrently with its predecessor. Zero budget impact. Recovers ~${result.shuffleOps[0].daysSaved} days immediately.`:"Validate critical path owner availability before work begins. Single-owner risk is the highest execution threat."}</p>
                </div>
              </div>
            </div>
          )}

          {/* ══ FINANCIALS ══ */}
          {activeNav==="financials" && totalCost > 0 && (
            <div style={{animation:"fadeUp 0.3s ease both"}}>
              <div style={{marginBottom:"1.25rem"}}>
                <div style={{fontSize:"1.2rem",fontWeight:700}}>Budget & Financials</div>
                <div style={{fontSize:"0.8rem",color:C.textMid,marginTop:"0.2rem"}}>Cost exposure and burn rate analysis.</div>
              </div>
              <div style={{...card({border:"1px solid "+(overrunCost>0?C.red:C.green)+"40"}),padding:"1.25rem",marginBottom:"1rem"}}>
                <p style={{fontSize:"0.95rem",color:C.text,lineHeight:1.75,marginBottom:"1.25rem",fontWeight:300}}>
                  <strong style={{color:overrunCost>0?C.red:C.green}}>{overrunCost>0?"Budget overrun. ":"Within budget. "}</strong>
                  {overrunCost>0?`At $${Math.round(dailyBurn).toLocaleString()}/day, ${Math.abs(result.bufferDays)} extra days costs $${Math.round(overrunCost).toLocaleString()} more than mapped.`:
                  `Daily burn of $${Math.round(dailyBurn).toLocaleString()}/day is sustainable within the current plan.`}
                </p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"0.75rem"}}>
                  {[{label:"MAPPED COSTS",val:"$"+totalCost.toLocaleString(),color:C.text},{label:"DAILY BURN",val:"$"+Math.round(dailyBurn).toLocaleString()+"/day",color:C.textMid},{label:"OVERRUN EXPOSURE",val:overrunCost>0?"$"+Math.round(overrunCost).toLocaleString():"None",color:overrunCost>0?C.red:C.green},{label:"PLAN DURATION",val:result.projectDuration+"d",color:C.text}].map((s,i)=>(
                    <div key={i} style={{...card({background:C.surface2}),padding:"0.85rem 1rem"}}>
                      <div style={{fontSize:"0.6rem",color:C.textDim,fontFamily:"monospace",letterSpacing:"0.08em",marginBottom:"0.3rem"}}>{s.label}</div>
                      <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",color:s.color}}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{...card(),padding:"1.25rem"}}>
                <div style={label()}>COST BY MILESTONE</div>
                {data.tasks.filter(t=>t.cost).map((t,i)=>{const cost=parseFloat((t.cost||"0").replace(/[^0-9.]/g,""))||0;const pct=totalCost>0?cost/totalCost:0;return(<div key={i} style={{marginBottom:"0.6rem"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.3rem"}}><span style={{fontSize:"0.84rem",color:C.textMid}}>{t.name}</span><span style={{fontSize:"0.84rem",color:C.text,fontFamily:"monospace"}}>{t.cost}</span></div><div style={{height:5,background:C.border2,borderRadius:3}}><div style={{height:"100%",width:(pct*100)+"%",background:C.purple,borderRadius:3}}/></div></div>);})}
              </div>
            </div>
          )}

          {/* ══ AI READOUT ══ */}
          {activeNav==="readout" && (
            <div style={{animation:"fadeUp 0.3s ease both"}}>
              <div style={{marginBottom:"1.25rem"}}>
                <div style={{fontSize:"1.2rem",fontWeight:700}}>AI Executive Readout</div>
                <div style={{fontSize:"0.8rem",color:C.textMid,marginTop:"0.2rem"}}>Written to be forwarded. Copy and paste into an email, Slack, or client update.</div>
              </div>
              <div style={{...card(),padding:"1.5rem"}}>
                {aiLoading?(
                  <div style={{display:"flex",alignItems:"center",gap:"0.6rem",color:C.textMid,fontSize:"0.82rem"}}>
                    <span>Writing readout</span>{[0,1,2].map(i=><span key={i} style={{width:4,height:4,background:C.purple,borderRadius:"50%",display:"inline-block",animation:`dotBlink 1.4s ${i*0.22}s infinite`}}/>)}
                  </div>
                ):aiReadout?(
                  <p style={{fontSize:"0.95rem",color:C.text,lineHeight:1.9,fontWeight:300,fontFamily:"Georgia,serif"}}>{aiReadout}</p>
                ):(
                    <div>
                    <p style={{fontSize:"0.95rem",color:C.text,lineHeight:1.9,marginBottom:"0.75rem",fontFamily:"Georgia,serif"}}>{data.name} has a {confScore}% probability of delivering on time as currently planned. {result.confidence.reason}. The critical path runs through {result.criticalPath.length} sequential tasks with {result.bufferDays>=0?result.bufferDays+" days of buffer":Math.abs(result.bufferDays)+" days of unrecoverable overrun"}.</p>
                    <p style={{fontSize:"0.95rem",color:C.text,lineHeight:1.9,fontFamily:"Georgia,serif"}}>With Pathflo's recommended changes applied, on-time confidence rises to {confScoreOptimized}% — a +{confScoreOptimized-confScore} point improvement. {result.predictiveRisk?`Predictive risk analysis places the probability of missing the deadline at ${result.predictiveRisk.planProb}% without intervention, driven primarily by ${result.predictiveRisk.top3[0]?.name} — ${result.predictiveRisk.top3[0]?.reason}. `:""}The recommended immediate action is to {result.shuffleOps[0]?`run "${result.shuffleOps[0].task}" concurrently with its predecessor, recovering approximately ${result.shuffleOps[0].daysSaved} days at zero additional cost`:"validate critical path owner availability before work begins"}.</p>
                    <p style={{fontSize:"0.78rem",color:C.textDim,marginTop:"1rem",fontStyle:"italic"}}>Add your Anthropic API key to Vercel environment variables to enable fully AI-generated readouts.</p>
                    </div>
                )}
              </div>
            </div>
          )}

          {/* ══ DETAILS ══ */}
          {activeNav==="details" && (
            <div style={{animation:"fadeUp 0.3s ease both"}}>
              <div style={{marginBottom:"1.25rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:"1.2rem",fontWeight:700}}>All Milestones</div>
                    <div style={{fontSize:"0.8rem",color:C.textMid,marginTop:"0.2rem"}}>Full task detail with CPM analysis.</div>
                  </div>
                  <button onClick={()=>{
                    const rows=[["Milestone","Owner","Duration","Forecast Start","Forecast End","Actual Start","Actual End","Float","Critical Path"],...result.tasks.map(t=>[t.name,t.owner||"",t.days,"Day "+(t.es+1),"Day "+t.ef,"","",t.slack===0?"No float":t.slack+"d spare",result.criticalPath.includes(t.name)?"Yes":"No"])];
                    const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n");
                    const b=new Blob([csv],{type:"text/csv"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=(data.name||"pathflo").replace(/\s+/g,"-").toLowerCase()+"-forecast.csv";a.click();URL.revokeObjectURL(u);
                  }} style={{background:C.greenDim,border:"1px solid "+C.green+"30",borderRadius:100,color:C.green,fontFamily:"inherit",fontSize:"0.75rem",fontWeight:600,padding:"0.4rem 1rem",cursor:"pointer"}}>↓ Export CSV</button>
                </div>
              </div>
              <div style={{...card(),padding:"0"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 70px 60px",gap:"0.5rem",padding:"0.6rem 1rem",borderBottom:"1px solid "+C.border,fontSize:"0.62rem",color:C.textDim,fontWeight:700,letterSpacing:"0.1em"}}>
                  <span>MILESTONE</span><span>OWNER</span><span>DAYS</span><span>START</span><span>FLOAT</span>
                </div>
                {result.tasks.map((t,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 70px 60px",gap:"0.5rem",padding:"0.65rem 1rem",borderBottom:i<result.tasks.length-1?"1px solid "+C.border2:"none",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:"0.85rem",color:t.slack===0?C.red:C.text,fontWeight:t.slack===0?600:400}}>{t.slack===0?"◆ ":""}{t.name}</div>
                      {t.concurrent&&<div style={{fontSize:"0.65rem",color:C.green,marginTop:"0.15rem"}}>↑ runs concurrently</div>}
                    </div>
                    <div style={{fontSize:"0.78rem",color:C.textMid,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.owner||"—"}</div>
                    <div style={{fontSize:"0.82rem",color:C.text}}>{t.days}d</div>
                    <div style={{fontSize:"0.78rem",color:C.textDim}}>Day {t.es+1}</div>
                    <span style={{fontSize:"0.65rem",fontFamily:"monospace",borderRadius:4,padding:"0.15rem 0.5rem",background:t.slack===0?C.red+"20":C.green+"15",color:t.slack===0?C.red:C.green,fontWeight:700,display:"inline-block"}}>{t.slack===0?"CRITICAL":"+"+t.slack+"d"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div style={{minHeight:"100vh",background:"#0D1117",display:"flex",alignItems:"center",justifyContent:"center",color:"#8B949E",fontFamily:"system-ui"}}>Building your execution intelligence report...</div>}>
      <ResultsContent/>
    </Suspense>
  );
}
