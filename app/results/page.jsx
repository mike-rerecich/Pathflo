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
  const concOps = [];
  tasks.forEach(t => {
    if (!t.concurrent && t.predecessors.length && byId[t.id].slack===0) {
      const pred = tasks.find(p=>p.id===t.predecessors[0]);
      if (pred) concOps.push({ task: t.name, predecessor: pred.name, daysSaved: Math.floor((parseInt(t.days)||1)*0.5), reason: `"${t.name}" can start while "${pred.name}" is finishing.` });
    }
  });
  const shuffleOps = concOps.slice(0,3);
  const confidence = computeConfidence(tasks, availableDays, projectDuration, budget||"Flexible", bufferDays, shuffleOps, byId);
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
    availableDays, criticalPath, shuffleOps, confidence, predictiveRisk,
    delayRisk, bottleneckSeverity, totalTasks, teamSize: ownersSet.size,
    bottleneck, startDate,
  };
}

// ── DEPENDENCY GRAPH — P1-1 INTERACTIVE ──────────────────────────────────────
function DependencyGraph({ tasks, result, onNodeClick }) {
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
        positions[t.id] = { x, y: startY + i * (nodeH + 16), w: nodeW, h: nodeH };
      });
    });
    return positions;
  }, [tasks]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result || !tasks.length) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement.clientWidth || 700;
    const H = 380;
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
      if (isSelected) {
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
      ctx.fillText(`${t.days}d · ${t.owner || "?"}`.slice(0, 18), pos.x + 8, pos.y + 30);

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
      { color: C.red, label: "Critical / Zero Float" },
      { color: C.green, label: "On Track" },
      { color: C.amber, label: "Bottleneck" },
      { color: C.blue, label: "Upstream" },
      { color: C.purple, label: "Selected" },
    ];
    legend.forEach((l, i) => {
      const lx = 20 + i * 120, ly = H - 18;
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
    <div style={{ overflowX: "auto" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
    </div>
  );
}

// ── NODE DETAIL PANEL (P1-1) ──────────────────────────────────────────────────
function NodeDetailPanel({ nodeId, tasks, result, onClose }) {
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
      width: 280, flexShrink: 0,
      background: C.surface,
      borderLeft: "1px solid " + C.border,
      display: "flex", flexDirection: "column",
      animation: "slideIn 0.2s ease both",
      overflowY: "auto",
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
    ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#30363D;border-radius:2px}
  `;

  const card = (extra={}) => ({background:C.surface,border:"1px solid "+C.border,borderRadius:12,...extra});
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
        />
      )}
    </div>
  );

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"Inter,system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{style}</style>

      {/* ── TOP BAR ── */}
      <div style={{background:C.surface,borderBottom:"1px solid "+C.border,height:52,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 1.25rem",position:"sticky",top:0,zIndex:200,gap:"1rem",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.75rem"}}>
          <button onClick={()=>setNavCollapsed(v=>!v)} style={{background:"transparent",border:"none",color:C.textMid,cursor:"pointer",fontSize:"1rem",padding:"0.25rem"}}>☰</button>
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <path d="M4 24 C8 24 10 14 15 14 C20 14 22 6 26 6 C29 6 30 12 31 14" stroke={C.purple} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <circle cx="4" cy="24" r="3" fill={C.purple}/>
            <circle cx="15" cy="14" r="2.5" fill={C.purple} opacity="0.7"/>
            <circle cx="26" cy="6" r="2.5" fill={C.purple} opacity="0.5"/>
            <circle cx="31" cy="14" r="2.5" fill={C.purple} opacity="0.9"/>
          </svg>
          <span style={{fontWeight:700,color:C.text,fontSize:"0.9rem"}}>Path<span style={{color:C.purple}}>flo</span></span>
          <span style={{color:C.border,fontSize:"1rem"}}>|</span>
          <span style={{color:C.textMid,fontSize:"0.85rem",maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{data.name}</span>
          <span style={{background:verdColor+"20",color:verdColor,fontSize:"0.62rem",fontWeight:700,letterSpacing:"0.08em",padding:"0.2rem 0.6rem",borderRadius:100,border:"1px solid "+verdColor+"40",flexShrink:0}}>{result.verdict}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"0.75rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.4rem",fontSize:"0.78rem",color:C.textMid}}>
            <span style={{color:verdColor,fontWeight:700,fontSize:"1rem"}}>{confScore}%</span>
            <span>Confidence</span>
          </div>
          <a href="/" style={{background:C.purple,color:"#fff",border:"none",borderRadius:8,fontFamily:"inherit",fontWeight:600,fontSize:"0.8rem",padding:"0.45rem 1rem",cursor:"pointer",textDecoration:"none"}}>New Project</a>
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ── LEFT NAV ── */}
        {!navCollapsed && (
          <nav style={{width:220,background:C.surface,borderRight:"1px solid "+C.border,padding:"1rem 0",display:"flex",flexDirection:"column",overflowY:"auto",flexShrink:0}}>
            <div style={{padding:"0 0.75rem 0.75rem",fontSize:"0.6rem",color:C.textDim,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase"}}>{entityName}</div>
            {navItems.map(n => (
              <button key={n.id} onClick={()=>setActiveNav(n.id)} style={{display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.6rem 0.75rem",background:activeNav===n.id?C.purpleDim:"transparent",border:"none",borderLeft:activeNav===n.id?`2px solid ${C.purple}`:"2px solid transparent",color:activeNav===n.id?C.purpleLight:C.textMid,fontFamily:"inherit",fontSize:"0.82rem",fontWeight:activeNav===n.id?600:400,cursor:"pointer",textAlign:"left",width:"100%",transition:"all 0.15s"}}>
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
        <main style={{flex:1,overflowY:"auto",padding:"1.5rem",minWidth:0}}>

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
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:"1rem",alignItems:"center"}}>
                  <div>
                    <div style={label(C.textDim)}>EXECUTION CONFIDENCE</div>
                    <div style={{fontFamily:"Georgia,serif",fontSize:"2.8rem",fontWeight:400,color:verdColor,lineHeight:1}}>{confScore}<span style={{fontSize:"1.2rem"}}>%</span></div>
                    <div style={{display:"inline-block",background:verdColor+"20",color:verdColor,fontSize:"0.65rem",fontWeight:700,padding:"0.15rem 0.6rem",borderRadius:100,marginTop:"0.35rem",border:"1px solid "+verdColor+"40"}}>
                      {confScore>=75?"Good":confScore>=55?"Moderate":"Low"}
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
              <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:"1rem",marginBottom:"1rem"}}>
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
                        {data.name} carries an execution confidence score of <strong style={{color:verdColor}}>{confScore}%</strong> with a projected completion of <strong style={{color:C.text}}>{result.projectedDate}</strong>. {result.confidence.reason}.
                      </p>
                      <p style={{fontSize:"0.88rem",color:C.textMid,lineHeight:1.8}}>
                        The critical path runs through <strong style={{color:C.text}}>{result.criticalPath.length}</strong> sequential tasks with {result.bufferDays < 0 ? `${Math.abs(result.bufferDays)} days of unrecoverable overrun` : `${result.bufferDays} days of buffer`}. {result.shuffleOps.length > 0 ? `${result.shuffleOps.length} concurrency opportunity${result.shuffleOps.length > 1?"s":""} identified that could recover up to ${result.shuffleOps.reduce((a,o)=>a+o.daysSaved,0)} days.` : "No major scheduling optimizations identified."}
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

              {/* INTELLIGENCE PILLARS */}
              <div style={{...card(),padding:"1.25rem",marginBottom:"1rem"}}>
                <div style={label(C.purple)}>EXECUTION INTELLIGENCE PILLARS</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1rem"}}>
                  {[
                    { title:"1. Timeline Health", color:C.blue, vals:[result.confidence.breakdown.find(f=>f.name==="Timeline tightness")?.score||50, result.confidence.breakdown.find(f=>f.name==="Plan sequencing")?.score||50, 70], labels:["DEPENDENCY","CRITICAL","FORECAST"], score:result.confidence.breakdown.find(f=>f.name==="Timeline tightness")?.score||50, scoreLabel:"ACCURACY", stats:[{name:"Dependency Compression",val:result.bufferDays<5?"Moderate":"Good",color:result.bufferDays<5?C.amber:C.green},{name:"Critical Path Stability",val:result.criticalPath.length<5?"Good":"Tight",color:result.criticalPath.length<5?C.green:C.amber},{name:"Forecast Accuracy",val:"81%",color:C.blue}] },
                    { title:"2. Resource Health", color:C.purple, vals:[result.confidence.breakdown.find(f=>f.name==="Owner concentration")?.score||50, result.confidence.breakdown.find(f=>f.name==="Scope vs capacity")?.score||50, 60], labels:["OVERLOAD","OWNER","APPROVAL"], score:result.confidence.breakdown.find(f=>f.name==="Scope vs capacity")?.score||50, scoreLabel:"CAPACITY", stats:[{name:"Team Overload",val:"Moderate",color:C.amber},{name:"Single Owner Risk",val:result.confidence.breakdown.find(f=>f.name==="Owner concentration")?.score<50?"Elevated":"Low",color:result.confidence.breakdown.find(f=>f.name==="Owner concentration")?.score<50?C.amber:C.green},{name:"Approval Capacity",val:result.totalTasks>8?"Limited":"Good",color:result.totalTasks>8?C.amber:C.green}] },
                    { title:"3. Operational Health", color:C.green, vals:[result.confidence.breakdown.find(f=>f.name==="Optimization gaps")?.score||50, result.confidence.breakdown.find(f=>f.name==="External dependencies")?.score||50, 78], labels:["STABILITY","REWORK","CONFIDENCE"], score:result.confidence.score, scoreLabel:"EXECUTION", stats:[{name:"Budget Stability",val:overrunCost>0?"At Risk":"Strong",color:overrunCost>0?C.red:C.green},{name:"Rework Risk",val:result.shuffleOps.length>1?"Moderate":"Low",color:result.shuffleOps.length>1?C.amber:C.green},{name:"Execution Confidence",val:confScore+"%",color:verdColor}] },
                  ].map((pillar,i) => (
                    <div key={i} style={{...card({background:C.surface2}),padding:"1rem"}}>
                      <div style={{fontSize:"0.72rem",fontWeight:700,color:pillar.color,marginBottom:"0.75rem"}}>{pillar.title}</div>
                      <RadarChart color={pillar.color} values={pillar.vals} labels={pillar.labels} title={pillar.title} score={pillar.score} scoreLabel={pillar.scoreLabel}/>
                      <div style={{marginTop:"0.75rem",display:"flex",flexDirection:"column",gap:"0.35rem"}}>
                        {pillar.stats.map((s,j) => (
                          <div key={j} style={{display:"flex",justifyContent:"space-between",fontSize:"0.75rem"}}>
                            <span style={{color:C.textMid}}>{s.name}</span>
                            <span style={{color:s.color,fontWeight:600}}>{s.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BOTTLENECKS + OPPORTUNITIES */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem",marginBottom:"1rem"}}>
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
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem",marginBottom:"1rem"}}>
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
                <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"0.75rem",textAlign:"center"}}>
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
                <div style={{fontSize:"0.8rem",color:C.textMid,marginTop:"0.2rem"}}>Click any node to see task detail, cascade chain, and recommended fix. Red zone = cascade impact area.</div>
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
              <div style={{...card(),overflow:"hidden",marginBottom:"1rem"}}>
                <GraphSection preview={false} />
              </div>

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
                <div style={{fontSize:"0.8rem",color:C.textMid,marginTop:"0.2rem"}}>Three dimensions of execution health across timeline, resource, and operational axes.</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1rem",marginBottom:"1rem"}}>
                {[
                  {title:"Timeline Health",color:C.blue,vals:[result.confidence.breakdown.find(f=>f.name==="Timeline tightness")?.score||50,result.confidence.breakdown.find(f=>f.name==="Plan sequencing")?.score||50,70],labels:["DEPENDENCY","CRITICAL","FORECAST"],score:result.confidence.breakdown.find(f=>f.name==="Timeline tightness")?.score||50,scoreLabel:"ACCURACY",desc:"How your schedule holds under execution pressure. Dependency compression, critical path stability, and forecast accuracy.",stats:[{name:"Dependency Compression",val:result.bufferDays<5?"Moderate":"Good",color:result.bufferDays<5?C.amber:C.green},{name:"Critical Path Stability",val:result.criticalPath.length<5?"Good":"Tight",color:result.criticalPath.length<5?C.green:C.amber},{name:"Forecast Accuracy",val:"81%",color:C.blue}]},
                  {title:"Resource Health",color:C.purple,vals:[result.confidence.breakdown.find(f=>f.name==="Owner concentration")?.score||50,result.confidence.breakdown.find(f=>f.name==="Scope vs capacity")?.score||50,60],labels:["OVERLOAD","OWNER","APPROVAL"],score:result.confidence.breakdown.find(f=>f.name==="Scope vs capacity")?.score||50,scoreLabel:"CAPACITY",desc:"Who is overloaded, who is a single point of failure, and where approval bottlenecks exist.",stats:[{name:"Team Overload",val:"Moderate",color:C.amber},{name:"Single Owner Risk",val:result.confidence.breakdown.find(f=>f.name==="Owner concentration")?.score<50?"Elevated":"Low",color:result.confidence.breakdown.find(f=>f.name==="Owner concentration")?.score<50?C.amber:C.green},{name:"Approval Capacity",val:result.totalTasks>8?"Limited":"Good",color:result.totalTasks>8?C.amber:C.green}]},
                  {title:"Operational Health",color:C.green,vals:[result.confidence.breakdown.find(f=>f.name==="Optimization gaps")?.score||50,result.confidence.breakdown.find(f=>f.name==="External dependencies")?.score||50,78],labels:["STABILITY","REWORK","CONFIDENCE"],score:result.confidence.score,scoreLabel:"EXECUTION",desc:"Execution confidence, rework risk, and budget stability across the full project lifecycle.",stats:[{name:"Budget Stability",val:overrunCost>0?"At Risk":"Strong",color:overrunCost>0?C.red:C.green},{name:"Rework Risk",val:result.shuffleOps.length>1?"Moderate":"Low",color:result.shuffleOps.length>1?C.amber:C.green},{name:"Execution Confidence",val:confScore+"%",color:verdColor}]},
                ].map((pillar,i) => (
                  <div key={i} style={{...card(),padding:"1.5rem",borderTop:"2px solid "+pillar.color}}>
                    <div style={{fontSize:"0.78rem",fontWeight:700,color:pillar.color,marginBottom:"0.5rem"}}>{pillar.title}</div>
                    <p style={{fontSize:"0.78rem",color:C.textDim,lineHeight:1.6,marginBottom:"1rem"}}>{pillar.desc}</p>
                    <div style={{display:"flex",justifyContent:"center",marginBottom:"1rem"}}>
                      <RadarChart color={pillar.color} values={pillar.vals} labels={pillar.labels} title={pillar.title} score={pillar.score} scoreLabel={pillar.scoreLabel}/>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
                      {pillar.stats.map((s,j)=>(
                        <div key={j} style={{display:"flex",justifyContent:"space-between",fontSize:"0.82rem",paddingBottom:"0.5rem",borderBottom:j<pillar.stats.length-1?"1px solid "+C.border:"none"}}>
                          <span style={{color:C.textMid}}>{s.name}</span>
                          <span style={{color:s.color,fontWeight:700}}>{s.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{...card(),padding:"1.25rem"}}>
                <div style={label(verdColor)}>CONFIDENCE SCORE BREAKDOWN — {confScore}%</div>
                <div style={{display:"flex",flexDirection:"column",gap:"0.65rem",marginTop:"0.75rem"}}>
                  {result.confidence.breakdown.map((f,i)=>(
                    <div key={i}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.3rem"}}>
                        <span style={{fontSize:"0.82rem",color:C.textMid,textTransform:"capitalize"}}>{f.name}</span>
                        <span style={{fontSize:"0.75rem",color:f.score<40?C.red:f.score<65?C.amber:C.green,fontFamily:"monospace"}}>{f.score}/100 · {f.weight}%</span>
                      </div>
                      <div style={{height:5,background:C.border2,borderRadius:3}}>
                        <div style={{height:"100%",width:f.score+"%",background:f.score<40?C.red:f.score<65?C.amber:C.green,borderRadius:3,transition:"width 0.8s ease"}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem"}}>
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
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem"}}>
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
                    <p style={{fontSize:"0.95rem",color:C.text,lineHeight:1.9,marginBottom:"0.75rem",fontFamily:"Georgia,serif"}}>{data.name} carries an execution confidence score of {confScore}% with a projected completion of {result.projectedDate}. {result.confidence.reason}. The critical path runs through {result.criticalPath.length} sequential tasks with {result.bufferDays>=0?result.bufferDays+" days of buffer":Math.abs(result.bufferDays)+" days of unrecoverable overrun"}.</p>
                    <p style={{fontSize:"0.95rem",color:C.text,lineHeight:1.9,fontFamily:"Georgia,serif"}}>{result.predictiveRisk?`Predictive risk analysis places the probability of missing the deadline at ${result.predictiveRisk.planProb}%, driven primarily by ${result.predictiveRisk.top3[0]?.name} — ${result.predictiveRisk.top3[0]?.reason}. `:""}The recommended immediate action is to {result.shuffleOps[0]?`run "${result.shuffleOps[0].task}" concurrently with its predecessor, recovering approximately ${result.shuffleOps[0].daysSaved} days at zero additional cost`:"validate critical path owner availability before work begins"}.</p>
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
                <div style={{display:"grid",gridTemplateColumns:"1fr 100px 70px 80px 80px",gap:"1rem",padding:"0.6rem 1.25rem",borderBottom:"1px solid "+C.border,fontSize:"0.62rem",color:C.textDim,fontWeight:700,letterSpacing:"0.1em"}}>
                  <span>MILESTONE</span><span>OWNER</span><span>DAYS</span><span>START</span><span>FLOAT</span>
                </div>
                {result.tasks.map((t,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 100px 70px 80px 80px",gap:"1rem",padding:"0.75rem 1.25rem",borderBottom:i<result.tasks.length-1?"1px solid "+C.border2:"none",alignItems:"center"}}>
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
