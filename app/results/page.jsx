"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ── CONFIDENCE ENGINE ────────────────────────────────────────────────────────
function computeConfidence(tasks, availableDays, projectDuration, budget, bufferDays, shuffleOps, byId) {
  const totalTasks = tasks.length;
  if (!totalTasks) return { score: 0, band: "#F87171", reason: "Not enough milestones.", breakdown: [] };
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
  if (score >= 85) band = "#3ECB6F";
  else if (score >= 70) band = "#85D44A";
  else if (score >= 50) band = "#FBBF24";
  else if (score >= 30) band = "#FB923C";
  else band = "#F87171";
  const factors = [
    { name: "timeline tightness", score: timelineScore, weight: 0.25 },
    { name: "budget pressure", score: budgetScore, weight: 0.25 },
    { name: "scope vs capacity", score: scopeScore, weight: 0.25 },
    { name: "external dependencies", score: externalScore, weight: 0.10 },
    { name: "owner concentration", score: concentrationScore, weight: 0.08 },
    { name: "plan sequencing", score: sequencingScore, weight: 0.04 },
    { name: "optimization gaps", score: optimizationScore, weight: 0.03 },
  ];
  const lowest = [...factors].sort((a,b) => a.score - b.score)[0];
  let reason = "";
  if (lowest.name === "timeline tightness") reason = "Primary drag: critical path leaves " + (bufferDays < 0 ? Math.abs(bufferDays) + " days of unrecoverable overrun." : "only " + bufferDays + " days of buffer.");
  else if (lowest.name === "budget pressure") reason = "Primary drag: a " + budget.toLowerCase() + " budget removes your ability to add resources if the plan slips.";
  else if (lowest.name === "scope vs capacity") reason = "Primary drag: too much work concentrated on too few owners.";
  else if (lowest.name === "owner concentration") reason = "Primary drag: one person owns " + maxCriticalByOne + " of " + criticalTasks.length + " critical path milestones.";
  else if (lowest.name === "external dependencies") reason = "Primary drag: " + externalCount + " milestones have complex dependency chains.";
  else if (lowest.name === "plan sequencing") reason = "Primary drag: plan is almost entirely sequential — parallelizing any milestones improves confidence immediately.";
  else reason = "Primary drag: scheduling opportunities exist that would measurably improve the outcome.";
  return { score, band, reason, breakdown: factors.map(f => ({ name: f.name, score: f.score, weight: Math.round(f.weight*100) })) };
}

function buildOptimizedTasks(tasks, shuffleOps) {
  if (!shuffleOps.length) return tasks;
  return tasks.map(t => {
    const op = shuffleOps.find(o => o.task === t.name);
    if (op && !t.concurrent && t.predecessors.length) return { ...t, concurrent: true };
    return t;
  });
}

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
  let verdict, verdictColor, verdictSub;
  if (bufferDays >= 3) { verdict="ON TRACK"; verdictColor="#3ECB6F"; verdictSub="You have "+bufferDays+" days of breathing room."; }
  else if (bufferDays >= 0) { verdict="AT RISK"; verdictColor="#FBBF24"; verdictSub="Only "+bufferDays+" day"+(bufferDays===1?"":"s")+" of buffer — one delay and your deadline moves."; }
  else { verdict="DEADLINE OVERRUN"; verdictColor="#F87171"; verdictSub="Your plan runs "+Math.abs(bufferDays)+" days over. Something needs to change."; }
  const projDate = new Date(start); projDate.setDate(projDate.getDate()+projectDuration);
  const tightness = availableDays > 0 ? projectDuration/availableDays : 2;
  const unowned = tasks.filter(t => !t.owner||t.owner==="UNASSIGNED").length;
  const timeScore = tightness>=0.85?3:tightness>=0.65?2:1;
  const bScore = budget==="Fixed"?3:budget==="Tight"?2:1;
  const sScore = (tasks.length+unowned)/4;
  let primaryConstraint;
  if (timeScore>=bScore&&timeScore>=sScore) primaryConstraint="TIME";
  else if (bScore>=timeScore&&bScore>=sScore) primaryConstraint="BUDGET";
  else primaryConstraint="SCOPE";
  const primaryReason = primaryConstraint==="TIME"?(bufferDays<3?"The deadline is fixed and buffer is almost gone. You cannot add days — so something else has to give.":"Your timeline is tight relative to the volume of work mapped."):primaryConstraint==="BUDGET"?"Budget is "+budget.toLowerCase()+" and adding resources is not a free move.":"There are "+tasks.length+" milestones"+(unowned>0?" and "+unowned+" without a clear owner":"")+". The volume of work is creating pressure.";
  const concOpportunity = tasks.find(t => !t.concurrent&&t.predecessors.length&&byId[t.id].slack===0);
  const cutCandidate = [...tasks].filter(t=>byId[t.id].slack===0).sort((a,b)=>tasks.filter(s=>s.predecessors.includes(a.id)).length-tasks.filter(s=>s.predecessors.includes(b.id)).length)[0];
  const unownedTask = tasks.find(t=>!t.owner||t.owner.trim()===""||t.owner==="UNASSIGNED");
  const scopeMove = cutCandidate?"If you want to reduce scope — cut or defer \""+cutCandidate.name+"\". Fewest downstream dependencies, saves "+cutCandidate.days+" day"+(cutCandidate.days>1?"s":"")+" without cascading.":"If you want to reduce scope — review whether every milestone is required for this phase.";
  const timeMove = concOpportunity?"If you want to compress the schedule — run \""+concOpportunity.name+"\" at the same time as its predecessor. Buys up to "+Math.floor(concOpportunity.days*0.6)+" days at zero cost.":"If you want to compress the schedule — look for milestones with no shared dependencies that can run simultaneously.";
  const budgetMove = unownedTask?"If you want to protect the budget — assign a dedicated owner to \""+unownedTask.name+"\" today. Unowned milestones are where rework happens.":"If you want to protect the budget — concentrate QA effort on critical path milestones first.";
  const recommendedMove = primaryConstraint==="TIME"?(concOpportunity?"Run \""+concOpportunity.name+"\" in parallel — costs nothing and buys days immediately.":"Find two sequential milestones that can overlap and run simultaneously."):primaryConstraint==="BUDGET"?"Cut scope before adding resources — cheaper and faster.":"Compress through concurrency before cutting anything from the plan.";
  const concOps = [];
  tasks.forEach(t => { if (!t.concurrent&&t.predecessors.length&&byId[t.id].slack===0) { const pred=tasks.find(p=>p.id===t.predecessors[0]); if (pred) concOps.push({task:t.name,predecessor:pred.name,daysSaved:Math.floor((parseInt(t.days)||1)*0.5),reason:"\""+t.name+"\" can start while \""+pred.name+"\" is in final review. No dependency broken."}); }});
  const shuffleOps = concOps.slice(0,3);
  const confidence = computeConfidence(tasks,availableDays,projectDuration,budget,bufferDays,shuffleOps,byId);
  return {
    tasks:Object.values(byId), projectDuration, bufferDays, verdict, verdictColor, verdictSub,
    projectedDate:projDate.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}),
    availableDays, primaryConstraint, primaryReason, scopeMove, timeMove, budgetMove, recommendedMove,
    criticalPath:tasks.filter(t=>byId[t.id].slack===0).map(t=>t.name),
    bottlenecks:tasks.filter(t=>byId[t.id].slack===0).map(t=>({...byId[t.id],dependents:tasks.filter(s=>s.predecessors.includes(t.id)).length})).sort((a,b)=>b.dependents-a.dependents).slice(0,3),
    shuffleOps, confidence, startDate,
  };
}

