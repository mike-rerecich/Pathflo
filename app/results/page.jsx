"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
        <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.12em", color: C.amber, textTransform: "uppercase" }}>
        <Tooltip text="Pick a task and drag the slider to see what happens if it slips. Pathflo recalculates your entire timeline instantly — new finish date, updated confidence, and which tasks get blocked.">⚡ Cascade Impact Simulator ⓘ</Tooltip>
      </div>
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


// ── SVG DEPENDENCY GRAPH — drop-in replacement for canvas version ─────────────
// Pure SVG: pixel-perfect on all screens, native touch, no DPR math
function DependencyGraph({ tasks, result, onNodeClick, simulatorTaskId }) {
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const containerRef = useRef(null);

  // ── LAYOUT ENGINE ────────────────────────────────────────────────────────────
  const layout = useMemo(() => {
    if (!tasks.length || !result) return { positions: {}, W: 600, H: 300, levels: {} };

    // Assign column levels via topological sort
    const levels = {};
    function assignLevel(id, lvl) {
      if (levels[id] !== undefined && levels[id] >= lvl) return;
      levels[id] = lvl;
      tasks.filter(t => t.predecessors.includes(id)).forEach(s => assignLevel(s.id, lvl + 1));
    }
    tasks.filter(t => t.predecessors.length === 0).forEach(t => assignLevel(t.id, 0));
    tasks.forEach(t => { if (levels[t.id] === undefined) assignLevel(t.id, 0); });

    // Group by level
    const byLevel = {};
    tasks.forEach(t => {
      const l = levels[t.id] || 0;
      if (!byLevel[l]) byLevel[l] = [];
      byLevel[l].push(t);
    });

    const maxLevel = Math.max(...Object.values(levels), 0);
    const numCols = maxLevel + 1;
    const maxInCol = Math.max(...Object.values(byLevel).map(g => g.length), 1);

    // Node dimensions
    const NW = 124, NH = 52, GAP_X = 72, GAP_Y = 20;
    const colW = NW + GAP_X;
    const W = Math.max(numCols * colW + GAP_X, 400);
    const H = Math.max(maxInCol * (NH + GAP_Y) + 80, 200);

    // Position each node centered in its column
    const positions = {};
    Object.entries(byLevel).forEach(([lvl, group]) => {
      const x = GAP_X / 2 + parseInt(lvl) * colW;
      const totalH = group.length * (NH + GAP_Y) - GAP_Y;
      const startY = (H - totalH) / 2;
      group.forEach((t, i) => {
        positions[t.id] = {
          x, y: Math.max(36, startY + i * (NH + GAP_Y)),
          cx: x + NW / 2, cy: Math.max(36, startY + i * (NH + GAP_Y)) + NH / 2,
          w: NW, h: NH,
        };
      });
    });

    return { positions, W, H, levels };
  }, [tasks, result]);

  // ── DERIVED STATE ─────────────────────────────────────────────────────────────
  const focusId = hoveredId || selectedId;

  const upstream = useMemo(() => {
    if (!focusId) return new Set();
    const set = new Set();
    function walk(id) {
      const t = tasks.find(t => t.id === id);
      if (!t) return;
      t.predecessors.forEach(pid => { if (!set.has(pid)) { set.add(pid); walk(pid); } });
    }
    walk(focusId);
    return set;
  }, [focusId, tasks]);

  const downstream = useMemo(() => {
    if (!focusId) return new Set();
    const set = new Set();
    function walk(id) {
      tasks.filter(t => t.predecessors.includes(id)).forEach(t => {
        if (!set.has(t.id)) { set.add(t.id); walk(t.id); }
      });
    }
    walk(focusId);
    return set;
  }, [focusId, tasks]);

  const criticalIds = useMemo(() =>
    new Set(result?.tasks?.filter(t => t.slack === 0).map(t => t.id) || [])
  , [result]);

  const bottleneckName = result?.bottleneck?.name || "";

  // ── NODE CLICK / TAP ──────────────────────────────────────────────────────────
  function handleNodeClick(id) {
    const next = id === selectedId ? null : id;
    setSelectedId(next);
    onNodeClick && onNodeClick(next);
  }

  // ── EDGE PATH ─────────────────────────────────────────────────────────────────
  function edgePath(from, to) {
    const fx = from.x + from.w;
    const fy = from.cy;
    const tx = to.x;
    const ty = to.cy;
    const cp = (tx - fx) * 0.5;
    return `M ${fx} ${fy} C ${fx + cp} ${fy}, ${tx - cp} ${ty}, ${tx} ${ty}`;
  }

  // ── CASCADE ZONE RECT ─────────────────────────────────────────────────────────
  const cascadeRect = useMemo(() => {
    if (!result || criticalIds.size < 2) return null;
    const pts = [...criticalIds].map(id => layout.positions[id]).filter(Boolean);
    if (pts.length < 2) return null;
    const pad = 14;
    const minX = Math.min(...pts.map(p => p.x)) - pad;
    const minY = Math.min(...pts.map(p => p.y)) - pad;
    const maxX = Math.max(...pts.map(p => p.x + p.w)) + pad;
    const maxY = Math.max(...pts.map(p => p.y + p.h)) + pad;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [criticalIds, layout.positions, result]);

  if (!tasks.length || !result) return null;

  const { positions, W, H } = layout;
  const connected = new Set([...upstream, ...downstream]);

  return (
    <div
      ref={containerRef}
      style={{ overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", width: "100%", cursor: "grab" }}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", minWidth: W }}
      >
        <defs>
          {/* Arrowhead markers */}
          <marker id="arrow-crit" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="rgba(239,68,68,0.85)" />
          </marker>
          <marker id="arrow-dim" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="rgba(72,79,88,0.25)" />
          </marker>
          <marker id="arrow-focus" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="rgba(124,58,237,0.9)" />
          </marker>
          <marker id="arrow-up" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="rgba(59,130,246,0.9)" />
          </marker>
          <marker id="arrow-down" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="rgba(239,68,68,0.7)" />
          </marker>
          <marker id="arrow-norm" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="rgba(139,148,158,0.5)" />
          </marker>
          {/* Glow filter for selected/simulator nodes */}
          <filter id="glow-amber" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="glow-purple" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          {/* Node clip for rounded rect text */}
          {tasks.map(t => positions[t.id] && (
            <clipPath key={`clip-${t.id}`} id={`clip-${t.id}`}>
              <rect x={positions[t.id].x} y={positions[t.id].y} width={positions[t.id].w} height={positions[t.id].h} rx="9" />
            </clipPath>
          ))}
        </defs>

        {/* ── CASCADE IMPACT ZONE ── */}
        {cascadeRect && (
          <g>
            <rect
              x={cascadeRect.x} y={cascadeRect.y}
              width={cascadeRect.w} height={cascadeRect.h}
              rx="12" fill="rgba(239,68,68,0.035)"
              stroke="rgba(239,68,68,0.3)" strokeWidth="1"
              strokeDasharray="6 4"
            />
            <text
              x={cascadeRect.x + cascadeRect.w / 2} y={cascadeRect.y + 14}
              textAnchor="middle" fontSize="8" fontFamily="system-ui" fontWeight="700"
              fill="rgba(239,68,68,0.6)" letterSpacing="0.08em"
            >CASCADE IMPACT ZONE</text>
          </g>
        )}

        {/* ── EDGES ── */}
        {tasks.map(t =>
          t.predecessors.map(pid => {
            const from = positions[pid];
            const to = positions[t.id];
            if (!from || !to) return null;

            const isCritEdge = criticalIds.has(pid) && criticalIds.has(t.id);
            const isUpEdge = focusId && (upstream.has(pid) && (upstream.has(t.id) || t.id === focusId));
            const isDownEdge = focusId && (downstream.has(t.id) && (downstream.has(pid) || pid === focusId));
            const isFocusEdge = focusId && (pid === focusId || t.id === focusId);
            const isDimmed = focusId && !isUpEdge && !isDownEdge && !isFocusEdge;

            let stroke, strokeW, marker, dashArray;

            if (isDimmed) {
              stroke = "rgba(72,79,88,0.18)"; strokeW = 1.5; marker = "url(#arrow-dim)"; dashArray = "none";
            } else if (isUpEdge) {
              stroke = "rgba(59,130,246,0.85)"; strokeW = 2.5; marker = "url(#arrow-up)"; dashArray = "none";
            } else if (isDownEdge || isFocusEdge) {
              stroke = isCritEdge ? "rgba(239,68,68,0.9)" : "rgba(124,58,237,0.8)";
              strokeW = 2.5; marker = isCritEdge ? "url(#arrow-crit)" : "url(#arrow-focus)";
              dashArray = "none";
            } else if (isCritEdge) {
              stroke = "rgba(239,68,68,0.6)"; strokeW = 2; marker = "url(#arrow-crit)";
              dashArray = "none";
            } else {
              stroke = "rgba(139,148,158,0.3)"; strokeW = 1.5; marker = "url(#arrow-norm)";
              dashArray = t.concurrent ? "5 4" : "none";
            }

            return (
              <path
                key={`${pid}-${t.id}`}
                d={edgePath(from, to)}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeW}
                strokeDasharray={dashArray}
                markerEnd={marker}
                style={{ transition: "stroke 0.2s, stroke-width 0.2s" }}
              />
            );
          })
        )}

        {/* ── NODES ── */}
        {tasks.map(t => {
          const pos = positions[t.id];
          if (!pos) return null;

          const rt = result.tasks.find(r => r.id === t.id);
          const isCrit = criticalIds.has(t.id);
          const isSelected = t.id === selectedId;
          const isHovered = t.id === hoveredId;
          const isSimulator = t.id === simulatorTaskId;
          const isUpstream = upstream.has(t.id);
          const isDownstream = downstream.has(t.id);
          const isDimmed = focusId && t.id !== focusId && !connected.has(t.id);
          const isBottleneck = bottleneckName && t.name === bottleneckName;

          // Blocked by label logic
          const showBlockedBy = result.bufferDays < 0 && isCrit
            && t.predecessors.some(pid => {
              const p = tasks.find(tt => tt.id === pid);
              return p && p.name === bottleneckName;
            });

          // Colors
          let fill, stroke, strokeW, textColor, subColor, dotColor;
          const opacity = isDimmed ? 0.28 : 1;

          if (isSimulator) {
            fill = "rgba(245,158,11,0.18)"; stroke = "#F59E0B"; strokeW = 2.5;
            textColor = "#F59E0B"; subColor = "#F59E0B"; dotColor = "#F59E0B";
          } else if (isSelected) {
            fill = "rgba(124,58,237,0.2)"; stroke = "#7C3AED"; strokeW = 2.5;
            textColor = "#A78BFA"; subColor = "#8B949E"; dotColor = "#7C3AED";
          } else if (isUpstream) {
            fill = "rgba(59,130,246,0.12)"; stroke = "rgba(59,130,246,0.85)"; strokeW = 2;
            textColor = "#60A5FA"; subColor = "#8B949E"; dotColor = "#3B82F6";
          } else if (isDownstream) {
            fill = "rgba(239,68,68,0.1)"; stroke = "rgba(239,68,68,0.6)"; strokeW = 2;
            textColor = "#F87171"; subColor = "#8B949E"; dotColor = "#EF4444";
          } else if (isCrit) {
            fill = result.bufferDays < 0 ? "rgba(239,68,68,0.14)" : "rgba(239,68,68,0.09)";
            stroke = result.bufferDays < 0 ? "#EF4444" : "rgba(239,68,68,0.7)";
            strokeW = 2; textColor = "#F87171"; subColor = "#8B949E"; dotColor = "#EF4444";
          } else {
            fill = "rgba(22,27,34,0.85)"; stroke = "#30363D"; strokeW = 1.5;
            textColor = "#8B949E"; subColor = "#484F58"; dotColor = "#22C55E";
          }

          // Glow filter
          const filterAttr = isSimulator ? "url(#glow-amber)" : isSelected ? "url(#glow-purple)" : undefined;

          // Sub-label
          const subLabel = showBlockedBy
            ? `Blocked by ${bottleneckName}`.slice(0, 20)
            : `${t.days}d · ${(t.owner === "UNASSIGNED" ? "Unassigned" : t.owner) || "?"}`.slice(0, 18);

          // Float badge
          const floatDays = rt?.slack || 0;

          return (
            <g
              key={t.id}
              style={{ cursor: "pointer", opacity, transition: "opacity 0.2s" }}
              onClick={() => handleNodeClick(t.id)}
              onMouseEnter={() => setHoveredId(t.id)}
              onMouseLeave={() => setHoveredId(null)}
              filter={filterAttr}
            >
              {/* Selection ring */}
              {(isSelected || isSimulator) && (
                <rect
                  x={pos.x - 4} y={pos.y - 4}
                  width={pos.w + 8} height={pos.h + 8}
                  rx="13" fill="none"
                  stroke={isSimulator ? "rgba(245,158,11,0.35)" : "rgba(124,58,237,0.3)"}
                  strokeWidth="2"
                />
              )}

              {/* Node body */}
              <rect
                x={pos.x} y={pos.y}
                width={pos.w} height={pos.h}
                rx="9"
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeW}
                style={{ transition: "fill 0.2s, stroke 0.2s" }}
              />

              {/* Top accent bar for critical nodes */}
              {isCrit && !isDimmed && (
                <rect
                  x={pos.x + 1} y={pos.y + 1}
                  width={pos.w - 2} height="2"
                  rx="1" fill={dotColor} opacity="0.6"
                />
              )}

              {/* Task name */}
              <text
                x={pos.x + 10} y={pos.y + 19}
                fontSize="10.5" fontFamily="system-ui" fontWeight={isCrit || isSelected ? "700" : "500"}
                fill={isDimmed ? "#484F58" : textColor}
                style={{ transition: "fill 0.2s" }}
              >
                {t.name.length > 14 ? t.name.slice(0, 13) + "…" : t.name}
              </text>

              {/* Sub-label */}
              <text
                x={pos.x + 10} y={pos.y + 34}
                fontSize="9" fontFamily="system-ui" fontWeight="400"
                fill={isDimmed ? "#333D33" : (showBlockedBy ? "#EF4444" : subColor)}
                style={{ transition: "fill 0.2s" }}
              >
                {subLabel}
              </text>

              {/* Status dot */}
              <circle
                cx={pos.x + pos.w - 12} cy={pos.y + 13}
                r="4"
                fill={isDimmed ? "#252D25" : dotColor}
                style={{ transition: "fill 0.2s" }}
              />

              {/* Float badge */}
              {floatDays > 0 && !isDimmed && (
                <g>
                  <rect
                    x={pos.x + pos.w - 30} y={pos.y + pos.h - 14}
                    width={26} height={11} rx="3"
                    fill="rgba(34,197,94,0.18)"
                  />
                  <text
                    x={pos.x + pos.w - 17} y={pos.y + pos.h - 5}
                    fontSize="7.5" fontFamily="system-ui" fontWeight="700"
                    fill="#22C55E" textAnchor="middle"
                  >+{floatDays}d</text>
                </g>
              )}

              {/* Simulator label */}
              {isSimulator && (
                <text
                  x={pos.cx} y={pos.y + pos.h - 4}
                  fontSize="7" fontFamily="system-ui" fontWeight="700"
                  fill="#F59E0B" textAnchor="middle" letterSpacing="0.06em"
                >SIMULATING</text>
              )}
            </g>
          );
        })}

        {/* ── LEGEND ── */}
        {[
          { color: "#EF4444", label: "Critical" },
          { color: "#22C55E", label: "On Track" },
          { color: "#F59E0B", label: "Simulating" },
          { color: "#3B82F6", label: "Upstream" },
          { color: "#7C3AED", label: "Selected" },
        ].map((l, i) => (
          <g key={i} transform={`translate(${12 + i * 90}, ${H - 14})`}>
            <circle cx="5" cy="0" r="4" fill={l.color} opacity="0.8" />
            <text x="13" y="4" fontSize="9" fontFamily="system-ui" fill="#484F58">{l.label}</text>
          </g>
        ))}

        {/* ── TAP HINT ── */}
        {!selectedId && !simulatorTaskId && (
          <text
            x={W - 10} y={H - 14}
            fontSize="9" fontFamily="system-ui" fill="rgba(72,79,88,0.5)"
            textAnchor="end"
          >Tap any node for details</text>
        )}
      </svg>
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


// ── METRIC TOOLTIP ────────────────────────────────────────────────────────────
function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <span
        onClick={() => setShow(s => !s)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ cursor: "pointer" }}
      >{children}</span>
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)", background: "#1C2128",
          border: "1px solid #30363D", borderRadius: 8, padding: "0.5rem 0.7rem",
          fontSize: "0.75rem", color: "#E6EDF3", lineHeight: 1.55,
          maxWidth: 240, whiteSpace: "normal",
          zIndex: 999, pointerEvents: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          animation: "fadeUp 0.15s ease both",
        }}>{text}</span>
      )}
    </span>
  );
}

