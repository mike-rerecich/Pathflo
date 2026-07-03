"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";

const G = "#3ECB6F";
const PALETTE = ["#3ECB6F","#3B82F6","#8B5CF6","#14B8A6","#F59E0B","#EC4899"];

function hex2rgb(hex) {
  return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
}

const T = {
  bg:"#080A08", surface:"#0D1117", surface2:"#111519",
  border:"#1C2128", border2:"#252D25",
  text:"#EEF2EE", textMid:"#8A9E8A", textDim:"#3E4E3E",
  green:G, greenDim:"#0A1F12", greenMid:"#1A4A28",
  red:"#EF4444", amber:"#F59E0B",
};

/* ─── BackgroundField ─────────────────────────────────────────── */
function BackgroundField() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId, W, H;
    const resize = () => { W=canvas.width=canvas.offsetWidth; H=canvas.height=canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    const systems = PALETTE.map((col, idx) => ({
      x: ((idx%3)+0.5+Math.random()*0.4) * ((W||900)/3),
      y: ((Math.floor(idx/3))+0.5+Math.random()*0.3) * ((H||700)/2),
      burst: Math.random()*200,
      rgb: hex2rgb(col),
      orbs: Array.from({length:3+Math.floor(Math.random()*3)}, (_,j) => ({
        angle: Math.random()*Math.PI*2,
        r: 14+j*12, size: 0.5+Math.random()*1.1, speed: 0.0007+Math.random()*0.002,
        alpha: 0.15+Math.random()*0.35,
        rgb: hex2rgb(PALETTE[Math.floor(Math.random()*PALETTE.length)]),
      })),
    }));

    const mesh = Array.from({length:18}, () => ({
      x:Math.random()*(W||900), y:Math.random()*(H||700),
      vx:(Math.random()-0.5)*0.18, vy:(Math.random()-0.5)*0.18,
      rgb:hex2rgb(PALETTE[Math.floor(Math.random()*PALETTE.length)]),
    }));

    const draw = () => {
      ctx.clearRect(0,0,W,H);
      for(let i=0;i<mesh.length;i++) {
        const p=mesh[i]; p.x+=p.vx; p.y+=p.vy;
        if(p.x<0||p.x>W) p.vx*=-1; if(p.y<0||p.y>H) p.vy*=-1;
        for(let j=i+1;j<mesh.length;j++) {
          const q=mesh[j]; const d=Math.hypot(p.x-q.x,p.y-q.y);
          if(d<180) { ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y);
            ctx.strokeStyle=`rgba(${p.rgb[0]},${p.rgb[1]},${p.rgb[2]},${(1-d/180)*0.05})`;
            ctx.lineWidth=0.5; ctx.stroke(); }
        }
      }
      systems.forEach(s => {
        s.burst++;
        const [r,g,b]=s.rgb;
        const grd=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,60);
        grd.addColorStop(0,`rgba(${r},${g},${b},0.035)`); grd.addColorStop(1,"transparent");
        ctx.beginPath(); ctx.arc(s.x,s.y,60,0,Math.PI*2); ctx.fillStyle=grd; ctx.fill();
        s.orbs.forEach(o => {
          o.angle+=o.speed;
          const px=s.x+Math.cos(o.angle)*o.r, py=s.y+Math.sin(o.angle)*o.r;
          const [or,og,ob]=o.rgb;
          ctx.beginPath(); ctx.arc(px,py,o.size,0,Math.PI*2);
          ctx.fillStyle=`rgba(${or},${og},${ob},${o.alpha})`; ctx.fill();
        });
      });
      animId=requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  },[]);
  return <canvas ref={canvasRef} style={{position:"fixed",inset:0,width:"100%",height:"100%",zIndex:0,pointerEvents:"none",opacity:0.55}}/>;
}