function ConfidenceRing({ score, band, size=80 }) {
  const r=(size/2)-8, circ=2*Math.PI*r, filled=(score/100)*circ;
  return (
    <svg width={size} height={size} viewBox={"0 0 "+size+" "+size} style={{transform:"rotate(-90deg)",flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1E251E" strokeWidth="8"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={band} strokeWidth="8"
        strokeDasharray={circ} strokeDashoffset={circ-filled} strokeLinecap="round"
        style={{transition:"stroke-dashoffset 1s ease"}}/>
    </svg>
  );
}

// ── CANVAS GANTT (single plan) ───────────────────────────────────────────────
function useGanttCanvas(canvasRef, tasks, result, startDate, dayMode) {
  const drawFn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result || !tasks.length) return;
    const dpr = window.devicePixelRatio || 1;
    const LABEL_W = 150;
    const DAY_PX = dayMode === "work" ? 18 : 13;
    const TOTAL = result.projectDuration;
    const SPAN = TOTAL + 8;
    const CHART_W = SPAN * DAY_PX;
    const ROW_H = 52, BAR_H = 22, TICK_H = 40, PAD_BOT = 36;
    const W = LABEL_W + CHART_W;
    const H = TICK_H + result.tasks.length * ROW_H + PAD_BOT;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0,0,W,H);

    function addDays(n) {
      if (dayMode === "work") {
        let d = new Date(startDate); let added = 0;
        while (added < n) { d.setDate(d.getDate()+1); if (d.getDay()!==0&&d.getDay()!==6) added++; }
        return d;
      }
      const d = new Date(startDate); d.setDate(d.getDate()+n); return d;
    }
    function fmt(n) { return addDays(n).toLocaleDateString("en-US",{month:"short",day:"numeric"}); }

    const xOf = d => LABEL_W + d * DAY_PX;
    const RED="#F87171", DIM="#2A3A2A", TEXTDIM="#4A5A4A", TEXTMID="#8A9E8A";
    const critSet = new Set(result.criticalPath);

    function rr(ctx,x,y,w,h,r){ if(w<r*2)r=Math.max(w/2,0); if(h<r*2)r=Math.max(h/2,0); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath(); }

    for (let d=0; d<=SPAN; d+=7) {
      const xp=xOf(d);
      ctx.strokeStyle="#1A251A"; ctx.lineWidth=1; ctx.setLineDash([2,4]);
      ctx.beginPath(); ctx.moveTo(xp,TICK_H); ctx.lineTo(xp,H-PAD_BOT+4); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle=TEXTDIM; ctx.font="400 9.5px 'DM Sans',sans-serif"; ctx.textAlign="center";
      ctx.fillText(fmt(d),xp,TICK_H-20);
    }

    result.tasks.forEach((t,i) => {
      const isCrit = critSet.has(t.name);
      const y=TICK_H+i*ROW_H; const barY=y+(ROW_H-BAR_H)/2;
      const barX=xOf(t.es); const barW=t.days*DAY_PX;
      if(i%2===0){ctx.fillStyle="rgba(255,255,255,0.018)";ctx.fillRect(LABEL_W,y,CHART_W,ROW_H);}
      ctx.textAlign="right"; ctx.font=(isCrit?"600":"400")+" 11px 'DM Sans',sans-serif";
      ctx.fillStyle=isCrit?RED:TEXTMID;
      ctx.fillText((isCrit?"⬡ ":"  ")+t.name,LABEL_W-8,y+ROW_H/2+4);
      ctx.globalAlpha=isCrit?0.85:0.35; if(isCrit){ctx.shadowColor=RED;ctx.shadowBlur=5;}
      ctx.fillStyle=isCrit?RED:DIM; rr(ctx,barX,barY,barW,BAR_H,5); ctx.fill();
      ctx.shadowBlur=0; ctx.globalAlpha=1;
      if(barW>32){ctx.fillStyle="#EEF2EE";ctx.globalAlpha=isCrit?0.9:0.4;ctx.font="700 9.5px 'DM Sans',sans-serif";ctx.textAlign="center";ctx.fillText(t.days+"d",barX+barW/2,barY+BAR_H/2+3.5);ctx.globalAlpha=1;}
      ctx.fillStyle=TEXTDIM;ctx.font="400 8.5px 'DM Sans',sans-serif";ctx.textAlign="left";
      ctx.fillText(fmt(t.es),barX+2,barY+BAR_H+11);
      ctx.fillStyle=isCrit?RED:TEXTDIM;ctx.font=(isCrit?"600":"400")+" 8.5px 'DM Sans',sans-serif";
      ctx.fillText(fmt(t.ef),xOf(t.ef)+5,barY+BAR_H/2+4);
      if(isCrit){const dx=xOf(t.ef),dy=barY+BAR_H/2;ctx.save();ctx.translate(dx,dy);ctx.rotate(Math.PI/4);ctx.fillStyle=RED;ctx.strokeStyle="#080A08";ctx.lineWidth=1.5;ctx.shadowColor=RED;ctx.shadowBlur=4;ctx.beginPath();ctx.rect(-5,-5,10,10);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.restore();}
    });

    // Finish line (clean, no text — text is in summary cards)
    const finX=xOf(TOTAL);
    ctx.strokeStyle=RED;ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.globalAlpha=0.8;
    ctx.beginPath();ctx.moveTo(finX,TICK_H);ctx.lineTo(finX,H-PAD_BOT+4);ctx.stroke();
    ctx.setLineDash([]);ctx.globalAlpha=1;
    ctx.fillStyle=RED;ctx.font="700 9.5px 'DM Sans',sans-serif";ctx.textAlign="center";
    ctx.fillText("FINISH — "+addDays(TOTAL).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),finX,H-PAD_BOT+18);

    // Target line
    const tDays = result.availableDays;
    if (tDays > 0 && tDays !== TOTAL) {
      const tgtX=xOf(tDays);
      ctx.strokeStyle="#3ECB6F";ctx.lineWidth=1.5;ctx.setLineDash([4,5]);ctx.globalAlpha=0.4;
      ctx.beginPath();ctx.moveTo(tgtX,TICK_H);ctx.lineTo(tgtX,H-PAD_BOT+4);ctx.stroke();
      ctx.setLineDash([]);ctx.globalAlpha=1;
      ctx.fillStyle="#3ECB6F";ctx.font="600 9px 'DM Sans',sans-serif";ctx.globalAlpha=0.5;ctx.textAlign="center";
      ctx.fillText("TARGET",tgtX,H-PAD_BOT+18);ctx.globalAlpha=1;
    }
  }, [tasks, result, startDate, dayMode]);

  useEffect(() => { drawFn(); }, [drawFn]);
  useEffect(() => {
    const handler = () => drawFn();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [drawFn]);
}