// ── SHARE LINK ────────────────────────────────────────────────────────────────
function ShareButton({ data, result, confScore }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  function copyLink() {
    const url = window.location.origin + "/results?data=" + encodeURIComponent(JSON.stringify(data));
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyReadout() {
    const text = [
      `${data.name} — Pathflo Execution Intelligence Report`,
      ``,
      `On-time delivery confidence: ${confScore}%`,
      `Verdict: ${result.verdict}`,
      `Projected completion: ${result.projectedDate}`,
      `Buffer: ${result.bufferDays >= 0 ? result.bufferDays + " days" : "OVERRUN by " + Math.abs(result.bufferDays) + " days"}`,
      ``,
      `Critical path: ${result.criticalPath.join(" → ")}`,
      `Failure probability: ${result.predictiveRisk?.planProb || 0}%`,
      ``,
      result.shuffleOps.length > 0
        ? `Top recommendation: Run "${result.shuffleOps[0].task}" in parallel with "${result.shuffleOps[0].sharedPredecessor || result.shuffleOps[0].predecessor}" — recovers ~${result.shuffleOps[0].daysSaved} days at zero cost.`
        : "No major scheduling improvements identified.",
      ``,
      `Powered by Pathflo — pathflo.ai`,
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => { setCopied(false); setOpen(false); }, 2000);
    });
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: "transparent", border: "1px solid #30363D", borderRadius: 8, color: "#8B949E", fontFamily: "inherit", fontWeight: 500, fontSize: "0.75rem", padding: "0.4rem 0.75rem", cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.35rem" }}
      >
        ↗ Share
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#1C2128", border: "1px solid #30363D", borderRadius: 10, padding: "0.5rem", zIndex: 300, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          <button onClick={copyLink} style={{ width: "100%", background: "transparent", border: "none", color: "#E6EDF3", fontFamily: "inherit", fontSize: "0.82rem", padding: "0.55rem 0.75rem", cursor: "pointer", textAlign: "left", borderRadius: 6, display: "flex", alignItems: "center", gap: "0.5rem" }}
            onMouseEnter={e => e.target.style.background = "#21262D"} onMouseLeave={e => e.target.style.background = "transparent"}>
            🔗 Copy report link
          </button>
          <button onClick={copyReadout} style={{ width: "100%", background: "transparent", border: "none", color: "#E6EDF3", fontFamily: "inherit", fontSize: "0.82rem", padding: "0.55rem 0.75rem", cursor: "pointer", textAlign: "left", borderRadius: 6, display: "flex", alignItems: "center", gap: "0.5rem" }}
            onMouseEnter={e => e.target.style.background = "#21262D"} onMouseLeave={e => e.target.style.background = "transparent"}>
            📋 Copy text summary
          </button>
          {copied && <div style={{ fontSize: "0.72rem", color: "#22C55E", padding: "0.3rem 0.75rem", fontWeight: 600 }}>✓ Copied!</div>}
        </div>
      )}
    </div>
  );
}