/* ─── Logo ────────────────────────────────────────────────────── */
const Logo = ({ size=18 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <path d="M4 24 C8 24 10 14 15 14 C20 14 22 6 26 6 C29 6 30 12 31 14" stroke={G} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
    <circle cx="4" cy="24" r="3" fill={G}/>
    <circle cx="31" cy="14" r="2.5" fill={G} opacity="0.9"/>
  </svg>
);

/* ─── PlanCard ────────────────────────────────────────────────── */
function PlanCard({ tasks }) {
  if (!tasks.length) return null;
  return (
    <div style={{background:T.surface2,border:"1px solid "+T.border,borderRadius:12,padding:"0.85rem 1rem",marginBottom:"0.85rem"}}>
      <div style={{fontSize:"0.58rem",color:G,fontWeight:700,letterSpacing:"0.12em",marginBottom:"0.5rem"}}>
        YOUR PLAN — {tasks.length} MILESTONE{tasks.length!==1?"S":""}
      </div>
      {tasks.map((t,i) => (
        <div key={t.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.3rem 0",borderBottom:i<tasks.length-1?"1px solid "+T.border:"none"}}>
          <span style={{fontSize:"0.65rem",color:T.textDim,minWidth:18}}>{i+1}.</span>
          <span style={{color:T.text,flex:1,fontSize:"0.85rem"}}>{t.name}</span>
          <span style={{fontSize:"0.72rem",color:T.textDim}}>{t.days}d</span>
          {t.owner&&t.owner!=="UNASSIGNED"&&(
            <span style={{fontSize:"0.68rem",color:T.textDim,maxWidth:72,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.owner}</span>
          )}
          {t.predecessors.length>0&&(
            <span style={{fontSize:"0.6rem",color:T.amber,background:T.amber+"15",borderRadius:4,padding:"0.1rem 0.35rem"}}>depends</span>
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
  const [project, setProject] = useState({name:"",startDate:"",targetDate:"",dailyBurnRate:"",deadlineStakes:"",deadlinePenalty:""});
  const [tasks, setTasks] = useState([]);
  const [currentTask, setCurrentTask] = useState({name:"",owner:"",days:0,predecessors:[],concurrent:false,id:""});
  const [pendingPreds, setPendingPreds] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [savedProjects, setSavedProjects] = useState([]);
  const [showSaved, setShowSaved] = useState(false);

  const counter  = useRef(0);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const stageRef  = useRef(stage);
  const tasksRef  = useRef(tasks);
  const curRef    = useRef(currentTask);
  const projRef   = useRef(project);
  const predsRef  = useRef(pendingPreds);

  useEffect(()=>{stageRef.current=stage;},[stage]);
  useEffect(()=>{tasksRef.current=tasks;},[tasks]);
  useEffect(()=>{curRef.current=currentTask;},[currentTask]);
  useEffect(()=>{projRef.current=project;},[project]);
  useEffect(()=>{predsRef.current=pendingPreds;},[pendingPreds]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthUser(user);
      if (user) loadSavedProjects(user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setAuthUser(u);
      if (u) loadSavedProjects(u); else setSavedProjects([]);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadSavedProjects(user) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const res = await fetch("/api/projects", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const json = await res.json();
      setSavedProjects(json.projects || []);
      if (json.projects?.length > 0) setShowSaved(true);
    }
  }

  function loadProject(p) {
    const d = p.data;
    const reviseData = {name:d.name,startDate:d.startDate,targetDate:d.targetDate,dailyBurnRate:d.dailyBurnRate||"",deadlineStakes:d.deadlineStakes||"",deadlinePenalty:d.deadlinePenalty||"",tasks:d.tasks};
    try {
      const id = "pathflo-revise-" + Date.now().toString(36);
      window.sessionStorage.setItem(id, JSON.stringify(reviseData));
      window.location.href = "/app?revise-id=" + id;
    } catch(e) {
      window.location.href = "/app?revise=" + encodeURIComponent(JSON.stringify(reviseData));
    }
  }

  async function deleteProject(id) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch(`/api/projects?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setSavedProjects(p => p.filter(pr => pr.id !== id));
  }

  // ── BOOT ─────────────────────────────────────────────────────────────────────
  useEffect(()=>{
    const url=new URL(window.location.href);
    const reviseId=url.searchParams.get("revise-id");
    const revise=reviseId?window.sessionStorage.getItem(reviseId):url.searchParams.get("revise");
    if(revise){
      try{
        const d=JSON.parse(reviseId?revise:decodeURIComponent(revise));
        setProject({name:d.name||"",startDate:d.startDate||"",targetDate:d.targetDate||"",dailyBurnRate:d.dailyBurnRate||"",deadlineStakes:d.deadlineStakes||"",deadlinePenalty:d.deadlinePenalty||""});
        const loaded=d.tasks||[];
        setTasks(loaded);tasksRef.current=loaded;
        counter.current=loaded.length;
        setProgress(4);setShowPlan(true);setStage("ADD_MORE");
        setTimeout(()=>bot(
          `Welcome back to **${d.name}**.\n\nI've got your ${loaded.length} milestone${loaded.length!==1?"s":""} loaded. What do you want to change?`,
          "choice",null,
          ["Add a milestone","Remove a milestone","Change the dates","Re-run as-is →"]
        ),300);
        return;
      }catch(e){}
    }
    setStage("INTRO");
    setTimeout(()=>bot(
      "I'm going to map your project, find every dependency, and tell you exactly what's at risk before a single day of work begins.\n\nMost people are surprised by what they find.\n\nFirst — what's this project called?",
      "text","e.g. Office renovation, Website relaunch, Product launch..."
    ),300);
  },[]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages,analyzing]);
  useEffect(()=>{ if(stage!=="ANALYZING") setTimeout(()=>inputRef.current?.focus(),80); },[stage,messages]);

  function bot(text,input,placeholder,choices){
    setMessages(p=>[...p,{from:"bot",text,input:input||"text",placeholder,choices,id:Date.now()+Math.random()}]);
  }
  function usr(text){setMessages(p=>[...p,{from:"user",text,id:Date.now()+Math.random()}]);}
  function handleText(val){if(!val.trim())return;usr(val);setInputVal("");advance(val.trim());}
  function handleChoice(val){usr(val);advance(val);}

  function saveTask(taskData){
    setTasks(p=>{const u=[...p,{...taskData}];tasksRef.current=u;return u;});
    setCurrentTask({name:"",owner:"",days:0,predecessors:[],concurrent:false,id:""});
    setPendingPreds([]);predsRef.current=[];
    setStage("ADD_MORE");setProgress(4);setShowPlan(true);
    const count=tasksRef.current.length;
    const isFirst=count===1;
    const needsMore=count<3;
    setTimeout(()=>{
      if(isFirst){
        bot(
          `**${taskData.name}** is on the board — that's your first milestone.\n\nFor Pathflo to find your critical path and map the risks, I need at least 2 more milestones.\n\nWhat comes next in the project?`,
          "text","e.g. Design phase, Permit approval, Development..."
        );
        setStage("TASK_NAME");
        return;
      }
      bot(
        needsMore
          ?`**${count} milestones mapped.** Keep going — a few more and I'll have enough to show you the full risk picture.`
          :`**${count} milestones mapped.** That's enough for a solid analysis. Add more for higher accuracy, or run it now.`,
        "choice",null,
        needsMore?["Add another milestone"]:["Add another milestone","Run the analysis →"]
      );
    },350);
  }

  function askDeps(taskData){
    setCurrentTask(t=>({...t,...taskData}));
    const tsk=tasksRef.current;
    if(tsk.length===0){saveTask({...taskData,predecessors:[],concurrent:false});return;}
    setStage("TASK_DEPENDS_FIRST");
    const lastTask=tsk[tsk.length-1];
    setTimeout(()=>bot(
      `Before **${taskData.name}** can start — does it need anything else to be finished first?\n\nFor example, does it wait for **${lastTask.name}** to complete, or can it kick off independently?`,
      "choice",null,
      ["It can start any time — no dependencies",...tsk.map(t=>`Waits for: ${t.name}`)]
    ),350);
  }

  function askMoreDeps(taskName,currentPreds){
    const tsk=tasksRef.current;
    const remaining=tsk.filter(t=>!currentPreds.includes(t.id));
    if(!remaining.length){finishDeps(currentPreds);return;}
    setStage("TASK_DEPENDS_MORE");
    setTimeout(()=>bot(
      `Does **${taskName}** also depend on anything else finishing first?`,
      "choice",null,
      ["No — that's its only dependency",...remaining.map(t=>`Also waits for: ${t.name}`)]
    ),350);
  }

  function finishDeps(preds){
    const cur=curRef.current;
    const tsk=tasksRef.current;
    const primaryPred=tsk.find(t=>t.id===preds[0]);
    const predDays=parseInt(primaryPred?.days)||0;
    if(predDays>=4&&preds.length===1){
      setStage("TASK_CONCURRENT");
      setPendingPreds(preds);predsRef.current=preds;
      setTimeout(()=>bot(
        `**${primaryPred.name}** takes ${predDays} days. Can **${cur.name}** begin while **${primaryPred.name}** is still in progress — or does it need to be completely done first?\n\nIf they can overlap even partially, that can save days on your timeline.`,
        "choice",null,
        [`Can start while ${primaryPred.name} is still running`,`Has to wait until ${primaryPred.name} is fully done`]
      ),350);
    }else{
      saveTask({...cur,predecessors:preds,concurrent:false});
    }
  }

  function advance(val){
    const st=stageRef.current;
    const tsk=tasksRef.current;
    const cur=curRef.current;
    switch(st){
      case "INTRO":{
        setProject(p=>({...p,name:val}));
        setStage("START_DATE");
        setTimeout(()=>bot(`**${val}** — I like it.\n\nWhen does work actually start on this?`,"date"),350);
        break;
      }
      case "START_DATE":{
        setProject(p=>({...p,startDate:val}));
        setStage("TARGET_DATE");setProgress(2);
        setTimeout(()=>bot("And what's the deadline — the date it needs to be done?","date"),350);
        break;
      }
      case "TARGET_DATE":{
        setProject(p=>({...p,targetDate:val}));
        setStage("DAILY_BURN");
        setTimeout(()=>bot(
          "What does it cost per day to run this project?\n\nInclude labor, contractors, overhead — whatever stops if the project stops. If you don't track this, enter 0.",
          "text","e.g. $2,500"
        ),350);
        break;
      }
      case "DAILY_BURN":{
        setProject(p=>({...p,dailyBurnRate:val}));
        setStage("DEADLINE_STAKES");
        setTimeout(()=>bot(
          "What happens if you miss the deadline?\n\nThis tells Pathflo what's actually at risk — not just time.",
          "choice",null,
          ["Nothing critical — date is a target","Revenue delay — income shifts right","Contract penalty — financial exposure","Client relationship — trust at stake","Regulatory / legal deadline"]
        ),350);
        break;
      }
      case "DEADLINE_STAKES":{
        setProject(p=>({...p,deadlineStakes:val}));
        const needsDollar=val.includes("penalty")||val.includes("Revenue");
        if(needsDollar){
          setStage("DEADLINE_PENALTY");
          setTimeout(()=>bot("What's the dollar exposure if you miss?\n\nBe specific — Pathflo uses this to weight your risk score.","text","e.g. $15,000"),350);
        }else{goToMilestones();}
        break;
      }
      case "DEADLINE_PENALTY":{
        setProject(p=>({...p,deadlinePenalty:val}));
        goToMilestones();
        break;
      }
      case "TASK_NAME":{
        const id="t"+counter.current++;
        setCurrentTask({name:val,owner:"",days:0,predecessors:[],concurrent:false,id});
        setStage("TASK_DAYS");
        setTimeout(()=>bot(
          `**${val}** — how many working days will this take?\n\nBe realistic here. Pathflo's accuracy depends on honest estimates. If you're not sure, go slightly longer rather than shorter.`,
          "number","e.g. 7"
        ),350);
        break;
      }
      case "TASK_DAYS":{
        const days=Math.max(1,parseInt(val)||1);
        setCurrentTask(t=>({...t,days}));
        setStage("TASK_OWNER");
        setTimeout(()=>bot(
          `Who's responsible for **${cur.name}**?\n\nThis is the person who gets the call if it's running behind.`,
          "choice",null,
          ["Skip — not assigned yet","Enter their name"]
        ),350);
        break;
      }
      case "TASK_OWNER":{
        if(val==="Enter their name"){
          setStage("TASK_OWNER_INPUT");
          setTimeout(()=>bot("Who owns this milestone?","text","e.g. Sarah, Dev team, Marcus..."),350);
        }else{
          const owner=val==="Skip — not assigned yet"?"UNASSIGNED":val;
          setCurrentTask(t=>({...t,owner}));
          askDeps({...curRef.current,owner});
        }
        break;
      }
      case "TASK_OWNER_INPUT":{
        setCurrentTask(t=>({...t,owner:val}));
        askDeps({...curRef.current,owner:val});
        break;
      }
      case "TASK_DEPENDS_FIRST":{
        if(val.startsWith("It can start")){
          saveTask({...cur,predecessors:[],concurrent:false});
        }else{
          const predName=val.replace("Waits for: ","");
          const predTask=tsk.find(t=>t.name===predName);
          if(predTask){
            const newPreds=[predTask.id];
            setPendingPreds(newPreds);predsRef.current=newPreds;
            setCurrentTask(t=>({...t,predecessors:newPreds}));
            askMoreDeps(cur.name,newPreds);
          }
        }
        break;
      }
      case "TASK_DEPENDS_MORE":{
        if(val.startsWith("No")){
          finishDeps(predsRef.current);
        }else{
          const predName=val.replace("Also waits for: ","");
          const predTask=tsk.find(t=>t.name===predName);
          if(predTask){
            const newPreds=[...predsRef.current,predTask.id];
            setPendingPreds(newPreds);predsRef.current=newPreds;
            setCurrentTask(t=>({...t,predecessors:newPreds}));
            askMoreDeps(cur.name,newPreds);
          }
        }
        break;
      }
      case "TASK_CONCURRENT":{
        const isConcurrent=val.startsWith("Can start while");
        saveTask({...cur,predecessors:predsRef.current,concurrent:isConcurrent});
        break;
      }
      case "ADD_MORE":{
        if(val==="Add another milestone"||val==="Add a milestone"){
          setStage("TASK_NAME");
          setTimeout(()=>bot(`Milestone ${tsk.length+1} — what's it called?`,"text","e.g. QA testing, Final inspection, Client sign-off..."),350);
        }else if(val==="Remove a milestone"){
          setStage("REMOVE_TASK");
          setTimeout(()=>bot("Which milestone do you want to remove?","choice",null,tsk.map(t=>`Remove: ${t.name}`)),350);
        }else if(val==="Change the dates"){
          setStage("START_DATE");setProgress(2);
          setTimeout(()=>bot("What's the new start date?","date"),350);
        }else if(val==="Re-run as-is →"||val==="Run the analysis →"){
          runAnalysis();
        }
        break;
      }
      case "REMOVE_TASK":{
        const taskName=val.replace("Remove: ","");
        const removed=tsk.find(t=>t.name===taskName);
        const updated=tsk.filter(t=>t.name!==taskName).map(t=>({...t,predecessors:t.predecessors.filter(pid=>pid!==removed?.id)}));
        setTasks(updated);tasksRef.current=updated;
        setStage("ADD_MORE");
        setTimeout(()=>bot(
          `Removed **${taskName}**. ${updated.length} milestone${updated.length!==1?"s":""} remaining.\n\nWhat next?`,
          "choice",null,
          updated.length>=3?["Add another milestone","Run the analysis →"]:["Add another milestone"]
        ),350);
        break;
      }
    }
  }

  function goToMilestones(){
    setStage("TASK_NAME");setProgress(3);
    setTimeout(()=>bot(
      "Now let's map the milestones.\n\nThink of these as the key phases — the things that have to happen, in order, for this project to get done. Each one becomes a node in your dependency graph.\n\nStart with the very first thing that needs to happen. What is it?",
      "text","e.g. Site survey, Design kickoff, Permit filing..."
    ),350);
  }

  function runAnalysis(){
    if(tasksRef.current.length<2){
      setStage("TASK_NAME");
      setTimeout(()=>bot("I need at least 2 milestones to build a meaningful analysis. What's the next one?","text","e.g. Design phase, Development..."),350);
      return;
    }
    setAnalyzing(true);setStage("ANALYZING");setProgress(5);
    setTimeout(()=>{
      const data={
        name:projRef.current.name,startDate:projRef.current.startDate,targetDate:projRef.current.targetDate,
        dailyBurnRate:projRef.current.dailyBurnRate,deadlineStakes:projRef.current.deadlineStakes,
        deadlinePenalty:projRef.current.deadlinePenalty,tasks:tasksRef.current,
      };
      const serialized=JSON.stringify(data);
      try{
        const analysisId="pathflo-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
        window.sessionStorage.setItem(analysisId,serialized);
        window.location.href="/results?id="+encodeURIComponent(analysisId);
      }catch(err){
        window.location.href="/results?data="+encodeURIComponent(serialized);
      }
    },2400);
  }

  const lastMsg=messages[messages.length-1];
  const showInput=stage!=="ANALYZING"&&lastMsg?.from==="bot"&&lastMsg?.input!=="choice";

  function renderText(text){
    return text.split(/(\n|\*\*[^*]+\*\*)/).map((p,j)=>
      p.startsWith("**")?<strong key={j} style={{color:G}}>{p.slice(2,-2)}</strong>:
      p==="\n"?<br key={j}/>:p
    );
  }

  const stepLabel={
    INTRO:"Project name",START_DATE:"Start date",TARGET_DATE:"Deadline",
    DAILY_BURN:"Daily cost",DEADLINE_STAKES:"Deadline stakes",DEADLINE_PENALTY:"Penalty",
    TASK_NAME:"Milestone name",TASK_DAYS:"Duration",TASK_OWNER:"Owner",
    TASK_OWNER_INPUT:"Owner",TASK_DEPENDS_FIRST:"Dependencies",
    TASK_DEPENDS_MORE:"Dependencies",TASK_CONCURRENT:"Overlap",
    ADD_MORE:"Your plan",REMOVE_TASK:"Remove",ANALYZING:"Analyzing",
  }[stage]||"";

  return (
    <div style={{background:T.bg,minHeight:"100vh",color:T.text,fontFamily:"'DM Sans',system-ui,sans-serif",display:"flex",flexDirection:"column",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&family=Fraunces:ital,wght@0,700;1,300&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes app-fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes app-blink{0%,80%,100%{opacity:0}40%{opacity:1}}
        @keyframes app-pulse{0%,100%{opacity:0.4}50%{opacity:1}}
        @keyframes app-spin{to{transform:rotate(360deg)}}
        @keyframes app-drift{0%,100%{transform:translateY(0) translateX(0)}50%{transform:translateY(-16px) translateX(10px)}}
        @keyframes app-drift2{0%,100%{transform:translateY(0) translateX(0)}50%{transform:translateY(12px) translateX(-10px)}}
        @keyframes app-noiseShift{0%{background-position:0 0}100%{background-position:100px 100px}}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#252D25;border-radius:2px}
        input:focus{outline:none}
        input::placeholder{color:#3E4E3E}
        .app-grain{position:fixed;inset:0;z-index:1;pointer-events:none;opacity:0.022;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size:200px 200px;animation:app-noiseShift 8s linear infinite}
        .app-cbtn{background:${T.surface};border:1px solid ${T.border2};border-radius:100px;color:${T.text};font-family:inherit;font-size:0.86rem;padding:0.65rem 1.1rem;cursor:pointer;text-align:left;transition:all 0.15s;display:flex;align-items:center;gap:0.5rem}
        .app-cbtn:hover{border-color:${G};color:${G};background:${T.greenDim}}
        .app-cbtn-cta{border-color:${T.greenMid};color:${G};font-weight:700}
        .app-cbtn-cta:hover{background:${T.greenDim}}
        .app-ham{display:flex;flex-direction:column;gap:5px;cursor:pointer;padding:4px;border:none;background:transparent;z-index:202;position:relative}
        .app-ham span{display:block;width:20px;height:2px;background:#EEF2EE;border-radius:2px;transition:all 0.28s}
        .app-ham.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
        .app-ham.open span:nth-child(2){opacity:0;transform:scaleX(0)}
        .app-ham.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
        .app-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:199;opacity:0;pointer-events:none;transition:opacity 0.3s;backdrop-filter:blur(4px)}
        .app-backdrop.open{opacity:1;pointer-events:auto}
        .app-drawer{position:fixed;top:0;left:0;bottom:0;width:280px;background:rgba(8,10,8,0.98);z-index:200;display:flex;flex-direction:column;padding:4.5rem 2rem 2rem;border-right:1px solid #1C2128;transform:translateX(-100%);transition:transform 0.32s cubic-bezier(0.4,0,0.2,1);box-shadow:8px 0 40px rgba(0,0,0,0.5)}
        .app-drawer.open{transform:translateX(0)}
        .app-drawer a{font-family:'Fraunces',serif;font-size:1.4rem;font-weight:300;color:#8A9E8A;text-decoration:none;transition:color 0.15s;padding:0.35rem 0}
        .app-drawer a:hover{color:#EEF2EE}
        @media(max-width:640px){.app-chat-pad{padding:0.75rem !important}}
      `}</style>

      <div className="app-grain"/>
      <BackgroundField/>

      {/* Ambient mist */}
      <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-10%",left:"30%",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(62,203,111,0.04) 0%,transparent 65%)",filter:"blur(50px)",animation:"app-drift 30s ease-in-out infinite"}}/>
        <div style={{position:"absolute",top:"50%",right:"-5%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(59,130,246,0.035) 0%,transparent 65%)",filter:"blur(70px)",animation:"app-drift2 25s ease-in-out infinite"}}/>
        <div style={{position:"absolute",bottom:"10%",left:"-5%",width:450,height:450,borderRadius:"50%",background:"radial-gradient(circle,rgba(139,92,246,0.03) 0%,transparent 65%)",filter:"blur(60px)",animation:"app-drift 35s ease-in-out infinite reverse"}}/>
      </div>

      {/* Nav backdrop */}
      <div className={`app-backdrop ${navOpen?"open":""}`} onClick={()=>setNavOpen(false)}/>

      {/* Left drawer */}
      <div className={`app-drawer ${navOpen?"open":""}`}>
        <div style={{display:"flex",flexDirection:"column",gap:"0.4rem",flex:1}}>
          {[["#","How it works"],["#","Why it works"],["#","Pricing"]].map(([href,label])=>(
            <a key={label} href={href} onClick={()=>setNavOpen(false)}>{label}</a>
          ))}
          <a href="/" onClick={()=>setNavOpen(false)}>← Back to home</a>
        </div>
        <a href="/app" onClick={()=>setNavOpen(false)} style={{display:"block",background:G,color:"#080A08",border:"none",borderRadius:"100px",fontFamily:"'DM Sans',system-ui",fontWeight:700,fontSize:"0.95rem",padding:"0.9rem 1.5rem",textAlign:"center",marginTop:"1.5rem"}}>New project</a>
      </div>

      {/* Top bar */}
      <div style={{
        position:"sticky",top:0,zIndex:100,
        background:"rgba(8,10,8,0.94)",backdropFilter:"blur(20px)",
        borderBottom:"1px solid "+T.border,padding:"0 1.25rem",height:58,
        display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,
        position:"relative",
      }}>
        <button className={`app-ham ${navOpen?"open":""}`} onClick={()=>setNavOpen(o=>!o)} aria-label="Menu">
          <span/><span/><span/>
        </button>

        {/* Logo centered */}
        <a href="/" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:"0.45rem",position:"absolute",left:"50%",transform:"translateX(-50%)"}}>
          <Logo size={20}/>
          <span style={{fontWeight:700,fontSize:"1rem",color:T.text}}>Path<span style={{color:G}}>flo</span></span>
        </a>

        {/* Progress right */}
        <div style={{display:"flex",alignItems:"center",gap:"0.6rem"}}>
          {stepLabel&&(
            <span style={{fontSize:"0.58rem",color:T.textDim,letterSpacing:"0.08em",fontFamily:"'DM Mono',monospace",display:"none",["@media(min-width:480px)"]:{}}}>{stepLabel.toUpperCase()}</span>
          )}
          <div style={{display:"flex",gap:3}}>
            {Array.from({length:5}).map((_,i)=>(
              <div key={i} style={{width:i<progress?18:5,height:4,borderRadius:2,background:i<progress?G:T.border,transition:"all 0.35s ease",boxShadow:i<progress?`0 0 5px ${G}55`:undefined}}/>
            ))}
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="app-chat-pad" style={{flex:1,overflowY:"auto",padding:"1.25rem",maxWidth:600,width:"100%",margin:"0 auto",position:"relative",zIndex:2}}>

        {/* Saved projects panel — visible when signed in */}
        {authUser && savedProjects.length > 0 && (
          <div style={{ marginBottom: "1.25rem", animation: "app-fadeUp 0.3s ease both" }}>
            <button onClick={() => setShowSaved(v => !v)} style={{ background: "none", border: "none", color: T.textMid, fontFamily: "inherit", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", padding: "0 0 0.4rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              ⬇ YOUR SAVED PROJECTS ({savedProjects.length}) {showSaved ? "▴" : "▾"}
            </button>
            {showSaved && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {savedProjects.map(p => (
                  <div key={p.id} style={{ background: T.surface, border: "1px solid " + T.border, borderRadius: 10, padding: "0.65rem 0.85rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.88rem", fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: "0.65rem", color: T.textDim, marginTop: "0.1rem" }}>
                        {p.data?.tasks?.length || 0} milestones · {p.data?.targetDate ? new Date(p.data.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                      </div>
                    </div>
                    <button onClick={() => loadProject(p)} style={{ background: T.greenDim, border: "1px solid " + T.greenMid, borderRadius: 7, color: T.green, fontFamily: "inherit", fontWeight: 700, fontSize: "0.72rem", padding: "0.35rem 0.75rem", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>Load →</button>
                    <button onClick={() => deleteProject(p.id)} title="Delete" style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: "0.75rem", padding: "0.2rem", flexShrink: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg,i)=>(
          <div key={msg.id} style={{marginBottom:"0.75rem",display:"flex",justifyContent:msg.from==="user"?"flex-end":"flex-start",animation:"app-fadeUp 0.22s ease both"}}>
            {msg.from==="bot"&&(
              <div style={{maxWidth:"92%"}}>
                <div style={{background:T.surface,border:"1px solid "+T.border2,borderRadius:"16px 16px 16px 4px",padding:"0.9rem 1.1rem",fontSize:"0.9rem",lineHeight:1.75,color:T.text}}>
                  {renderText(msg.text)}
                </div>
                {i===messages.length-1&&msg.input==="choice"&&msg.choices&&stage!=="ANALYZING"&&(
                  <div style={{display:"flex",flexDirection:"column",gap:"0.35rem",marginTop:"0.45rem"}}>
                    {msg.choices.map(c=>{
                      const isCTA=c.includes("Run the analysis")||c.includes("Re-run");
                      return(
                        <button key={c} className={`app-cbtn${isCTA?" app-cbtn-cta":""}`} onClick={()=>handleChoice(c)}>
                          {isCTA&&<span style={{fontSize:"0.8rem"}}>⚡</span>}{c}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {msg.from==="user"&&(
              <div style={{background:T.greenDim,border:"1.5px solid "+T.greenMid,borderRadius:"16px 16px 4px 16px",padding:"0.65rem 0.95rem",maxWidth:"80%",fontSize:"0.88rem",color:G,lineHeight:1.5}}>
                {msg.text}
              </div>
            )}
          </div>
        ))}

        {showPlan&&tasks.length>0&&stage==="ADD_MORE"&&(
          <div style={{animation:"app-fadeUp 0.3s ease both"}}><PlanCard tasks={tasks}/></div>
        )}

        {analyzing&&(
          <div style={{padding:"1.5rem 0"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.6rem",marginBottom:"1rem"}}>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:"0.65rem",color:G,letterSpacing:"0.14em"}}>BUILDING YOUR EXECUTION INTELLIGENCE</span>
              {[0,1,2].map(i=><span key={i} style={{width:5,height:5,background:G,borderRadius:"50%",display:"inline-block",animation:`app-blink 1.4s ${i*0.22}s infinite`}}/>)}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
              {[
                {label:"Mapping your dependency chain",delay:0},
                {label:"Running critical path analysis",delay:0.3},
                {label:"Calculating cascade risks",delay:0.6},
                {label:"Scoring on-time delivery confidence",delay:0.9},
                {label:"Finding scheduling optimizations",delay:1.2},
                {label:"Generating your intelligence report",delay:1.5},
              ].map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:"0.55rem",fontSize:"0.8rem",color:T.textMid,animation:`app-fadeUp 0.4s ${s.delay}s ease both`,opacity:0,animationFillMode:"forwards"}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:G,flexShrink:0,animation:`app-pulse 1.8s ${s.delay+0.2}s infinite`}}/>
                  {s.label}
                </div>
              ))}
            </div>
            <div style={{marginTop:"1.5rem",padding:"0.85rem 1rem",background:T.surface,border:"1px solid "+T.border,borderRadius:12,fontSize:"0.82rem",color:T.textDim,lineHeight:1.65}}>
              Pathflo is mapping every dependency and running the critical path. Most users are surprised by what it finds.
            </div>
          </div>
        )}

        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      {showInput&&(
        <div style={{padding:"0.8rem 1.25rem",borderTop:"1px solid "+T.border,background:"rgba(8,10,8,0.96)",backdropFilter:"blur(16px)",position:"sticky",bottom:0,zIndex:10}}>
          <div style={{maxWidth:600,margin:"0 auto",display:"flex",gap:"0.45rem"}}>
            <input
              ref={inputRef}
              type={lastMsg?.input==="number"?"number":lastMsg?.input==="date"?"date":"text"}
              value={inputVal}
              onChange={e=>setInputVal(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleText(inputVal)}
              placeholder={lastMsg?.placeholder||"Type your answer..."}
              min={lastMsg?.input==="number"?1:undefined}
              style={{flex:1,background:T.surface,border:"1px solid "+T.border2,borderRadius:100,color:T.text,fontFamily:"'DM Sans',inherit",fontSize:"0.9rem",padding:"0.72rem 1.25rem",transition:"border-color 0.2s,box-shadow 0.2s"}}
              onFocus={e=>{e.target.style.borderColor=G;e.target.style.boxShadow=`0 0 0 3px ${G}18`;}}
              onBlur={e=>{e.target.style.borderColor=T.border2;e.target.style.boxShadow="none";}}
            />
            <button onClick={()=>handleText(inputVal)} style={{background:G,color:"#080A08",border:"none",borderRadius:100,fontFamily:"inherit",fontWeight:700,fontSize:"0.9rem",padding:"0.72rem 1.2rem",cursor:"pointer",flexShrink:0,boxShadow:`0 0 14px ${G}44`,transition:"transform 0.15s,box-shadow 0.15s"}}
              onMouseEnter={e=>{e.target.style.transform="scale(1.05)";}}
              onMouseLeave={e=>{e.target.style.transform="scale(1)";}}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}