// ── CANVAS GANTT (comparison — two bars per row) ─────────────────────────────
function useCompareGanttCanvas(canvasRef, origTasks, origResult, optTasks, optResult, startDate, dayMode) {
  const drawFn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !origResult || !origTasks.length) return;
    const dpr = window.devicePixelRatio || 1;
    const LABEL_W = 150;
    const DAY_PX = dayMode === "work" ? 18 : 13;
    const ORIG_TOTAL = origResult.projectDuration;
    const OPT_TOTAL = optResult ? optResult.projectDuration : ORIG_TOTAL;
    const SPAN = Math.max(ORIG_TOTAL, OPT_TOTAL) + 10;
    const CHART_W = SPAN * DAY_PX;
    const ROW_H=70, BAR_H=20, TICK_H=40, PAD_BOT=20;
    const W = LABEL_W + CHART_W;
    const H = TICK_H + origResult.tasks.length * ROW_H + PAD_BOT;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0,0,W,H);

    function addDays(n) {
      if (dayMode === "work") {
        let d=new Date(startDate); let added=0;
        while(added<n){d.setDate(d.getDate()+1);if(d.getDay()!==0&&d.getDay()!==6)added++;}
        return d;
      }
      const d=new Date(startDate); d.setDate(d.getDate()+n); return d;
    }
    function fmt(n){return addDays(n).toLocaleDateString("en-US",{month:"short",day:"numeric"});}

    const xOf = d => LABEL_W + d * DAY_PX;
    const RED="#F87171", GREEN="#3ECB6F", TEXTDIM="#4A5A4A", TEXTMID="#8A9E8A";

    function rr(ctx,x,y,w,h,r){if(w<r*2)r=Math.max(w/2,0);if(h<r*2)r=Math.max(h/2,0);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}

    for(let d=0;d<=SPAN;d+=7){
      const xp=xOf(d);
      ctx.strokeStyle="#1A251A";ctx.lineWidth=1;ctx.setLineDash([2,4]);
      ctx.beginPath();ctx.moveTo(xp,TICK_H);ctx.lineTo(xp,H-PAD_BOT+4);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle=TEXTDIM;ctx.font="400 9.5px 'DM Sans',sans-serif";ctx.textAlign="center";
      ctx.fillText(fmt(d),xp,TICK_H-20);
    }

    // Build map of optimized task positions
    const optById = {};
    if (optResult) optResult.tasks.forEach(t => { optById[t.id] = t; });

    origResult.tasks.forEach((orig,i) => {
      const opt = optById[orig.id] || orig;
      const isChanged = opt.es !== orig.es || opt.ef !== orig.ef;
      const y=TICK_H+i*ROW_H;
      if(i%2===0){ctx.fillStyle="rgba(255,255,255,0.018)";ctx.fillRect(LABEL_W,y,CHART_W,ROW_H);}

      ctx.textAlign="right";
      ctx.font=(isChanged?"700":"400")+" 11px 'DM Sans',sans-serif";
      ctx.fillStyle=isChanged?GREEN:TEXTMID;
      ctx.fillText((isChanged?"✦ ":"  ")+orig.name,LABEL_W-8,y+ROW_H/2+2);

      // YOUR PLAN bar — top
      const origBarY=y+5; const origBarX=xOf(orig.es); const origBarW=orig.days*DAY_PX;
      ctx.globalAlpha=orig.slack===0?0.7:0.28; if(orig.slack===0){ctx.shadowColor=RED;ctx.shadowBlur=3;}
      ctx.fillStyle=orig.slack===0?RED:"#3A4A3A"; rr(ctx,origBarX,origBarY,origBarW,BAR_H,4); ctx.fill();
      ctx.shadowBlur=0; ctx.globalAlpha=1;
      if(origBarW>26){ctx.fillStyle="#EEF2EE";ctx.globalAlpha=orig.slack===0?0.8:0.35;ctx.font="700 9px 'DM Sans',sans-serif";ctx.textAlign="center";ctx.fillText(orig.days+"d",origBarX+origBarW/2,origBarY+BAR_H/2+3.5);ctx.globalAlpha=1;}
      ctx.fillStyle=TEXTDIM;ctx.font="400 8px 'DM Sans',sans-serif";ctx.textAlign="left";
      ctx.fillText(fmt(orig.es),origBarX+2,origBarY+BAR_H+9);

      // PATHFLO bar — bottom
      const optBarY=y+ROW_H/2+5; const optBarX=xOf(opt.es); const optBarW=opt.days*DAY_PX;
      ctx.globalAlpha=isChanged?1.0:0.45; if(isChanged){ctx.shadowColor=GREEN;ctx.shadowBlur=8;}
      ctx.fillStyle=isChanged?GREEN:"#1A4A1A"; rr(ctx,optBarX,optBarY,optBarW,BAR_H,4); ctx.fill();
      ctx.shadowBlur=0; ctx.globalAlpha=1;
      if(optBarW>26){ctx.fillStyle="#080A08";ctx.globalAlpha=isChanged?1:0.55;ctx.font="700 9px 'DM Sans',sans-serif";ctx.textAlign="center";ctx.fillText(opt.days+"d",optBarX+optBarW/2,optBarY+BAR_H/2+3.5);ctx.globalAlpha=1;}
      ctx.fillStyle=isChanged?GREEN:TEXTDIM;ctx.font=(isChanged?"700":"400")+" 8px 'DM Sans',sans-serif";ctx.textAlign="left";
      ctx.fillText(fmt(opt.es),optBarX+2,optBarY+BAR_H+9);

      if(isChanged&&orig.es!==opt.es){const saved=orig.es-opt.es;ctx.fillStyle=GREEN;ctx.font="700 9px 'DM Sans',sans-serif";ctx.textAlign="left";ctx.fillText("↑ "+saved+"d earlier",xOf(opt.ef)+6,optBarY+BAR_H/2+4);}
    });

    // Finish lines — clean, no text labels (summary cards handle labeling)
    const optFinX = xOf(OPT_TOTAL);
    ctx.strokeStyle=GREEN;ctx.lineWidth=2.5;ctx.setLineDash([5,4]);ctx.globalAlpha=0.9;
    ctx.beginPath();ctx.moveTo(optFinX,TICK_H);ctx.lineTo(optFinX,H-PAD_BOT+4);ctx.stroke();
    ctx.setLineDash([]);ctx.globalAlpha=1;

    const origFinX = xOf(ORIG_TOTAL);
    ctx.strokeStyle=RED;ctx.lineWidth=2.5;ctx.setLineDash([5,4]);ctx.globalAlpha=0.75;
    ctx.beginPath();ctx.moveTo(origFinX,TICK_H);ctx.lineTo(origFinX,H-PAD_BOT+4);ctx.stroke();
    ctx.setLineDash([]);ctx.globalAlpha=1;
  }, [origTasks, origResult, optTasks, optResult, startDate, dayMode]);

  useEffect(() => { drawFn(); }, [drawFn]);
  useEffect(() => {
    const handler = () => drawFn();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [drawFn]);
}