// ── RESULTS CONTENT ───────────────────────────────────────────────────────────
function ResultsContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState(null);
  const [result, setResult] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [activeNav, setActiveNav] = useState("plan");
  const [aiReadout, setAiReadout] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [stakeholderVersions, setStakeholderVersions] = useState(null);
  const [deadlineReversal, setDeadlineReversal] = useState(null);
  const [aiTier, setAiTier] = useState("free");
  const [stakeholderTab, setStakeholderTab] = useState("client");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null); // P1-1
  const [simulatorTaskId, setSimulatorTaskId] = useState(null); // P1-2

  useEffect(() => {
    try {
      const analysisId = searchParams.get("id");
      const raw = analysisId
        ? window.sessionStorage.getItem(analysisId)
        : searchParams.get("data");

      if (!raw) {
        setLoadError("No analysis data was found. Start a new plan to generate a results report.");
        return;
      }

      const parsed = JSON.parse(raw);
      if (!parsed?.tasks?.length) {
        setLoadError("This analysis does not include any milestones. Start a new plan to generate a results report.");
        return;
      }

      setData(parsed);
      const stakes = parsed.deadlineStakes || "";
      const derivedBudget = (stakes.includes("penalty") || stakes.includes("Regulatory") || stakes.includes("legal")) ? "Fixed"
        : (stakes.includes("Revenue") || stakes.includes("Client")) ? "Tight" : "Flexible";
      const r = computeCPM(parsed.tasks, parsed.startDate, parsed.targetDate, parsed.budget || derivedBudget);
      setResult(r);
      setAiLoading(true);
      fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectData:parsed})})
        .then(res=>res.json()).then(d=>{
          setAiReadout(d.readout||null);
          if (d.stakeholderVersions) setStakeholderVersions(d.stakeholderVersions);
          if (d.deadlineReversal) setDeadlineReversal(d.deadlineReversal);
          if (d.tier) setAiTier(d.tier);
          setAiLoading(false);
        }).catch(()=>setAiLoading(false));
    } catch(e){
      console.error(e);
      setLoadError("This analysis link could not be opened. Start a new plan to generate a fresh results report.");
    }
  }, [searchParams]);

  // ── WORKLOAD INTELLIGENCE ENGINE (P1-3) — must be before any early return ─────
  const workloadData = useMemo(() => {
    if (!result || !data || !data.tasks.length) return null;

    // Group tasks by owner
    const byOwner = {};
    data.tasks.forEach(t => {
      const owner = t.owner === "UNASSIGNED" || !t.owner ? "Unassigned" : t.owner;
      if (!byOwner[owner]) byOwner[owner] = { name: owner, tasks: [], criticalTasks: [], totalDays: 0, criticalDays: 0 };
      const rt = result.tasks.find(r => r.id === t.id);
      byOwner[owner].tasks.push({ ...t, slack: rt?.slack || 0, isCritical: rt?.slack === 0 });
      byOwner[owner].totalDays += parseInt(t.days) || 0;
      if (rt?.slack === 0) {
        byOwner[owner].criticalTasks.push(t.name);
        byOwner[owner].criticalDays += parseInt(t.days) || 0;
      }
    });

    const owners = Object.values(byOwner).sort((a, b) => b.criticalDays - a.criticalDays);
    const maxDays = Math.max(...owners.map(o => o.totalDays), 1);
    const totalCritical = result.criticalPath.length;

    // Concentration risk: one owner has >50% of critical tasks
    const concentrationRisk = owners.find(o => o.criticalTasks.length > totalCritical * 0.5 && totalCritical > 1);

    // Approval bottlenecks: tasks with many dependents
    const bottlenecks = result.tasks
      .map(rt => {
        const dependents = data.tasks.filter(t => t.predecessors.includes(rt.id)).length;
        const task = data.tasks.find(t => t.id === rt.id);
        return { ...rt, name: task?.name || rt.name, owner: task?.owner || "Unassigned", dependents };
      })
      .filter(t => t.dependents >= 2 && t.slack === 0)
      .sort((a, b) => b.dependents - a.dependents)
      .slice(0, 3);

    // Sequential overload: owner has 3+ sequential critical tasks
    const sequentialRisk = owners.filter(o => o.criticalTasks.length >= 3);

    return { owners, maxDays, concentrationRisk, bottlenecks, sequentialRisk, totalCritical };
  }, [result, data]);

  if (loadError) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.textMid,fontFamily:"system-ui",padding:"1rem"}}>
      <div style={{textAlign:"center",maxWidth:460}}>
        <div style={{fontSize:"1.05rem",color:C.text,fontWeight:700,marginBottom:"0.5rem"}}>Results unavailable</div>
        <div style={{fontSize:"0.9rem",lineHeight:1.6,marginBottom:"1.2rem"}}>{loadError}</div>
        <a href="/app" style={{display:"inline-block",background:C.green,color:"#081008",borderRadius:8,padding:"0.7rem 1.2rem",fontWeight:700,textDecoration:"none"}}>Start a new plan</a>
      </div>
    </div>
  );

  if (!data||!result) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.textMid,fontFamily:"system-ui"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:40,height:40,border:"2px solid "+C.green,borderTopColor:"transparent",borderRadius:"50%",margin:"0 auto 1rem",animation:"spin 0.8s linear infinite"}}/>
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
  const hasRealOptimization = result.shuffleOps?.length > 0 && result.confidenceOptimized?.score > confScore;
  const confScoreOptimized = hasRealOptimization ? result.confidenceOptimized.score : confScore;
  const planRisk = result.predictiveRisk?.planProb || 0;
  const navItems = [
    { id:"overview",  label:"Overview",        icon:"⬡" },
    { id:"plan",      label:"Execution Plan",  icon:"◈" },
    { id:"risk",      label:"Risk & Fixes",    icon:"⚠" },
    { id:"workload",  label:"Workload",         icon:"⊞" },
    { id:"readout",   label:"AI Readout",      icon:"✦" },
  ];
  const style = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes dotBlink{0%,80%,100%{opacity:0}40%{opacity:1}}
    @keyframes slideIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
    ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#30363D;border-radius:2px}
    .tip-icon{font-size:0.6rem;opacity:0.5;cursor:pointer;user-select:none;vertical-align:middle;margin-left:2px}
    @media(max-width:768px){
      .r-nav{display:none !important}
      .r-hero-grid{grid-template-columns:1fr !important}
      .r-2col{grid-template-columns:1fr !important}
      .r-3col{grid-template-columns:1fr !important}
      .r-briefing{grid-template-columns:1fr !important}
      .r-graph-wrap{flex-direction:column !important}
      .r-detail-panel{width:100% !important;border-left:none !important;border-top:1px solid #30363D !important;max-height:60vh}
      .r-main{padding:0.75rem !important}
    }
  `;

  const card =(extra={}) => ({background:C.surface,border:"1px solid "+C.border,borderRadius:12,...extra});
  const label = (color=C.purple) => ({fontSize:"0.6rem",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color,marginBottom:"0.4rem"});
  const verdColor = result.verdict==="ON TRACK" ? C.green : result.verdict==="AT RISK" ? C.amber : C.red;

  // Graph section with interactive panel
  const GraphSection = ({ preview = false }) => (
    <div style={{ display: "flex", overflow: "hidden", borderRadius: 12, border: "1px solid " + C.border }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <DependencyGraph
          tasks={data.tasks}
          result={result}
          onNodeClick={(id) => {
            setSelectedNodeId(id);
            // Auto-switch to graph tab if in preview mode
            if (preview && id) setActiveNav("plan");
          }}
        />
      </div>
      {selectedNodeId && (
        <NodeDetailPanel
          nodeId={selectedNodeId}
          tasks={data.tasks}
          result={result}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  );

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"Inter,system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{style}</style>

      {/* ── TOP BAR ── */}
      <div style={{background:C.surface,borderBottom:"1px solid "+C.border,minHeight:52,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 0.75rem",position:"sticky",top:0,zIndex:200,gap:"0.5rem",flexShrink:0,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.75rem"}}>
          <button onClick={()=>setNavCollapsed(v=>!v)} style={{background:"transparent",border:"none",color:C.textMid,cursor:"pointer",fontSize:"1rem",padding:"0.25rem"}}>☰</button>
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <path d="M4 24 C8 24 10 14 15 14 C20 14 22 6 26 6 C29 6 30 12 31 14" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <circle cx="4" cy="24" r="3" fill={C.green}/>
            <circle cx="15" cy="14" r="2.5" fill={C.green} opacity="0.7"/>
            <circle cx="26" cy="6" r="2.5" fill={C.green} opacity="0.5"/>
            <circle cx="31" cy="14" r="2.5" fill={C.green} opacity="0.9"/>
          </svg>
          <span style={{fontWeight:700,color:C.text,fontSize:"0.9rem"}}>Path<span style={{color:C.green}}>flo</span></span>
          <span style={{color:C.border,fontSize:"1rem"}}>|</span>
          <span style={{color:C.textMid,fontSize:"0.85rem",maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{data.name}</span>
          <span style={{background:verdColor+"20",color:verdColor,fontSize:"0.62rem",fontWeight:700,letterSpacing:"0.08em",padding:"0.2rem 0.6rem",borderRadius:100,border:"1px solid "+verdColor+"40",flexShrink:0}}>{result.verdict}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"0.75rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.5rem",fontSize:"0.78rem",color:C.textMid}}>
            <span style={{color:verdColor,fontWeight:700,fontSize:"1rem"}}>{confScore}%</span>
            {hasRealOptimization && (<>
              <span style={{color:C.textDim}}>→</span>
              <span style={{color:C.green,fontWeight:700,fontSize:"1rem"}}>{confScoreOptimized}%</span>
              <span>if optimized</span>
            </>)}
          </div>
          <ShareButton data={data} result={result} confScore={confScore} />
          <button onClick={()=>{
            const reviseData = {name:data.name,startDate:data.startDate,targetDate:data.targetDate,dailyBurnRate:data.dailyBurnRate||"",deadlineStakes:data.deadlineStakes||"",deadlinePenalty:data.deadlinePenalty||"",tasks:data.tasks};
            try {
              const id = "pathflo-revise-" + Date.now().toString(36);
              window.sessionStorage.setItem(id, JSON.stringify(reviseData));
              window.location.href = "/app?revise-id=" + id;
            } catch(e) {
              window.location.href = "/app?revise=" + encodeURIComponent(JSON.stringify(reviseData));
            }
          }} style={{background:"transparent",border:"1px solid "+C.border2,borderRadius:8,color:C.textMid,fontFamily:"inherit",fontWeight:500,fontSize:"0.75rem",padding:"0.4rem 0.75rem",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>✎ Revise</button>
          <a href="/app" style={{background:C.green,color:"#080A08",border:"none",borderRadius:8,fontFamily:"inherit",fontWeight:600,fontSize:"0.8rem",padding:"0.45rem 1rem",cursor:"pointer",textDecoration:"none",whiteSpace:"nowrap",flexShrink:0}}>+ New</a>
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ── LEFT NAV ── */}
        {!navCollapsed && (
          <nav style={{width:220,background:C.surface,borderRight:"1px solid "+C.border,padding:"1rem 0",display:"flex",flexDirection:"column",overflowY:"auto",flexShrink:0}}>
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

        {/* ── MAIN CONTENT ── */}
        <main style={{flex:1,overflowY:"auto",padding:"1.25rem",minWidth:0,overflowX:"hidden"}}>


          {/* ══ OVERVIEW ══ */}
          {activeNav==="overview" && (
            <div style={{animation:"fadeUp 0.3s ease both"}}>

              {/* HERO CARD */}
              <div style={{...card({border:"1px solid "+verdColor+"50"}),padding:"1.25rem",marginBottom:"0.75rem",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:verdColor}}/>

                {/* Top row: confidence + verdict */}
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:"0.75rem",marginBottom:"1rem"}}>
                  <div>
                    <div style={{fontSize:"0.58rem",color:C.textDim,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.3rem"}}>
                    <Tooltip text="The probability your project will finish by the deadline. Left number = current plan. Right number = after applying Pathflo's recommendations.">
                      ON-TIME DELIVERY CONFIDENCE ⓘ
                    </Tooltip>
                  </div>
                    <div style={{display:"flex",alignItems:"baseline",gap:"0.5rem"}}>
                      <span style={{fontFamily:"Georgia,serif",fontSize:"3rem",color:verdColor,lineHeight:1}}>{confScore}</span>
                      <span style={{fontSize:"1.2rem",color:C.textDim}}>%</span>
                      {hasRealOptimization && (<>
                        <span style={{color:C.textDim,fontSize:"1.2rem"}}>→</span>
                        <span style={{fontFamily:"Georgia,serif",fontSize:"3rem",color:C.green,lineHeight:1}}>{confScoreOptimized}</span>
                        <span style={{fontSize:"1.2rem",color:C.textDim}}>%</span>
                      </>)}
                    </div>
                    <div style={{fontSize:"0.72rem",color:C.textMid,marginTop:"0.2rem"}}>{hasRealOptimization ? "As-is → with Pathflo's fixes applied" : "On-time delivery confidence"}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{background:verdColor+"20",color:verdColor,fontSize:"0.78rem",fontWeight:700,padding:"0.35rem 0.85rem",borderRadius:100,border:"1px solid "+verdColor+"40",marginBottom:"0.4rem",display:"inline-block"}}>{result.verdict}</div>
                    <div style={{fontSize:"0.78rem",color:C.textMid}}>{result.projectedRange}</div>
                    <div style={{fontSize:"0.7rem",color:result.bufferDays>=0?C.green:C.red,marginTop:"0.2rem"}}>{result.bufferDays>=0?result.bufferDays+"d buffer":Math.abs(result.bufferDays)+"d over deadline"}</div>
                  </div>
                </div>

                {/* Confidence bar */}
                <div style={{marginBottom:"1rem"}}>
                  <div style={{height:6,background:C.border2,borderRadius:3,marginBottom:"0.25rem"}}>
                    <div style={{height:"100%",width:confScore+"%",background:verdColor,borderRadius:3,transition:"width 1s ease"}}/>
                  </div>
                  <div style={{fontSize:"0.7rem",color:C.textDim}}>{result.confidence.reason}</div>
                </div>

                {/* 3 key signals */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:"0.5rem"}}>
                  {[
                    {label:"Biggest Risk",val:result.bottleneck?.name||result.criticalPath[0]||"—",color:C.red},
                    {label:"Recommended Fix",val:result.shuffleOps[0]?`Run "${result.shuffleOps[0].task}" in parallel — saves ~${result.shuffleOps[0].daysSaved}d`:"Validate critical path owners",color:C.green,nav:"risk"},
                    {label:"Failure Probability",val:(result.predictiveRisk?.planProb||0)+"%",color:result.predictiveRisk?.planBand||C.amber,tip:"Pathflo's estimate of the chance your project misses the deadline without any changes. Driven by critical path length, owner concentration, and buffer."},
                  ].map((s,i)=>(
                    <div key={i} style={{background:C.surface2,borderRadius:8,padding:"0.65rem 0.75rem"}}>
                      <div style={{fontSize:"0.58rem",color:C.textDim,fontWeight:700,letterSpacing:"0.08em",marginBottom:"0.2rem"}}>{s.label}</div>
                      <div style={{fontSize:"0.82rem",fontWeight:600,color:s.color,lineHeight:1.4}}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PILLAR SCORES — 3 chips */}
              {(() => {
                const buf = result.bufferDays;
                const tScore = buf>=14?88:buf>=7?75:buf>=3?60:buf>=0?40:buf>=-3?20:8;
                const ownerConc = result.confidence.breakdown.find(f=>f.name==="Owner concentration")?.score||50;
                const scopeCap = result.confidence.breakdown.find(f=>f.name==="Scope vs capacity")?.score||50;
                const rScore = result.teamSize<=1?Math.round(ownerConc*0.3+scopeCap*0.7):Math.round((ownerConc+scopeCap)/2);
                const sScore = result.confidence.breakdown.find(f=>f.name==="Plan sequencing")?.score||50;
                const oScore = result.confidence.breakdown.find(f=>f.name==="Optimization gaps")?.score||50;
                const opScore = Math.round((sScore+oScore)/2);
                const extScore = result.confidence.breakdown.find(f=>f.name==="External dependencies")?.score||50;
                const budgetScore = result.confidence.breakdown.find(f=>f.name==="Budget pressure")?.score||50;
                const pillars = [
                  { label:"01 · Timeline Health", title:"On time?", color:C.blue,
                    values:[tScore, Math.round((tScore+extScore)/2), budgetScore],
                    labels:["BUFFER","DEPS","BUDGET"], score:tScore+"%", scoreLabel:"TIMELINE",
                    stats:[{name:"Schedule buffer",val:tScore+"%",color:tScore>=70?C.green:tScore>=45?C.amber:C.red},{name:"Dep exposure",val:Math.round((tScore+extScore)/2)+"%",color:C.blue},{name:"Budget pressure",val:budgetScore+"%",color:budgetScore>=70?C.green:C.amber}] },
                  { label:"02 · Workload Intel", title:"Team capacity?", color:C.purple,
                    values:[rScore, ownerConc, scopeCap],
                    labels:["LOAD","OWNER","SCOPE"], score:rScore+"%", scoreLabel:"CAPACITY",
                    stats:[{name:"Workload balance",val:rScore+"%",color:rScore>=70?C.green:rScore>=45?C.amber:C.red},{name:"Owner concentration",val:ownerConc+"%",color:ownerConc>=70?C.green:C.amber},{name:"Scope vs capacity",val:scopeCap+"%",color:scopeCap>=70?C.green:C.amber}] },
                  { label:"03 · Operational Health", title:"Plan efficiency?", color:C.green,
                    values:[opScore, sScore, oScore],
                    labels:["OVERALL","SEQUENCE","OPTIM"], score:opScore+"%", scoreLabel:"EFFICIENCY",
                    stats:[{name:"Plan efficiency",val:opScore+"%",color:opScore>=70?C.green:opScore>=45?C.amber:C.red},{name:"Sequencing",val:sScore+"%",color:sScore>=70?C.green:C.amber},{name:"Optimization",val:oScore+"%",color:oScore>=70?C.green:C.amber}] },
                ];
                return (
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"0.75rem",marginBottom:"0.75rem"}}>
                    {pillars.map((p,i)=>{
                      const col=parseInt(p.score)>=70?C.green:parseInt(p.score)>=45?C.amber:C.red;
                      return(
                        <div key={i} style={{...card({background:C.surface2}),padding:"1rem",borderTop:"2px solid "+p.color,cursor:"pointer"}} onClick={()=>setActiveNav("risk")}>
                          <div style={{fontSize:"0.58rem",color:p.color,fontWeight:700,letterSpacing:"0.08em",marginBottom:"0.15rem"}}>{p.label}</div>
                          <div style={{fontSize:"0.78rem",color:C.text,fontWeight:600,marginBottom:"0.75rem"}}>{p.title}</div>
                          <div style={{display:"flex",justifyContent:"center",marginBottom:"0.75rem"}}>
                            <RadarChart color={p.color} values={p.values} labels={p.labels} score={p.score} scoreLabel={p.scoreLabel}/>
                          </div>
                          {p.stats.map((s,j)=>(
                            <div key={j} style={{display:"flex",justifyContent:"space-between",fontSize:"0.75rem",padding:"0.3rem 0",borderBottom:j<p.stats.length-1?"1px solid "+C.border2:"none"}}>
                              <span style={{color:C.textMid}}>{s.name}</span>
                              <span style={{fontWeight:700,color:s.color}}>{s.val}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* KEY INSIGHT */}
              {result.predictiveRisk?.top3[0] && (
                <div onClick={()=>setActiveNav("risk")} style={{...card({border:"1px solid "+C.amber+"30",background:C.amberDim}),padding:"1rem",marginBottom:"0.75rem",cursor:"pointer"}}>
                  <div style={{fontSize:"0.58rem",color:C.amber,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.4rem"}}>⚠ KEY RISK</div>
                  <div style={{fontSize:"0.88rem",color:C.text,fontWeight:600,marginBottom:"0.2rem"}}>{result.predictiveRisk.top3[0].name}</div>
                  <div style={{fontSize:"0.8rem",color:C.textMid,lineHeight:1.6}}>{result.predictiveRisk.top3[0].reason}. {result.predictiveRisk.planProb}% probability of missing the deadline without intervention.</div>
                </div>
              )}

              {/* AT A GLANCE STATS */}
              <div style={{...card(),padding:"0.85rem 1rem"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(80px,1fr))",gap:"0.5rem",textAlign:"center"}}>
                  {[
                    {label:"TASKS",val:result.totalTasks,nav:"plan"},
                    {label:"CRITICAL PATH",val:result.criticalPath.length,color:C.red,nav:"plan",tip:"Tasks with zero buffer. If any one of these slips, your deadline moves. Tap to see them."},
                    {label:"TEAM",val:result.teamSize},
                    {label:"BUFFER",val:result.bufferDays>=0?result.bufferDays+"d":"Over",color:result.bufferDays>=0?C.green:C.red,nav:"risk"},
                    {label:"DEPS",val:data.tasks.filter(t=>t.predecessors.length>0).length,nav:"plan"},
                  ].map((s,i)=>(
                    <div key={i} onClick={s.nav?()=>setActiveNav(s.nav):undefined} style={{cursor:s.nav?"pointer":"default"}}>
                      <div style={{fontSize:"0.52rem",color:C.textDim,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.2rem"}}>
                        {s.tip ? <Tooltip text={s.tip}>{s.label} ⓘ</Tooltip> : s.label}
                      </div>
                      <div style={{fontSize:"1rem",fontWeight:700,color:s.color||C.text}}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}


          {/* ══ EXECUTION PLAN ══ */}
          {activeNav==="plan" && (
            <div style={{animation:"fadeUp 0.3s ease both"}}>
              <div style={{marginBottom:"1rem"}}>
                <div style={{fontSize:"1.1rem",fontWeight:700}}>Execution Plan</div>
                <div style={{fontSize:"0.78rem",color:C.textMid,marginTop:"0.15rem"}}>Tap any node to see its detail and cascade chain. Use ⚡ to simulate a delay.</div>
              </div>

              {/* Stat chips */}
              <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",marginBottom:"0.75rem"}}>
                {[
                  {label:"Tasks",val:result.totalTasks},
                  {label:"Critical path",val:result.criticalPath.length+" tasks",color:C.red},
                  {label:"Cascade risk",val:(result.predictiveRisk?.planProb||0)+"%",color:C.amber},
                  {label:"Days recoverable",val:result.shuffleOps.length>0?result.shuffleOps.reduce((a,o)=>a+o.daysSaved,0)+"d free":"None",color:result.shuffleOps.length>0?C.green:C.textDim},
                ].map((s,i)=>(
                  <div key={i} style={{background:C.surface2,border:"1px solid "+C.border,borderRadius:8,padding:"0.4rem 0.75rem"}}>
                    <div style={{fontSize:"0.55rem",color:C.textDim,fontWeight:700,letterSpacing:"0.08em"}}>{s.label}</div>
                    <div style={{fontSize:"0.88rem",fontWeight:700,color:s.color||C.text}}>{s.val}</div>
                  </div>
                ))}
                {simulatorTaskId && (
                  <button onClick={()=>setSimulatorTaskId(null)} style={{background:C.amberDim,border:"1px solid "+C.amber+"40",borderRadius:8,color:C.amber,fontFamily:"inherit",fontSize:"0.72rem",fontWeight:600,padding:"0.4rem 0.75rem",cursor:"pointer",marginLeft:"auto"}}>✕ Clear simulator</button>
                )}
              </div>

              {/* Graph */}
              <div style={{...card(),overflow:"visible",marginBottom:"0.75rem"}}>
                <div className="r-graph-wrap" style={{display:"flex",flexDirection:"row",overflow:"hidden",borderRadius:12}}>
                  <div style={{flex:1,minWidth:0}}>
                    <DependencyGraph
                      tasks={data.tasks} result={result} simulatorTaskId={simulatorTaskId}
                      onNodeClick={(id)=>{
                        setSelectedNodeId(id);
                        if(id!==simulatorTaskId) setSimulatorTaskId(null);
                      }}
                    />
                  </div>
                  {selectedNodeId && (
                    <NodeDetailPanel
                      nodeId={selectedNodeId} tasks={data.tasks} result={result}
                      onClose={()=>setSelectedNodeId(null)}
                      onSimulate={(id)=>{ setSimulatorTaskId(id); setSelectedNodeId(null); }}
                    />
                  )}
                </div>
              </div>

              {/* Cascade simulator */}
              <CascadeSimulator
                tasks={data.tasks} result={result} simulatorTaskId={simulatorTaskId}
                onTaskChange={setSimulatorTaskId}
                startDate={data.startDate} targetDate={data.targetDate} budget={data.budget||(()=>{const s=data.deadlineStakes||"";return s.includes("penalty")||s.includes("Regulatory")?"Fixed":s.includes("Revenue")||s.includes("Client")?"Tight":"Flexible";})()}
              />

              {/* Critical path */}
              <div style={{...card(),padding:"1rem",marginTop:"0.75rem"}}>
                <div style={{fontSize:"0.58rem",color:C.red,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.5rem"}}>CRITICAL PATH — zero float, any slip cascades</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:"0.35rem",alignItems:"center"}}>
                  {result.criticalPath.map((name,i)=>(
                    <span key={i} style={{display:"flex",alignItems:"center",gap:"0.35rem"}}>
                      <span style={{background:C.red+"15",border:"1px solid "+C.red+"35",borderRadius:6,color:C.red,fontSize:"0.72rem",padding:"0.2rem 0.55rem",fontWeight:600}}>{name}</span>
                      {i<result.criticalPath.length-1&&<span style={{color:C.red,opacity:0.4,fontSize:"0.7rem"}}>→</span>}
                    </span>
                  ))}
                </div>
              </div>

              {/* Gantt */}
              <div style={{...card(),padding:"1rem 1.25rem",marginTop:"0.75rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.65rem"}}>
                  <div style={{fontSize:"0.58rem",color:C.textDim,fontWeight:700,letterSpacing:"0.1em"}}>GANTT TIMELINE</div>
                  <div style={{display:"flex",gap:"0.75rem"}}>
                    {[{color:C.red,label:"Critical"},{color:C.green,label:"Concurrent"},{color:C.blue,label:"Sequential"}].map((l,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:"0.3rem",fontSize:"0.68rem",color:C.textMid}}>
                        <div style={{width:12,height:4,background:l.color,borderRadius:2,opacity:0.8}}/>{l.label}
                      </div>
                    ))}
                  </div>
                </div>
                <GanttChart tasks={data.tasks} result={result} startDate={data.startDate}/>
              </div>

              {/* All milestones table */}
              <div style={{...card(),padding:"0",marginTop:"0.75rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0.75rem 1rem",borderBottom:"1px solid "+C.border}}>
                  <div style={{fontSize:"0.58rem",color:C.textDim,fontWeight:700,letterSpacing:"0.1em"}}>ALL MILESTONES</div>
                  <button onClick={()=>{
                    const rows=[["Milestone","Owner","Days","Start","Float","Critical"],...result.tasks.map(t=>[t.name,t.owner||"",t.days,"Day "+(t.es+1),t.slack===0?"No float":t.slack+"d",result.criticalPath.includes(t.name)?"Yes":"No"])];
                    const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n");
                    const b=new Blob([csv],{type:"text/csv"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=(data.name||"pathflo").replace(/\s+/g,"-").toLowerCase()+".csv";a.click();
                  }} style={{background:C.greenDim,border:"1px solid "+C.green+"30",borderRadius:100,color:C.green,fontFamily:"inherit",fontSize:"0.7rem",fontWeight:600,padding:"0.3rem 0.75rem",cursor:"pointer"}}>↓ CSV</button>
                </div>
                {result.tasks.map((t,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 65px 45px",gap:"0.4rem",padding:"0.5rem 0.85rem",borderBottom:i<result.tasks.length-1?"1px solid "+C.border2:"none",alignItems:"center"}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:"0.82rem",color:t.slack===0?C.red:C.text,fontWeight:t.slack===0?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.slack===0?"◆ ":""}{t.name}{t.concurrent&&<span style={{fontSize:"0.62rem",color:C.green,marginLeft:"0.35rem"}}>parallel</span>}</div>
                      <div style={{fontSize:"0.68rem",color:C.textDim,marginTop:"0.1rem"}}>{t.owner==="UNASSIGNED"?"Unassigned":t.owner||"—"}</div>
                    </div>
                    <div style={{fontSize:"0.78rem",color:C.text,textAlign:"right"}}>{t.days}d</div>
                    <span style={{fontSize:"0.62rem",fontFamily:"monospace",borderRadius:4,padding:"0.12rem 0.45rem",background:t.slack===0?C.red+"18":C.green+"12",color:t.slack===0?C.red:C.green,fontWeight:700,display:"inline-block",textAlign:"center"}}>{t.slack===0?"CRIT":"+"+t.slack+"d"}</span>
                  </div>
                ))}
              </div>

            </div>
          )}


          {/* ══ RISK & FIXES ══ */}
          {activeNav==="risk" && (
            <div style={{animation:"fadeUp 0.3s ease both"}}>
              <div style={{marginBottom:"1rem"}}>
                <div style={{fontSize:"1.1rem",fontWeight:700}}>Risk & Fixes</div>
                <div style={{fontSize:"0.78rem",color:C.textMid,marginTop:"0.15rem"}}>Where your plan is most likely to break, and exactly what to do about it.</div>
              </div>

              {/* Overall risk */}
              {result.predictiveRisk && (
                <div style={{...card({border:"1px solid "+result.predictiveRisk.planBand+"40"}),padding:"1.25rem",marginBottom:"0.75rem",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:result.predictiveRisk.planBand}}/>
                  <div style={{display:"flex",alignItems:"baseline",gap:"0.65rem",marginBottom:"0.4rem"}}>
                    <span style={{fontFamily:"Georgia,serif",fontSize:"2.8rem",color:result.predictiveRisk.planBand,lineHeight:1}}>{result.predictiveRisk.planProb}%</span>
                    <span style={{fontSize:"0.85rem",color:C.textMid}}>probability of missing your deadline</span>
                  </div>
                  <div style={{fontSize:"0.8rem",color:C.textMid,lineHeight:1.6}}>{result.confidence.reason}.</div>
                </div>
              )}

              {/* Top bottlenecks */}
              {result.predictiveRisk?.top3.length > 0 && (
                <div style={{...card(),padding:"1rem",marginBottom:"0.75rem"}}>
                  <div style={{fontSize:"0.58rem",color:C.red,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.65rem"}}>TOP BOTTLENECKS</div>
                  {result.predictiveRisk.top3.map((m,i)=>{
                    const mc=m.prob>=75?C.red:m.prob>=55?C.amber:C.green;
                    return(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.6rem 0",borderBottom:i<result.predictiveRisk.top3.length-1?"1px solid "+C.border2:"none"}}>
                        <div style={{width:36,height:36,borderRadius:"50%",background:mc+"18",border:"1px solid "+mc+"40",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",fontWeight:700,color:mc,flexShrink:0}}>{m.prob}%</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:"0.85rem",fontWeight:600,color:C.text}}>{m.name}</div>
                          <div style={{fontSize:"0.72rem",color:C.textDim}}>{m.owner} · {m.slack===0?"zero float":m.slack+"d float"} · {m.dependents} downstream</div>
                          <div style={{fontSize:"0.78rem",color:C.textMid,marginTop:"0.15rem"}}>{m.reason}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Optimization opportunities */}
              {result.shuffleOps.length > 0 && (
                <div style={{...card({border:"1px solid "+C.green+"25"}),padding:"1rem",marginBottom:"0.75rem"}}>
                  <div style={{fontSize:"0.58rem",color:C.green,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.65rem"}}>◈ SCHEDULING FIXES — zero cost, immediate impact</div>
                  {result.shuffleOps.map((op,i)=>(
                    <div key={i} style={{display:"flex",gap:"0.75rem",alignItems:"flex-start",padding:"0.6rem 0",borderBottom:i<result.shuffleOps.length-1?"1px solid "+C.border2:"none"}}>
                      <div style={{background:C.green+"20",border:"1px solid "+C.green+"40",borderRadius:"50%",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.75rem",fontWeight:700,color:C.green,flexShrink:0}}>{i+1}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:"0.85rem",fontWeight:600,color:C.text,marginBottom:"0.2rem"}}>{op.reason}</div>
                        <div style={{fontSize:"0.72rem",color:C.green,fontWeight:600}}>Recovers ~{op.daysSaved} days at zero additional cost</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Intelligence pillars */}
              {(() => {
                const buf = result.bufferDays;
                const tScore = buf>=14?88:buf>=7?75:buf>=3?60:buf>=0?40:buf>=-3?20:8;
                const ownerConc = result.confidence.breakdown.find(f=>f.name==="Owner concentration")?.score||50;
                const scopeCap = result.confidence.breakdown.find(f=>f.name==="Scope vs capacity")?.score||50;
                const rScore = result.teamSize<=1?Math.round(ownerConc*0.3+scopeCap*0.7):Math.round((ownerConc+scopeCap)/2);
                const sScore = result.confidence.breakdown.find(f=>f.name==="Plan sequencing")?.score||50;
                const oScore = result.confidence.breakdown.find(f=>f.name==="Optimization gaps")?.score||50;
                const opScore = Math.round((sScore+oScore)/2);

                const pillars = [
                  { n:"01", title:"Will it finish on time?", tip:"Based on how many buffer days are between your critical path and your deadline. More buffer = more room to absorb slips.", color:C.blue, score:tScore,
                    answer: buf>=7?`${buf} days of buffer on the critical path. Schedule has breathing room.`:buf>=3?`Only ${buf} days of buffer. One slip and the deadline moves.`:buf>=0?`Dangerously thin — ${buf} day${buf!==1?"s":""} of buffer remaining.`:`${Math.abs(buf)} days past your deadline. Plan needs compression.`,
                    fix: result.shuffleOps[0]?`Run "${result.shuffleOps[0].task}" in parallel with "${result.shuffleOps[0].sharedPredecessor||result.shuffleOps[0].predecessor}" — recovers ~${result.shuffleOps[0].daysSaved}d`:"Protect critical path from scope additions." },
                  { n:"02", title:"Can your team handle this?", tip:"Based on how ownership is distributed across critical tasks. If one person owns most of the critical work, that's a single point of failure.", color:C.purple, score:rScore,
                    answer: result.teamSize<=1?`Solo project — you own all ${result.totalTasks} tasks. Time-box critical path tasks and build in personal buffer.`:rScore>=70?`Work is distributed across ${result.teamSize} people. No single point of failure.`:rScore>=45?`Some team members carry multiple critical tasks. If they fall behind, it delays everything after them.`:`High concentration risk. One or two people own most of the critical work.`,
                    fix: result.teamSize<=1?`${result.criticalPath.length} tasks on the critical path. Build a 10–15% personal buffer on each.`:`Confirm each critical path owner has the capacity to deliver on schedule.` },
                  { n:"03", title:"Is the plan efficient?", tip:"Based on whether tasks that could run in parallel are currently running back-to-back. Inefficiency here = free days left on the table.", color:C.green, score:opScore,
                    answer: result.shuffleOps.length>0?`${result.shuffleOps.length} task${result.shuffleOps.length!==1?"s":""} running back-to-back that could run at the same time. That's ${result.shuffleOps.reduce((a,o)=>a+o.daysSaved,0)} days left on the table.`:`Plan is well-sequenced. No obvious scheduling improvements found.`,
                    fix: result.shuffleOps.length>0?result.shuffleOps[0].reason:"Monitor for scope creep on critical path tasks." },
                ];

                return (
                  <div style={{display:"flex",flexDirection:"column",gap:"0.65rem",marginBottom:"0.75rem"}}>
                    {pillars.map((p,i)=>{
                      const bc=p.score>=70?C.green:p.score>=45?C.amber:C.red;
                      const rating=p.score>=70?"Good":p.score>=45?"At Risk":"Critical";
                      return(
                        <div key={i} style={{...card(),padding:"1rem",borderLeft:"3px solid "+p.color}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.5rem"}}>
                            <div style={{fontSize:"0.88rem",fontWeight:700,color:C.text}}>
                            <Tooltip text={p.tip||p.title}>{p.title} ⓘ</Tooltip>
                          </div>
                            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flexShrink:0}}>
                              <span style={{fontFamily:"Georgia,serif",fontSize:"1.4rem",color:bc}}>{p.score}</span>
                              <span style={{fontSize:"0.62rem",fontWeight:700,padding:"0.18rem 0.55rem",borderRadius:100,background:bc+"20",color:bc,border:"1px solid "+bc+"40"}}>{rating}</span>
                            </div>
                          </div>
                          <div style={{height:4,background:C.border2,borderRadius:2,marginBottom:"0.55rem"}}>
                            <div style={{height:"100%",width:p.score+"%",background:bc,borderRadius:2,transition:"width 0.8s ease"}}/>
                          </div>
                          <div style={{fontSize:"0.8rem",color:C.textMid,lineHeight:1.65,marginBottom:"0.5rem"}}>{p.answer}</div>
                          <div style={{fontSize:"0.75rem",color:p.color,fontWeight:600}}>→ {p.fix}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

            </div>
          )}



          {/* ══ WORKLOAD INTELLIGENCE (P1-3) ══ */}
          {activeNav==="workload" && workloadData && (
            <div style={{animation:"fadeUp 0.3s ease both"}}>
              <div style={{marginBottom:"1rem"}}>
                <div style={{fontSize:"1.1rem",fontWeight:700}}>Workload Intelligence</div>
                <div style={{fontSize:"0.78rem",color:C.textMid,marginTop:"0.15rem"}}>Who's carrying the most risk — and where a single person getting stuck would stall everything.</div>
              </div>

              {/* Concentration risk alert */}
              {workloadData.concentrationRisk && (
                <div style={{...card({border:"1px solid "+C.red+"40",background:C.redDim}),padding:"1rem",marginBottom:"0.75rem"}}>
                  <div style={{fontSize:"0.58rem",color:C.red,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.4rem"}}>⚠ SINGLE POINT OF FAILURE</div>
                  <div style={{fontSize:"0.88rem",color:C.text,fontWeight:600,marginBottom:"0.2rem"}}>{workloadData.concentrationRisk.name} owns {workloadData.concentrationRisk.criticalTasks.length} of {workloadData.totalCritical} critical path tasks</div>
                  <div style={{fontSize:"0.78rem",color:C.textMid,lineHeight:1.6}}>If they get stuck, blocked, or unavailable — everything waiting on them stops. That's {workloadData.concentrationRisk.criticalDays} days of critical work on one person.</div>
                  <div style={{marginTop:"0.6rem",fontSize:"0.75rem",color:C.green,fontWeight:600}}>→ Review whether any of their critical tasks can be redistributed or started earlier by someone else.</div>
                </div>
              )}

              {/* Approval bottlenecks */}
              {workloadData.bottlenecks.length > 0 && (
                <div style={{...card(),padding:"1rem",marginBottom:"0.75rem"}}>
                  <div style={{fontSize:"0.58rem",color:C.amber,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.6rem"}}>APPROVAL BOTTLENECKS — tasks that gate the most work</div>
                  {workloadData.bottlenecks.map((b,i) => (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.6rem 0",borderBottom:i<workloadData.bottlenecks.length-1?"1px solid "+C.border2:"none"}}>
                      <div style={{width:38,height:38,borderRadius:"50%",background:C.amber+"18",border:"1px solid "+C.amber+"40",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.75rem",fontWeight:700,color:C.amber,flexShrink:0}}>{b.dependents}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:"0.85rem",fontWeight:600,color:C.text}}>{b.name}</div>
                        <div style={{fontSize:"0.72rem",color:C.textDim}}>{b.owner} · {b.dependents} tasks waiting on this · zero float</div>
                        <div style={{fontSize:"0.75rem",color:C.amber,marginTop:"0.15rem"}}>This task gates {b.dependents} others — prioritize it</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Owner workload breakdown */}
              <div style={{...card(),padding:"1rem",marginBottom:"0.75rem"}}>
                <div style={{fontSize:"0.58rem",color:C.textDim,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.75rem"}}>WORKLOAD BY OWNER</div>
                {workloadData.owners.map((owner, i) => {
                  const loadPct = Math.round(owner.totalDays / workloadData.maxDays * 100);
                  const critPct = Math.round(owner.criticalDays / workloadData.maxDays * 100);
                  const isOverloaded = owner.criticalTasks.length >= 3 || loadPct > 70;
                  const ownerColor = isOverloaded ? C.red : owner.criticalTasks.length >= 2 ? C.amber : C.green;
                  return (
                    <div key={i} style={{marginBottom:"0.85rem"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.3rem"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                          <div style={{width:28,height:28,borderRadius:"50%",background:ownerColor+"18",border:"1px solid "+ownerColor+"40",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.75rem",fontWeight:700,color:ownerColor,flexShrink:0}}>
                            {owner.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{fontSize:"0.85rem",fontWeight:600,color:C.text}}>{owner.name}</div>
                            <div style={{fontSize:"0.68rem",color:C.textDim}}>{owner.tasks.length} milestone{owner.tasks.length!==1?"s":""} · {owner.totalDays} days total</div>
                          </div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          {isOverloaded && <div style={{fontSize:"0.6rem",color:C.red,fontWeight:700,background:C.red+"15",borderRadius:4,padding:"0.1rem 0.4rem",marginBottom:"0.15rem"}}>HIGH LOAD</div>}
                          <div style={{fontSize:"0.72rem",color:owner.criticalTasks.length>0?C.red:C.textDim}}>{owner.criticalTasks.length} critical</div>
                        </div>
                      </div>
                      {/* Workload bar */}
                      <div style={{height:6,background:C.border2,borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",display:"flex"}}>
                          <div style={{width:critPct+"%",background:C.red,borderRadius:"3px 0 0 3px",transition:"width 0.8s ease"}}/>
                          <div style={{width:Math.max(0,loadPct-critPct)+"%",background:C.blue+"80",transition:"width 0.8s ease"}}/>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:"0.75rem",marginTop:"0.25rem",fontSize:"0.62rem",color:C.textDim}}>
                        {owner.criticalTasks.length>0&&<span style={{color:C.red}}>◆ Critical: {owner.criticalTasks.slice(0,2).join(", ")}{owner.criticalTasks.length>2?` +${owner.criticalTasks.length-2} more`:""}</span>}
                        {owner.tasks.filter(t=>!t.isCritical).length>0&&<span>Also: {owner.tasks.filter(t=>!t.isCritical).length} non-critical</span>}
                      </div>
                    </div>
                  );
                })}
                <div style={{display:"flex",gap:"0.75rem",marginTop:"0.25rem",flexWrap:"wrap"}}>
                  {[{color:C.red,label:"Critical path tasks"},{color:C.blue+"80",label:"Non-critical tasks"}].map((l,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:"0.3rem",fontSize:"0.68rem",color:C.textMid}}>
                      <div style={{width:10,height:4,background:l.color,borderRadius:2}}/>{l.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sequential overload warnings */}
              {workloadData.sequentialRisk.length > 0 && (
                <div style={{...card({border:"1px solid "+C.amber+"30"}),padding:"1rem"}}>
                  <div style={{fontSize:"0.58rem",color:C.amber,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.5rem"}}>SEQUENTIAL OVERLOAD</div>
                  {workloadData.sequentialRisk.map((o,i)=>(
                    <div key={i} style={{fontSize:"0.82rem",color:C.textMid,lineHeight:1.65,marginBottom:"0.4rem"}}>
                      <strong style={{color:C.text}}>{o.name}</strong> has {o.criticalTasks.length} critical tasks in sequence: {o.criticalTasks.join(" → ")}. If they fall behind on the first, everything after moves too.
                    </div>
                  ))}
                  <div style={{fontSize:"0.75rem",color:C.amber,fontWeight:600,marginTop:"0.4rem"}}>→ Build explicit check-ins at each handoff point for these owners.</div>
                </div>
              )}

              {/* Team health summary */}
              {!workloadData.concentrationRisk && workloadData.bottlenecks.length === 0 && workloadData.sequentialRisk.length === 0 && (
                <div style={{...card({border:"1px solid "+C.green+"30",background:C.greenDim}),padding:"1rem"}}>
                  <div style={{fontSize:"0.88rem",fontWeight:600,color:C.green,marginBottom:"0.3rem"}}>✓ Team workload looks balanced</div>
                  <div style={{fontSize:"0.8rem",color:C.textMid,lineHeight:1.65}}>No single person is carrying an outsized share of the critical work. No approval bottlenecks detected.</div>
                </div>
              )}
            </div>
          )}


          {/* ══ AI READOUT (P1-4) ══ */}
          {activeNav==="readout" && (
            <div style={{animation:"fadeUp 0.3s ease both"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1rem",flexWrap:"wrap",gap:"0.5rem"}}>
                <div>
                  <div style={{fontSize:"1.1rem",fontWeight:700}}>AI Readout</div>
                  <div style={{fontSize:"0.78rem",color:C.textMid,marginTop:"0.15rem"}}>Ready to forward. Copy and send — no editing needed.</div>
                </div>
                <div style={{display:"flex",gap:"0.4rem"}}>
                  <button onClick={()=>{
                    const sep="\n";
                    const lines=[
                      "PATHFLO EXECUTION REPORT — "+data.name,
                      "Generated "+new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}),
                      "",
                      "━━━ VERDICT ━━━",
                      result.verdict+" · "+confScore+"% on-time confidence",
                      "Projected completion: "+result.projectedDate,
                      "Buffer: "+(result.bufferDays>=0?result.bufferDays+" days":Math.abs(result.bufferDays)+" days over deadline"),
                      ...(hasRealOptimization?["With fixes applied: "+confScoreOptimized+"% confidence"]:[]),
                      "",
                      "━━━ CRITICAL PATH ━━━",
                      result.criticalPath.join(" → "),
                      result.criticalPath.length+" tasks · zero float on each",
                      "",
                      "━━━ BIGGEST RISK ━━━",
                      result.predictiveRisk?.top3[0]?(result.predictiveRisk.top3[0].name+" — "+result.predictiveRisk.top3[0].reason):"See dependency graph",
                      (result.predictiveRisk?.planProb||0)+"% probability of missing deadline without changes",
                      "",
                      "━━━ TOP RECOMMENDATION ━━━",
                      result.shuffleOps[0]?("Run "+result.shuffleOps[0].task+" in parallel — recovers ~"+result.shuffleOps[0].daysSaved+"d at zero cost"):"Validate critical path owner availability",
                      "",
                      "━━━ TEAM ━━━",
                      result.teamSize+" team member"+(result.teamSize!==1?"s":"")+" · "+result.criticalPath.length+" tasks on critical path",
                      workloadData?.concentrationRisk?("⚠ "+workloadData.concentrationRisk.name+" owns "+workloadData.concentrationRisk.criticalTasks.length+"/"+workloadData.totalCritical+" critical tasks"):"Workload appears balanced",
                      "",
                      "Powered by Pathflo · pathflo.ai",
                    ].join(sep);
                    navigator.clipboard.writeText(lines).then(()=>{});
                  }} style={{background:C.greenDim,border:"1px solid "+C.green+"30",borderRadius:8,color:C.green,fontFamily:"inherit",fontWeight:600,fontSize:"0.72rem",padding:"0.4rem 0.85rem",cursor:"pointer"}}>📋 Copy full report</button>
                </div>
              </div>

              {/* Shareable card — visual report */}
              <div style={{...card({border:"1px solid "+verdColor+"40"}),padding:"1.25rem",marginBottom:"0.75rem",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${verdColor},${C.green})`}}/>

                {/* Header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1rem",flexWrap:"wrap",gap:"0.5rem"}}>
                  <div>
                    <div style={{fontSize:"0.62rem",color:C.textDim,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.2rem"}}>PATHFLO EXECUTION REPORT</div>
                    <div style={{fontSize:"1rem",fontWeight:700,color:C.text}}>{data.name}</div>
                    <div style={{fontSize:"0.72rem",color:C.textMid,marginTop:"0.1rem"}}>{new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
                  </div>
                  <div style={{background:verdColor+"20",color:verdColor,fontSize:"0.78rem",fontWeight:700,padding:"0.3rem 0.85rem",borderRadius:100,border:"1px solid "+verdColor+"40",whiteSpace:"nowrap"}}>{result.verdict}</div>
                </div>

                {/* Confidence */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:"0.65rem",marginBottom:"1rem"}}>
                  {[
                    {label:"Confidence",val:confScore+"%",color:verdColor,sub:"current plan"},
                    ...(hasRealOptimization?[{label:"Confidence (optimized)",val:confScoreOptimized+"%",color:C.green,sub:"with fixes applied"}]:[]),
                    {label:"Projected finish",val:result.projectedRange,color:C.text,sub:result.bufferDays>=0?result.bufferDays+"d buffer":Math.abs(result.bufferDays)+"d over"},
                    {label:"Failure probability",val:(result.predictiveRisk?.planProb||0)+"%",color:result.predictiveRisk?.planBand||C.amber,sub:"without intervention"},
                  ].map((s,i)=>(
                    <div key={i} style={{background:C.surface2,borderRadius:8,padding:"0.65rem 0.75rem"}}>
                      <div style={{fontSize:"0.55rem",color:C.textDim,fontWeight:700,marginBottom:"0.2rem"}}>{s.label.toUpperCase()}</div>
                      <div style={{fontSize:"1rem",fontWeight:700,color:s.color,lineHeight:1}}>{s.val}</div>
                      <div style={{fontSize:"0.62rem",color:C.textDim,marginTop:"0.2rem"}}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Critical path */}
                <div style={{marginBottom:"0.85rem"}}>
                  <div style={{fontSize:"0.58rem",color:C.red,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.4rem"}}>CRITICAL PATH</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"0.3rem",alignItems:"center"}}>
                    {result.criticalPath.map((name,i)=>(
                      <span key={i} style={{display:"flex",alignItems:"center",gap:"0.3rem"}}>
                        <span style={{background:C.red+"12",border:"1px solid "+C.red+"30",borderRadius:5,color:C.red,fontSize:"0.72rem",padding:"0.18rem 0.5rem",fontWeight:600}}>{name}</span>
                        {i<result.criticalPath.length-1&&<span style={{color:C.red,opacity:0.35,fontSize:"0.65rem"}}>→</span>}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Biggest risk + fix */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.65rem",marginBottom:"0.85rem"}}>
                  <div style={{background:C.redDim,border:"1px solid "+C.red+"25",borderRadius:8,padding:"0.75rem"}}>
                    <div style={{fontSize:"0.55rem",color:C.red,fontWeight:700,letterSpacing:"0.08em",marginBottom:"0.3rem"}}>BIGGEST RISK</div>
                    <div style={{fontSize:"0.82rem",fontWeight:600,color:C.text,marginBottom:"0.2rem"}}>{result.predictiveRisk?.top3[0]?.name||result.bottleneck?.name||"—"}</div>
                    <div style={{fontSize:"0.72rem",color:C.textMid,lineHeight:1.5}}>{result.predictiveRisk?.top3[0]?.reason||result.bottleneck?.reason||""}</div>
                  </div>
                  <div style={{background:C.greenDim,border:"1px solid "+C.green+"25",borderRadius:8,padding:"0.75rem"}}>
                    <div style={{fontSize:"0.55rem",color:C.green,fontWeight:700,letterSpacing:"0.08em",marginBottom:"0.3rem"}}>RECOMMENDED FIX</div>
                    <div style={{fontSize:"0.82rem",color:C.text,lineHeight:1.5}}>
                      {result.shuffleOps[0]
                        ? `Run "${result.shuffleOps[0].task}" in parallel with "${result.shuffleOps[0].sharedPredecessor||result.shuffleOps[0].predecessor}" — saves ~${result.shuffleOps[0].daysSaved}d`
                        : "Validate critical path owner availability before work begins"}
                    </div>
                  </div>
                </div>

                {/* Workload snapshot */}
                {workloadData && (
                  <div style={{marginBottom:"0.85rem"}}>
                    <div style={{fontSize:"0.58rem",color:C.textDim,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.5rem"}}>TEAM WORKLOAD</div>
                    <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
                      {workloadData.owners.slice(0,4).map((o,i)=>{
                        const pct = Math.round(o.criticalDays / Math.max(workloadData.maxDays,1) * 100);
                        const color = o.criticalTasks.length>=3?C.red:o.criticalTasks.length>=2?C.amber:C.green;
                        return(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                            <div style={{width:22,height:22,borderRadius:"50%",background:color+"18",border:"1px solid "+color+"40",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.65rem",fontWeight:700,color,flexShrink:0}}>{o.name.charAt(0)}</div>
                            <div style={{fontSize:"0.78rem",color:C.textMid,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.name}</div>
                            <div style={{width:80,height:5,background:C.border2,borderRadius:3,flexShrink:0}}>
                              <div style={{height:"100%",width:pct+"%",background:color,borderRadius:3}}/>
                            </div>
                            <div style={{fontSize:"0.68rem",color,flexShrink:0,minWidth:24,textAlign:"right"}}>{o.criticalTasks.length}✦</div>
                          </div>
                        );
                      })}
                    </div>
                    {workloadData.concentrationRisk&&<div style={{fontSize:"0.72rem",color:C.red,marginTop:"0.4rem",fontWeight:600}}>⚠ {workloadData.concentrationRisk.name} is a single point of failure</div>}
                  </div>
                )}

                {/* Footer */}
                <div style={{borderTop:"1px solid "+C.border,paddingTop:"0.65rem",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"0.4rem"}}>
                  <div style={{fontSize:"0.65rem",color:C.textDim}}>Generated by Pathflo · pathflo.ai · Operational execution intelligence</div>
                  <div style={{fontSize:"0.65rem",color:C.textDim}}>{new Date().toLocaleDateString()}</div>
                </div>
              </div>

              {/* AI narrative */}
              <div style={{...card(),padding:"1.25rem",marginBottom:"0.75rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem"}}>
                  <span style={{color:C.green}}>✦</span>
                  <span style={{fontSize:"0.58rem",color:C.green,fontWeight:700,letterSpacing:"0.1em"}}>EXECUTIVE NARRATIVE</span>
                  <span style={{fontSize:"0.65rem",color:C.textDim,marginLeft:"auto"}}>Copy and paste into email or Slack</span>
                </div>
                {aiLoading?(
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",color:C.textMid,fontSize:"0.82rem"}}>
                    <span>Writing</span>{[0,1,2].map(i=><span key={i} style={{width:4,height:4,background:C.green,borderRadius:"50%",display:"inline-block",animation:`dotBlink 1.4s ${i*0.22}s infinite`}}/>)}
                  </div>
                ):aiReadout?(
                  <p style={{fontSize:"0.9rem",color:C.text,lineHeight:1.85,fontFamily:"Georgia,serif"}}>{aiReadout}</p>
                ):(
                  <p style={{fontSize:"0.88rem",color:C.textMid,lineHeight:1.8}}>
                    {data.name} has a <strong style={{color:verdColor}}>{confScore}% chance of delivering on time</strong> as currently planned. {result.confidence.reason}. The critical path runs through {result.criticalPath.length} tasks — {result.criticalPath.slice(0,3).join(", ")}{result.criticalPath.length>3?`, and ${result.criticalPath.length-3} more`:""} — with {result.bufferDays>=0?result.bufferDays+" days of buffer":Math.abs(result.bufferDays)+" days of overrun"}.
                    {result.shuffleOps.length>0&&` ${result.shuffleOps.length} scheduling optimization${result.shuffleOps.length>1?"s are":" is"} available: running "${result.shuffleOps[0].task}" in parallel with "${result.shuffleOps[0].sharedPredecessor||result.shuffleOps[0].predecessor}" recovers approximately ${result.shuffleOps[0].daysSaved} days at zero additional cost.`}
                    {hasRealOptimization&&` With recommended changes applied, on-time confidence rises to ${confScoreOptimized}% — a +${confScoreOptimized-confScore} point improvement.`}
                    <span style={{display:"block",marginTop:"0.75rem",fontSize:"0.7rem",color:C.textDim,fontStyle:"italic"}}>Add your Anthropic API key to Vercel for a fully AI-generated narrative.</span>
                  </p>
                )}
              </div>

              {/* ── Stakeholder Adapter (Solo+) ── */}
              {stakeholderVersions ? (
                <div style={{...card({border:"1px solid #7C3AED40"}),padding:"1.25rem",marginBottom:"0.75rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.85rem"}}>
                    <span style={{color:"#A78BFA"}}>◈</span>
                    <span style={{fontSize:"0.58rem",color:"#A78BFA",fontWeight:700,letterSpacing:"0.1em"}}>STAKEHOLDER ADAPTER — SOLO</span>
                    <span style={{fontSize:"0.6rem",color:C.textDim,marginLeft:"auto"}}>Three versions, ready to send</span>
                  </div>
                  <div style={{display:"flex",gap:"0.5rem",marginBottom:"0.85rem"}}>
                    {["client","team","exec"].map(t=>(
                      <button key={t} onClick={()=>setStakeholderTab(t)} style={{
                        background:stakeholderTab===t?"#7C3AED":"transparent",
                        border:"1px solid "+(stakeholderTab===t?"#7C3AED":"#30363D"),
                        borderRadius:6, color:stakeholderTab===t?"#fff":C.textMid,
                        fontFamily:"inherit",fontWeight:600,fontSize:"0.7rem",
                        padding:"0.3rem 0.75rem",cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.05em",
                      }}>{t==="client"?"Client":t==="team"?"Team":"Exec"}</button>
                    ))}
                  </div>
                  <p style={{fontSize:"0.88rem",color:C.text,lineHeight:1.85,fontFamily:"Georgia,serif",whiteSpace:"pre-wrap"}}>
                    {stakeholderVersions[stakeholderTab]}
                  </p>
                </div>
              ) : (
                <div style={{...card({border:"1px solid #7C3AED30",background:"#0D0A1A"}),padding:"1.25rem",marginBottom:"0.75rem",textAlign:"center"}}>
                  <div style={{fontSize:"1.25rem",marginBottom:"0.5rem"}}>◈</div>
                  <div style={{fontSize:"0.78rem",fontWeight:700,color:"#A78BFA",marginBottom:"0.35rem"}}>Stakeholder Adapter — Solo Plan</div>
                  <div style={{fontSize:"0.8rem",color:C.textMid,lineHeight:1.7,marginBottom:"0.85rem"}}>
                    Turn this report into three ready-to-send messages — one for your client, one for your team, one for leadership. Zero rewriting.
                  </div>
                  <a href="/#pricing" style={{display:"inline-block",background:"#7C3AED",color:"#fff",borderRadius:8,padding:"0.5rem 1.25rem",fontFamily:"inherit",fontWeight:600,fontSize:"0.8rem",textDecoration:"none"}}>Upgrade to Solo →</a>
                </div>
              )}

              {/* ── Deadline Reverse-Engineer (Team+) ── */}
              {deadlineReversal ? (
                <div style={{...card({border:"1px solid "+C.amber+"40"}),padding:"1.25rem",marginBottom:"0.75rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.85rem"}}>
                    <span style={{color:C.amber}}>⟵</span>
                    <span style={{fontSize:"0.58rem",color:C.amber,fontWeight:700,letterSpacing:"0.1em"}}>DEADLINE REVERSE-ENGINEER — TEAM</span>
                  </div>
                  <p style={{fontSize:"0.88rem",color:C.text,lineHeight:1.85,fontFamily:"Georgia,serif",whiteSpace:"pre-wrap"}}>{deadlineReversal}</p>
                </div>
              ) : (
                <div style={{...card({border:"1px solid "+C.amber+"20",background:"#12100A"}),padding:"1.25rem",marginBottom:"0.75rem",textAlign:"center"}}>
                  <div style={{fontSize:"1.25rem",marginBottom:"0.5rem"}}>⟵</div>
                  <div style={{fontSize:"0.78rem",fontWeight:700,color:C.amber,marginBottom:"0.35rem"}}>Deadline Reverse-Engineer — Team Plan</div>
                  <div style={{fontSize:"0.8rem",color:C.textMid,lineHeight:1.7,marginBottom:"0.85rem"}}>
                    The deadline is fixed. This agent works backwards and gives you three concrete options — cut scope, compress timeline, or add resource — ranked by what's most realistic.
                  </div>
                  <a href="/#pricing" style={{display:"inline-block",background:C.amber,color:"#080A08",borderRadius:8,padding:"0.5rem 1.25rem",fontFamily:"inherit",fontWeight:600,fontSize:"0.8rem",textDecoration:"none"}}>Upgrade to Team →</a>
                </div>
              )}

              {/* Key bullets — for quick copy */}
              <div style={{...card(),padding:"1.25rem"}}>
                <div style={{fontSize:"0.58rem",color:C.green,fontWeight:700,letterSpacing:"0.1em",marginBottom:"0.75rem"}}>KEY TAKEAWAYS — quick copy</div>
                <div style={{display:"flex",flexDirection:"column",gap:"0.55rem"}}>
                  {[
                    {icon:"◈",text:`**${data.name}** — ${result.verdict}. On-time confidence: **${confScore}%**`+(hasRealOptimization?` → **${confScoreOptimized}%** with fixes.`:"."),color:verdColor},
                    {icon:"⚠",text:`Critical path: **${result.criticalPath.length} tasks**${result.criticalPath.length>0?" — "+result.criticalPath.slice(0,2).join(", ")+(result.criticalPath.length>2?"...":""):""}. Buffer: **${result.bufferDays>=0?result.bufferDays+"d":"OVERRUN "+Math.abs(result.bufferDays)+"d"}**.`,color:result.bufferDays>=0?C.amber:C.red},
                    {icon:"⚡",text:`Highest risk: **${result.predictiveRisk?.top3[0]?.name||"—"}** — ${result.predictiveRisk?.top3[0]?.reason||""}. **${result.predictiveRisk?.planProb||0}%** chance of missing deadline.`,color:C.red},
                    ...(result.shuffleOps.length>0?[{icon:"✓",text:`Fix: Run **"${result.shuffleOps[0].task}"** in parallel — recovers **~${result.shuffleOps.reduce((a,o)=>a+o.daysSaved,0)} days at zero cost**.`,color:C.green}]:[]),
                    {icon:"→",text:`Delivery window: **${result.projectedRange}**.`,color:C.textMid},
                  ].map((b,i)=>(
                    <div key={i} style={{display:"flex",gap:"0.65rem",alignItems:"flex-start"}}>
                      <span style={{color:b.color,fontWeight:700,fontSize:"0.85rem",flexShrink:0,marginTop:"0.1rem"}}>{b.icon}</span>
                      <div style={{fontSize:"0.84rem",color:C.textMid,lineHeight:1.65}}>
                        {b.text.split(/(\*\*[^*]+\*\*)/).map((p,j)=>
                          p.startsWith("**")?<strong key={j} style={{color:C.text}}>{p.slice(2,-2)}</strong>:p
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}



        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <style>{`@media(max-width:768px){.bnav{display:flex!important;} .r-nav{display:none!important;} .r-main{padding:0.75rem!important;padding-bottom:72px!important;}}`}</style>
      <div className="bnav" style={{ display: "none", position: "fixed", bottom: 0, left: 0, right: 0, background: C.surface, borderTop: "1px solid " + C.border, zIndex: 250, height: 56, alignItems: "center", justifyContent: "space-around", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {navItems.map(n => (
          <button key={n.id} onClick={() => setActiveNav(n.id)} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", cursor: "pointer", padding: "0.4rem 0", color: activeNav === n.id ? C.green : C.textDim, fontFamily: "inherit" }}>
            <span style={{ fontSize: "1rem" }}>{n.icon}</span>
            <span style={{ fontSize: "0.55rem", fontWeight: activeNav === n.id ? 700 : 400, letterSpacing: "0.04em" }}>{n.label.split(" ")[0]}</span>
          </button>
        ))}
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