// ── GANTT COMPONENTS ─────────────────────────────────────────────────────────
function SingleGanttChart({ tasks, result, startDate, dayMode }) {
  const canvasRef = useRef(null);
  useGanttCanvas(canvasRef, tasks, result, startDate, dayMode);
  return <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:"0.5rem"}}><canvas ref={canvasRef}/></div>;
}

function CompareGanttChart({ origTasks, origResult, optTasks, optResult, startDate, dayMode }) {
  const canvasRef = useRef(null);
  useCompareGanttCanvas(canvasRef, origTasks, origResult, optTasks, optResult, startDate, dayMode);
  return <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:"0.5rem"}}><canvas ref={canvasRef}/></div>;
}

// ── RESULTS CONTENT ───────────────────────────────────────────────────────────
function ResultsContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState(null);
  const [result, setResult] = useState(null);
  const [optResult, setOptResult] = useState(null);
  const [changes, setChanges] = useState([]);
  const [aiReadout, setAiReadout] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [dayMode, setDayMode] = useState("work"); // "work" | "cal"

  useEffect(() => {
    const raw = searchParams.get("data");
    if (!raw) return;
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      setData(parsed);
      const r = computeCPM(parsed.tasks, parsed.startDate, parsed.targetDate, parsed.budget||"Flexible");
      setResult(r);
      if (r && r.shuffleOps.length > 0) {
        const optTaskList = buildOptimizedTasks(parsed.tasks, r.shuffleOps);
        const oR = computeCPM(optTaskList, parsed.startDate, parsed.targetDate, parsed.budget||"Flexible");
        setOptResult(oR);
        const c = r.shuffleOps.map(op => "\""+op.task+"\" runs concurrently with \""+op.predecessor+"\" — saves ~"+op.daysSaved+" days");
        if (oR && oR.projectDuration < r.projectDuration) {
          c.push("Confidence improves from "+r.confidence.score+"% to "+oR.confidence.score+"%");
        }
        setChanges(c);
      }
      setAiLoading(true);
      fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectData:parsed})})
        .then(res=>res.json()).then(d=>{setAiReadout(d.readout||null);setAiLoading(false);}).catch(()=>setAiLoading(false));
    } catch(e){ console.error(e); }
  }, []);

  // Date helper — respects dayMode
  function addDays(n) {
    if (!data?.startDate) return new Date();
    if (dayMode === "work") {
      let d = new Date(data.startDate); let added = 0;
      while (added < n) { d.setDate(d.getDate()+1); if (d.getDay()!==0&&d.getDay()!==6) added++; }
      return d;
    }
    const d = new Date(data.startDate); d.setDate(d.getDate()+n); return d;
  }
  function fmtDate(n, showYear) {
    return addDays(n).toLocaleDateString("en-US", {month:"long", day:"numeric", ...(showYear?{year:"numeric"}:{})});
  }

  if (!data||!result) return <div style={{minHeight:"100vh",background:"#080A08",display:"flex",alignItems:"center",justifyContent:"center",color:"#8A9E8A",fontFamily:"system-ui"}}>Building your execution forecast...</div>;

  const C = {
    bg:"#080A08",surface:"#111511",surface2:"#161A16",border:"#1E251E",border2:"#252D25",
    text:"#EEF2EE",textMid:"#8A9E8A",textDim:"#4A5A4A",
    green:"#3ECB6F",greenDim:"#0F2B1A",greenMid:"#1A4A28",
    warn:"#FBBF24",danger:"#F87171",info:"#818CF8",
    radius:"16px",radiusSm:"10px",
  };

  const entityName = data.company || data.name || null;
  const tab1Label = entityName ? (entityName.length > 20 ? entityName.slice(0,20)+"…" : entityName)+" Forecast" : "Your Forecast";
  const verdictColor = result.verdict==="ON TRACK"?C.green:result.verdict==="AT RISK"?C.warn:C.danger;
  const optVerdictColor = optResult?(optResult.verdict==="ON TRACK"?C.green:optResult.verdict==="AT RISK"?C.warn:C.danger):C.green;
  const constraintColor = {TIME:C.warn,SCOPE:C.info,BUDGET:C.danger}[result.primaryConstraint]||C.green;
  const hasBudget = data.totalBudget&&data.totalBudget!=="";
  const budgetNum = hasBudget?parseFloat(data.totalBudget.replace(/[^0-9.]/g,""))||0:0;
  const taskCosts = data.tasks.map(t=>parseFloat((t.cost||"0").replace(/[^0-9.]/g,""))||0);
  const totalTaskCost = taskCosts.reduce((a,b)=>a+b,0);
  const dailyBurn = budgetNum>0&&result.projectDuration>0?budgetNum/result.projectDuration:0;
  const overrunCost = result.bufferDays<0&&dailyBurn>0?Math.abs(result.bufferDays)*dailyBurn:0;
  const bufferValue = result.bufferDays>0&&dailyBurn>0?result.bufferDays*dailyBurn:0;
  const budgetStatement = !hasBudget?null:overrunCost>0?"At your current burn rate, this plan costs $"+Math.round(overrunCost).toLocaleString()+" more than your budget — "+Math.abs(result.bufferDays)+" days of unplanned spend at $"+Math.round(dailyBurn).toLocaleString()+"/day.":"You're currently $"+Math.round(bufferValue).toLocaleString()+" under budget with "+result.bufferDays+" days of breathing room.";
  const daysDiff = optResult ? result.projectDuration - optResult.projectDuration : 0;
  const scoreDiff = optResult ? optResult.confidence.score - result.confidence.score : 0;

  const tabs = [
    {id:0,label:tab1Label},
    {id:1,label:"Pathflo: Execution Forecast"},
    {id:2,label:"Diagnosis"},
    ...(hasBudget?[{id:3,label:"Financials"}]:[]),
    {id:4,label:"Readout"},
    {id:5,label:"Details"},
  ];

  const Card=({children,style={}})=><div style={{background:C.surface,border:"1px solid "+C.border2,borderRadius:C.radius,padding:"1.5rem",marginBottom:"1rem",...style}}>{children}</div>;
  const STitle=({children,color=C.textMid})=><div style={{fontSize:"0.75rem",fontWeight:600,color,marginBottom:"0.5rem",letterSpacing:"0.02em"}}>{children}</div>;
  const Divider=()=><div style={{height:1,background:C.border,margin:"1rem 0"}}/>;
  const ModeNote=()=><div style={{fontSize:"0.72rem",color:C.textDim,marginBottom:"0.85rem",display:"flex",alignItems:"center",gap:"0.4rem"}}>
    <div style={{width:6,height:6,borderRadius:"50%",background:C.green,flexShrink:0}}/>
    {dayMode==="work"?"Showing working days (Mon–Fri) — toggle \"All days\" to include weekends":"Showing all calendar days including weekends"}
  </div>;

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"'DM Sans', system-ui, sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:ital,opsz,wght@0,9..144,300;1,9..144,300&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#252D25;border-radius:2px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dotBlink{0%,80%,100%{opacity:0}40%{opacity:1}}
        @keyframes scoreIn{from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}}
        .tab-btn{transition:all 0.2s;white-space:nowrap}.tab-btn:hover{color:#EEF2EE !important}
        .tabs-scroll::-webkit-scrollbar{display:none}
        .day-toggle{display:flex;align-items:center;background:#111511;border:1px solid #252D25;border-radius:100px;padding:3px;gap:2px;flex-shrink:0}
        .dtbtn{border:none;border-radius:100px;font-family:inherit;font-size:.65rem;font-weight:600;padding:.28rem .65rem;cursor:pointer;transition:all .2s;white-space:nowrap;letter-spacing:.03em}
        .dtbtn.on{background:#3ECB6F;color:#080A08}.dtbtn.off{background:transparent;color:#4A5A4A}
        .dtbtn.off:hover{color:#8A9E8A}
      `}</style>

      <div style={{position:"fixed",top:0,left:0,right:0,height:"100vh",background:"radial-gradient(ellipse 80% 40% at 50% -10%,rgba(62,203,111,0.07) 0%,transparent 60%)",pointerEvents:"none",zIndex:0}}/>

      {/* NAV */}
      <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(8,10,8,0.92)",backdropFilter:"blur(16px)",borderBottom:"1px solid "+C.border}}>
        <div style={{padding:"0 1.5rem",height:"60px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"0.75rem",maxWidth:820,margin:"0 auto"}}>
          <a href="/" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:"0.5rem",flexShrink:0}}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none"><path d="M4 24 C8 24 10 14 15 14 C20 14 22 6 26 6 C29 6 30 12 31 14" stroke="#3ECB6F" strokeWidth="2.5" strokeLinecap="round" fill="none"/><circle cx="4" cy="24" r="3" fill="#3ECB6F"/><circle cx="31" cy="14" r="2.5" fill="#3ECB6F" opacity="0.9"/></svg>
            <span style={{fontWeight:700,fontSize:"1rem",color:C.text}}>Path<span style={{color:C.green,fontWeight:300}}>flo</span></span>
          </a>

          {/* Confidence badge */}
          <div style={{display:"flex",alignItems:"center",gap:"0.5rem",background:result.confidence.band+"12",border:"1px solid "+result.confidence.band+"40",borderRadius:"100px",padding:"0.3rem 0.75rem 0.3rem 0.5rem",flexShrink:0}}>
            <ConfidenceRing score={result.confidence.score} band={result.confidence.band} size={28}/>
            <div>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:"1rem",fontWeight:300,color:result.confidence.band,lineHeight:1}}>{result.confidence.score}%</div>
              <div style={{fontSize:"0.5rem",color:C.textDim,fontFamily:"monospace",letterSpacing:"0.06em"}}>CONFIDENCE</div>
            </div>
          </div>

          {/* Day mode toggle */}
          <div className="day-toggle">
            <button className={"dtbtn "+(dayMode==="work"?"on":"off")} onClick={()=>setDayMode("work")}>Work days</button>
            <button className={"dtbtn "+(dayMode==="cal"?"on":"off")} onClick={()=>setDayMode("cal")}>All days</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-scroll" style={{display:"flex",overflowX:"auto",padding:"0 1.5rem",maxWidth:820,margin:"0 auto",scrollbarWidth:"none"}}>
          {tabs.map(tab=>(
            <button key={tab.id} className="tab-btn" onClick={()=>setActiveTab(tab.id)} style={{background:"transparent",border:"none",borderBottom:activeTab===tab.id?"2px solid "+C.green:"2px solid transparent",color:activeTab===tab.id?C.green:C.textDim,fontFamily:"inherit",fontSize:"0.8rem",fontWeight:activeTab===tab.id?600:400,padding:"0.75rem 1rem",cursor:"pointer"}}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:820,margin:"0 auto",padding:"1.5rem 1.5rem 6rem",position:"relative",zIndex:1}}>
        <div style={{marginBottom:"1.25rem"}}>
          <div style={{fontSize:"0.62rem",color:C.textDim,fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:"0.2rem"}}>EXECUTION FORECAST</div>
          <h1 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.5rem,4vw,2.2rem)",fontWeight:300,letterSpacing:"-0.02em"}}>{data.name}</h1>
        </div>

        {/* ── TAB 0: THEIR PLAN ── */}
        {activeTab===0&&(
          <div style={{animation:"fadeUp 0.3s ease both"}}>
            <Card style={{border:"1px solid "+verdictColor,boxShadow:"0 0 0 1px "+verdictColor+"30,0 16px 60px rgba(0,0,0,0.5)",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,transparent,"+verdictColor+",transparent)"}}/>
              <div style={{display:"flex",gap:"1.5rem",alignItems:"center",marginBottom:"1.25rem"}}>
                <div style={{position:"relative",flexShrink:0,animation:"scoreIn 0.6s ease both"}}>
                  <ConfidenceRing score={result.confidence.score} band={result.confidence.band} size={88}/>
                  <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
                    <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.4rem",fontWeight:300,color:result.confidence.band,lineHeight:1}}>{result.confidence.score}%</div>
                    <div style={{fontSize:"0.42rem",color:C.textDim,fontFamily:"monospace",letterSpacing:"0.06em",marginTop:"0.15rem"}}>CONFIDENCE</div>
                  </div>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.3rem,4vw,1.9rem)",color:verdictColor,lineHeight:1.1,marginBottom:"0.3rem",fontWeight:300}}>{result.verdict}</div>
                  <div style={{fontSize:"0.82rem",color:C.textMid,lineHeight:1.6,fontWeight:300,marginBottom:"0.4rem"}}>{result.verdictSub}</div>
                  <div style={{fontSize:"0.75rem",color:result.confidence.band,fontWeight:300,fontStyle:"italic"}}>{result.confidence.reason}</div>
                </div>
              </div>
              {budgetStatement&&<div style={{background:overrunCost>0?C.danger+"10":C.green+"10",border:"1px solid "+(overrunCost>0?C.danger:C.green)+"25",borderRadius:C.radiusSm,padding:"0.65rem 0.9rem",marginBottom:"1rem",fontSize:"0.88rem",color:C.text,lineHeight:1.65,fontWeight:300}}>
                <span style={{color:overrunCost>0?C.danger:C.green,fontWeight:600}}>{overrunCost>0?"Budget overrun. ":"Within budget. "}</span>{budgetStatement}
              </div>}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1rem"}}>
                {[{label:"Projected finish",val:fmtDate(result.projectDuration,true)},{label:"Task days",val:result.projectDuration+" days"},{label:"Buffer",val:result.bufferDays>=0?result.bufferDays+" days":Math.abs(result.bufferDays)+" days over"}].map(({label,val})=>(
                  <div key={label}>
                    <div style={{fontSize:"0.58rem",color:C.textDim,fontFamily:"monospace",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"0.2rem"}}>{label}</div>
                    <div style={{fontFamily:"'Fraunces',serif",fontSize:"1rem",color:C.text,fontWeight:300}}>{val}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <STitle color={C.green}>Your plan as entered</STitle>
              <ModeNote/>
              <SingleGanttChart tasks={data.tasks} result={result} startDate={data.startDate} dayMode={dayMode}/>
            </Card>

            <Card>
              <STitle>Critical path</STitle>
              <p style={{fontSize:"0.82rem",color:C.textDim,marginBottom:"0.85rem",lineHeight:1.6,fontWeight:300}}>A slip in any one cascades into everything that follows.</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem",alignItems:"center"}}>
                {result.criticalPath.map((name,i)=>(
                  <span key={i} style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
                    <span style={{background:C.greenDim,border:"1px solid "+C.greenMid,borderRadius:"100px",color:C.green,fontSize:"0.75rem",padding:"0.2rem 0.7rem",fontWeight:500}}>{name}</span>
                    {i<result.criticalPath.length-1&&<span style={{color:C.green,opacity:0.35}}>→</span>}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── TAB 1: PATHFLO EXECUTION FORECAST ── */}
        {activeTab===1&&(
          <div style={{animation:"fadeUp 0.3s ease both"}}>
            {optResult&&daysDiff>0?(
              <Card style={{border:"1px solid "+C.green,boxShadow:"0 0 0 1px "+C.green+"30,0 16px 60px rgba(0,0,0,0.5)",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,transparent,#3ECB6F,transparent)"}}/>
                <div style={{display:"flex",gap:"1.5rem",alignItems:"center",marginBottom:"1.25rem"}}>
                  <div style={{position:"relative",flexShrink:0}}>
                    <ConfidenceRing score={optResult.confidence.score} band={optResult.confidence.band} size={88}/>
                    <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
                      <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.4rem",fontWeight:300,color:optResult.confidence.band,lineHeight:1}}>{optResult.confidence.score}%</div>
                      <div style={{fontSize:"0.42rem",color:C.textDim,fontFamily:"monospace",letterSpacing:"0.06em",marginTop:"0.15rem"}}>CONFIDENCE</div>
                    </div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.3rem,4vw,1.9rem)",color:C.green,lineHeight:1.1,marginBottom:"0.3rem",fontWeight:300}}>{daysDiff} days recovered. {scoreDiff>0?scoreDiff+"% more confidence.":""}</div>
                    <div style={{fontSize:"0.82rem",color:C.textMid,lineHeight:1.6,fontWeight:300,marginBottom:"0.4rem"}}>
                      Projected finish moves from <strong style={{color:C.text}}>{fmtDate(result.projectDuration,false)}</strong> to <strong style={{color:C.green}}>{fmtDate(optResult.projectDuration,false)}</strong> — at zero additional cost.
                    </div>
                    <div style={{fontSize:"0.75rem",color:C.green,fontWeight:300,fontStyle:"italic"}}>{scoreDiff>0?scoreDiff+"% confidence gain through scheduling changes alone.":"Same timeline, improved structure."}</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem"}}>
                  <div style={{background:C.danger+"08",border:"1px solid "+C.danger+"20",borderRadius:C.radiusSm,padding:"0.85rem 1rem"}}>
                    <div style={{fontSize:"0.58rem",color:C.danger,fontFamily:"monospace",letterSpacing:"0.08em",marginBottom:"0.3rem"}}>YOUR PLAN</div>
                    <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.05rem",color:C.text,fontWeight:300,marginBottom:"0.15rem"}}>{fmtDate(result.projectDuration,true)}</div>
                    <div style={{fontSize:"0.72rem",color:C.textDim}}>{result.confidence.score}% confidence · {result.verdict}</div>
                  </div>
                  <div style={{background:C.greenDim,border:"1px solid "+C.greenMid,borderRadius:C.radiusSm,padding:"0.85rem 1rem"}}>
                    <div style={{fontSize:"0.58rem",color:C.green,fontFamily:"monospace",letterSpacing:"0.08em",marginBottom:"0.3rem"}}>PATHFLO FORECAST</div>
                    <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.05rem",color:C.text,fontWeight:300,marginBottom:"0.15rem"}}>{fmtDate(optResult.projectDuration,true)}</div>
                    <div style={{fontSize:"0.72rem",color:C.green}}>{optResult.confidence.score}% confidence · {optResult.verdict}</div>
                  </div>
                </div>
              </Card>
            ):(
              <Card>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.2rem",fontWeight:300,color:C.green,marginBottom:"0.4rem"}}>Your plan is already well structured.</div>
                <p style={{fontSize:"0.88rem",color:C.textMid,lineHeight:1.7,fontWeight:300}}>No significant parallelization opportunities found. See the Diagnosis tab for risk reduction recommendations.</p>
              </Card>
            )}

            <Card>
              <STitle color={C.green}>Plan comparison</STitle>
              <p style={{fontSize:"0.82rem",color:C.textDim,marginBottom:"0.75rem",lineHeight:1.6,fontWeight:300}}>
                <span style={{color:C.danger,fontWeight:600}}>Red bars</span> = your plan. <span style={{color:C.green,fontWeight:600}}>Green bars</span> = Pathflo's forecast. Where green shifts left, time is recovered.
              </p>
              <div style={{display:"flex",gap:"1.5rem",marginBottom:"1rem",flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}><div style={{width:24,height:10,background:C.danger,borderRadius:3,opacity:0.65}}/><span style={{fontSize:"0.75rem",color:C.textMid,fontWeight:500}}>Your plan</span></div>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}><div style={{width:24,height:10,background:C.green,borderRadius:3}}/><span style={{fontSize:"0.75rem",color:C.textMid,fontWeight:500}}>Pathflo: Execution Forecast</span></div>
              </div>
              <ModeNote/>
              <CompareGanttChart origTasks={data.tasks} origResult={result} optTasks={optResult?buildOptimizedTasks(data.tasks,result.shuffleOps):data.tasks} optResult={optResult||result} startDate={data.startDate} dayMode={dayMode}/>

              {/* FINISH SUMMARY CARDS — always legible, never overlap */}
              {optResult&&daysDiff>0&&(
                <>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem",marginTop:"1.25rem"}}>
                    <div style={{background:C.danger+"06",border:"1px solid "+C.danger+"25",borderRadius:"12px",padding:"1rem 1.1rem"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.5rem"}}>
                        <div style={{width:18,height:3,background:C.danger,borderRadius:2,flexShrink:0}}/>
                        <div style={{fontSize:"0.62rem",color:C.danger,fontFamily:"monospace",letterSpacing:"0.1em",fontWeight:600}}>YOUR FINISH</div>
                      </div>
                      <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.1rem",fontWeight:300,color:C.text,marginBottom:"0.2rem"}}>{fmtDate(result.projectDuration,true)}</div>
                      <div style={{fontSize:"0.75rem",color:C.textMid,fontWeight:300}}>{result.projectDuration} task days · {result.confidence.score}% confidence</div>
                    </div>
                    <div style={{background:C.green+"08",border:"1px solid "+C.green+"30",borderRadius:"12px",padding:"1rem 1.1rem"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.5rem"}}>
                        <div style={{width:18,height:3,background:C.green,borderRadius:2,flexShrink:0}}/>
                        <div style={{fontSize:"0.62rem",color:C.green,fontFamily:"monospace",letterSpacing:"0.1em",fontWeight:600}}>PATHFLO FINISH</div>
                      </div>
                      <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.1rem",fontWeight:300,color:C.green,marginBottom:"0.2rem"}}>{fmtDate(optResult.projectDuration,true)}</div>
                      <div style={{fontSize:"0.75rem",color:C.textMid,fontWeight:300}}>{optResult.projectDuration} task days · {optResult.confidence.score}% confidence</div>
                    </div>
                  </div>
                  <div style={{marginTop:"0.75rem",background:C.greenDim,border:"1px solid "+C.greenMid,borderRadius:"10px",padding:"0.75rem 1.1rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.75rem"}}>
                    <div style={{width:18,height:3,background:C.danger,borderRadius:2,opacity:0.6}}/>
                    <div style={{fontFamily:"'Fraunces',serif",fontSize:"0.95rem",fontWeight:300,color:C.green}}>{daysDiff} days recovered{scoreDiff>0?" · "+scoreDiff+"% more confidence":""}</div>
                    <div style={{width:18,height:3,background:C.green,borderRadius:2}}/>
                  </div>
                </>
              )}

              {/* What changed */}
              {changes.length>0&&(
                <div style={{marginTop:"1.25rem",paddingTop:"1.25rem",borderTop:"1px solid "+C.border,display:"flex",flexDirection:"column",gap:"0.5rem"}}>
                  <div style={{fontSize:"0.65rem",color:C.textDim,fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:"0.25rem"}}>WHAT PATHFLO CHANGED</div>
                  {changes.map((c,i)=>(
                    <div key={i} style={{display:"flex",gap:"0.6rem",fontSize:"0.84rem",color:i===changes.length-1?C.green:C.text,lineHeight:1.6,fontWeight:i===changes.length-1?600:300}}>
                      <span style={{color:C.green,flexShrink:0,fontWeight:700}}>{i===changes.length-1?"→":"✓"}</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── TAB 2: DIAGNOSIS ── */}
        {activeTab===2&&(
          <div style={{animation:"fadeUp 0.3s ease both"}}>
            <Card>
              <STitle color={result.confidence.band}>Confidence score breakdown — {result.confidence.score}%</STitle>
              <p style={{fontSize:"0.82rem",color:C.textDim,marginBottom:"1rem",lineHeight:1.6,fontWeight:300}}>Seven factors across three pillars.</p>
              <div style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>
                {result.confidence.breakdown.map((f,i)=>(
                  <div key={i}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.25rem"}}>
                      <span style={{fontSize:"0.82rem",color:C.textMid,fontWeight:300,textTransform:"capitalize"}}>{f.name}</span>
                      <span style={{fontSize:"0.75rem",fontFamily:"monospace",color:f.score<40?C.danger:f.score<65?C.warn:C.green}}>{f.score}/100 · {f.weight}%</span>
                    </div>
                    <div style={{height:5,background:C.border,borderRadius:3}}>
                      <div style={{height:"100%",width:f.score+"%",background:f.score<40?C.danger:f.score<65?C.warn:C.green,borderRadius:3,transition:"width 0.8s ease"}}/>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <STitle color={{TIME:C.warn,SCOPE:C.info,BUDGET:C.danger}[result.primaryConstraint]||C.green}>What's driving the pressure</STitle>
              <p style={{fontSize:"0.95rem",color:C.text,lineHeight:1.75,marginBottom:"0.75rem",fontWeight:300}}>Every project has one dominant constraint. Yours is <strong style={{color:{TIME:C.warn,SCOPE:C.info,BUDGET:C.danger}[result.primaryConstraint]}}>{result.primaryConstraint}</strong>.</p>
              <p style={{fontSize:"0.88rem",color:C.textMid,lineHeight:1.7,fontWeight:300,marginBottom:"1.25rem"}}>{result.primaryReason}</p>
              <div style={{display:"flex",gap:"0.5rem",marginBottom:"1.5rem",flexWrap:"wrap"}}>
                {["SCOPE","TIME","BUDGET"].map(k=>{const isActive=k===result.primaryConstraint;const col={TIME:C.warn,SCOPE:C.info,BUDGET:C.danger}[k];return <div key={k} style={{background:isActive?col+"15":C.surface2,border:"1px solid "+(isActive?col:C.border),borderRadius:"100px",padding:"0.3rem 1rem",fontSize:"0.72rem",fontWeight:isActive?700:400,color:isActive?col:C.textDim,letterSpacing:"0.06em"}}>{k}{isActive?" ←":""}</div>;})}
              </div>
              <Divider/>
              <div style={{display:"flex",flexDirection:"column",gap:"1.25rem",marginBottom:"1.5rem"}}>
                {[{color:C.info,text:result.scopeMove},{color:C.warn,text:result.timeMove},{color:C.danger,text:result.budgetMove}].map(({color,text},i)=>(
                  <p key={i} style={{fontSize:"0.9rem",color:C.textMid,lineHeight:1.75,fontWeight:300,paddingLeft:"1rem",borderLeft:"2px solid "+color+"50"}}>{text}</p>
                ))}
              </div>
              <Divider/>
              <div style={{background:C.greenDim,border:"1px solid "+C.greenMid,borderRadius:C.radiusSm,padding:"1rem 1.1rem"}}>
                <div style={{fontSize:"0.72rem",fontWeight:600,color:C.green,marginBottom:"0.4rem",letterSpacing:"0.04em"}}>Our recommendation</div>
                <p style={{fontSize:"0.9rem",color:C.text,lineHeight:1.7,fontWeight:300}}>{result.recommendedMove}</p>
              </div>
            </Card>
            {result.shuffleOps.length>0&&(
              <Card>
                <STitle color={C.warn}>Ways to reorder and save time</STitle>
                <p style={{fontSize:"0.82rem",color:C.textDim,marginBottom:"1rem",lineHeight:1.6,fontWeight:300}}>These milestones can run simultaneously without breaking any dependencies.</p>
                {result.shuffleOps.map((op,i)=>(
                  <div key={i} style={{padding:"1rem 0",borderBottom:i<result.shuffleOps.length-1?"1px solid "+C.border:"none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:"0.35rem"}}>
                      <div style={{fontSize:"0.9rem",fontWeight:600,color:C.text}}>{op.task}</div>
                      <div style={{fontSize:"0.72rem",color:C.warn,fontFamily:"monospace",marginLeft:"1rem",flexShrink:0}}>~{op.daysSaved}d back</div>
                    </div>
                    <p style={{fontSize:"0.84rem",color:C.textMid,lineHeight:1.65,fontWeight:300}}>{op.reason}</p>
                  </div>
                ))}
              </Card>
            )}
            {result.bottlenecks.length>0&&(
              <Card>
                <STitle>Where delays are most likely to hit</STitle>
                <p style={{fontSize:"0.82rem",color:C.textDim,marginBottom:"1rem",lineHeight:1.6,fontWeight:300}}>Zero buffer. Anything upstream running late pushes these and everything after them.</p>
                {result.bottlenecks.map((t,i)=>(
                  <div key={i} style={{padding:"0.85rem 0",borderBottom:i<result.bottlenecks.length-1?"1px solid "+C.border:"none",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontSize:"0.9rem",fontWeight:600,color:C.text,marginBottom:"0.2rem"}}>{t.name}</div>
                      <div style={{fontSize:"0.78rem",color:C.textDim}}>{t.owner} · {t.days} days · no buffer{t.dependents>0?" · "+t.dependents+" milestone"+(t.dependents>1?"s":"")+" waiting":""}</div>
                    </div>
                    <div style={{fontSize:"0.65rem",color:C.warn,fontFamily:"monospace",flexShrink:0,marginLeft:"1rem"}}>Day {t.es+1}</div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {/* ── TAB 3: FINANCIALS ── */}
        {activeTab===3&&hasBudget&&(
          <div style={{animation:"fadeUp 0.3s ease both"}}>
            <Card>
              <STitle color={overrunCost>0?C.danger:C.green}>Budget picture</STitle>
              {budgetStatement&&<p style={{fontSize:"0.95rem",color:C.text,lineHeight:1.75,marginBottom:"1.25rem",fontWeight:300}}><strong style={{color:overrunCost>0?C.danger:C.green}}>{overrunCost>0?"Budget overrun. ":"Within budget. "}</strong>{budgetStatement}</p>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem",marginBottom:"1.5rem"}}>
                {[{label:"Total budget",val:data.totalBudget,color:C.text},{label:"Mapped costs",val:totalTaskCost>0?"$"+totalTaskCost.toLocaleString():"Not entered",color:C.text},{label:"Daily burn",val:dailyBurn>0?"$"+Math.round(dailyBurn).toLocaleString()+"/day":"N/A",color:C.textMid},{label:"Overrun exposure",val:overrunCost>0?"$"+Math.round(overrunCost).toLocaleString():"None projected",color:overrunCost>0?C.danger:C.green}].map(({label,val,color})=>(
                  <div key={label} style={{background:C.surface2,border:"1px solid "+C.border,borderRadius:C.radiusSm,padding:"0.85rem 1rem"}}>
                    <div style={{fontSize:"0.6rem",color:C.textDim,fontFamily:"monospace",letterSpacing:"0.08em",marginBottom:"0.3rem"}}>{label.toUpperCase()}</div>
                    <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.1rem",color,fontWeight:300}}>{val}</div>
                  </div>
                ))}
              </div>
              {data.tasks.filter(t=>t.cost).length>0&&(<><Divider/><STitle>Cost by milestone</STitle>
              <div style={{display:"flex",flexDirection:"column",gap:"0.6rem",marginTop:"0.75rem"}}>
                {data.tasks.filter(t=>t.cost).map((t,i)=>{const cost=parseFloat((t.cost||"0").replace(/[^0-9.]/g,""))||0;const pct=totalTaskCost>0?cost/totalTaskCost:0;return(<div key={i}><div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.3rem"}}><span style={{fontSize:"0.84rem",color:C.textMid,fontWeight:300}}>{t.name}</span><span style={{fontSize:"0.84rem",color:C.text,fontFamily:"monospace"}}>{t.cost}</span></div><div style={{height:5,background:C.border,borderRadius:3}}><div style={{height:"100%",width:(pct*100)+"%",background:C.green,borderRadius:3}}/></div></div>);})}
              </div></>)}
            </Card>
          </div>
        )}

        {/* ── TAB 4: READOUT ── */}
        {activeTab===4&&(
          <div style={{animation:"fadeUp 0.3s ease both"}}>
            <Card>
              <STitle color="#85D44A">Leadership readout</STitle>
              <p style={{fontSize:"0.82rem",color:C.textDim,marginBottom:"1.25rem",lineHeight:1.6,fontWeight:300}}>Written to be forwarded. Copy and paste into an email, Slack, or client update.</p>
              {aiLoading?(<div style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"1rem 0"}}><span style={{fontSize:"0.72rem",color:C.textDim,fontWeight:300}}>Writing your readout</span>{[0,1,2].map(i=><span key={i} style={{width:4,height:4,background:C.green,borderRadius:"50%",display:"inline-block",animation:"dotBlink 1.4s "+(i*0.22)+"s infinite"}}/>)}</div>):aiReadout?(<div style={{fontSize:"0.95rem",color:C.text,lineHeight:1.9,fontWeight:300,fontFamily:"'Fraunces',serif"}}>{aiReadout}</div>):(<p style={{fontSize:"0.88rem",color:C.textDim,fontStyle:"italic",fontWeight:300}}>Add your Anthropic API key in Vercel environment variables to enable the AI readout.</p>)}
            </Card>
          </div>
        )}

        {/* ── TAB 5: DETAILS ── */}
        {activeTab===5&&(
          <div style={{animation:"fadeUp 0.3s ease both"}}>
            <Card>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
                <STitle style={{marginBottom:0}}>All milestones</STitle>
                <button onClick={()=>{const rows=[["Milestone","Owner","Duration (days)","Forecast Start","Forecast End","Actual Start","Actual End","Buffer","Critical Path"],...result.tasks.map(t=>[t.name,t.owner||"Unassigned",t.days,fmtDate(t.es,false),fmtDate(t.ef,false),"","",t.slack===0?"No buffer":t.slack+"d spare",result.criticalPath.includes(t.name)?"Yes":"No"])];const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=(data.name||"pathflo-plan").replace(/\s+/g,"-").toLowerCase()+"-forecast.csv";a.click();URL.revokeObjectURL(url);}} style={{background:C.greenDim,border:"1px solid "+C.greenMid,borderRadius:"100px",color:C.green,fontFamily:"inherit",fontSize:"0.75rem",fontWeight:600,padding:"0.4rem 1rem",cursor:"pointer"}}>↓ Download forecast CSV</button>
              </div>
              <p style={{fontSize:"0.75rem",color:C.textDim,marginBottom:"1rem",lineHeight:1.5,fontWeight:300}}>Forecast dates per milestone based on current day mode. Fill in actual dates as work progresses.</p>
              {result.tasks.map((t,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.6rem 0",borderBottom:i<result.tasks.length-1?"1px solid "+C.border:"none",gap:"0.75rem"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"0.88rem",color:t.slack===0?C.green:C.text,fontWeight:t.slack===0?600:400,marginBottom:"0.15rem"}}>{t.slack===0&&<span style={{marginRight:"0.35rem",opacity:0.7}}>⬡</span>}{t.name}</div>
                    <div style={{fontSize:"0.72rem",color:C.textDim}}>{t.owner} · {t.days} days · {fmtDate(t.es,false)} → {fmtDate(t.ef,false)}</div>
                  </div>
                  <span style={{fontSize:"0.62rem",fontFamily:"monospace",borderRadius:4,padding:"0.12rem 0.5rem",flexShrink:0,background:t.slack===0?"#FB923C":C.green,color:"#080A08"}}>{t.slack===0?"no buffer":t.slack+"d spare"}</span>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div style={{minHeight:"100vh",background:"#080A08",display:"flex",alignItems:"center",justifyContent:"center",color:"#8A9E8A",fontFamily:"system-ui"}}>Building your execution forecast...</div>}>
      <ResultsContent/>
    </Suspense>
  );
}
