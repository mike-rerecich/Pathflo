"use client";
import { useState, useEffect, useRef, useMemo } from "react";

/* Brand tokens — see brand/Brand.md, the single source of truth for these values */
const BRAND = "#3ECB6F";       // large fills, icons, highlights — never text on white (2.1:1 contrast)
const BRAND_DEEP = "#166F42";  // button fills, links, small text-as-accent (6.2:1 on white)
const WHITE = "#FFFFFF";
const OFFGREY = "#F6F7F6";
const BORDER = "#E4E7E4";
const TEXT = "#14171A";
const TEXT_MID = "#5B6560";
const TEXT_DIM = "#8A928D";
const BORDER_HOVER = "#D8DCD8";
/* Accent set — see brand/Brand.md "Accent set" table; the same agent's color must match
   app/page.jsx's CHAIN_NODES */
const ACCENT_TEAL = "#0E7490";
const ACCENT_BLUE = "#1D4ED8";
const ACCENT_VIOLET = "#6D28D9";
const ACCENT_PURPLE = "#7E22CE";
const ACCENT_AMBER = "#B45309";
const DANGER = "#DC2626";

function hex2rgb(hex) {
  return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
}

/* ─── Logo ───────────────────────────────────────────────────────── */
const Logo = ({ color=BRAND_DEEP, size=18 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{display:"inline-block",verticalAlign:"middle"}}>
    <path d="M4 24 C8 24 10 14 15 14 C20 14 22 6 26 6 C29 6 30 12 31 14" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
    <circle cx="4"  cy="24" r="3"   fill={color}/>
    <circle cx="15" cy="14" r="2.5" fill={color} opacity="0.7"/>
    <circle cx="26" cy="6"  r="2.5" fill={color} opacity="0.5"/>
    <circle cx="31" cy="14" r="2.5" fill={color} opacity="0.9"/>
  </svg>
);

/* ─── useReveal ──────────────────────────────────────────────────── */
function useReveal(threshold=0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function RevealSection({ children, id, style }) {
  const [ref, visible] = useReveal(0.08);
  return (
    <div ref={ref} id={id} style={{
      ...style, position:"relative", zIndex:1,
      opacity: visible?1:0, transform: visible?"translateY(0)":"translateY(24px)",
      transition:"opacity 0.6s ease, transform 0.6s ease",
    }}>
      {children}
    </div>
  );
}

/* ─── ScrollProgress ─────────────────────────────────────────────── */
function ScrollProgress() {
  const barRef = useRef(null);
  useEffect(() => {
    let raf;
    const update = () => {
      const el = barRef.current; if (!el) return;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      el.style.width = (total>0?(window.scrollY/total)*100:0)+"%";
    };
    const fn = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    window.addEventListener("scroll", fn, { passive:true });
    return () => { window.removeEventListener("scroll", fn); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div style={{position:"fixed",top:0,left:0,right:0,height:"2px",zIndex:9999,background:BORDER,pointerEvents:"none"}}>
      <div ref={barRef} style={{height:"100%",width:"0%",background:BRAND_DEEP,transition:"none"}}/>
    </div>
  );
}

/* ─── AgentFlow — comet travels between nodes ────────────────────── */
const AGENT_NODES = [
  {n:"01",name:"Risk Scanner",    short:"Top failure points",         tier:"Free", color:BRAND, col:0,row:0},
  {n:"02",name:"Fix Generator",   short:"Specific fixes",             tier:"Free", color:ACCENT_TEAL, col:1,row:0},
  {n:"03",name:"Cascade Modeler", short:"Domino simulation",          tier:"Free", color:ACCENT_BLUE, col:1,row:1},
  {n:"04",name:"Exec Writer",     short:"60s forwardable readout",    tier:"Free", color:ACCENT_VIOLET, col:0,row:1},
  {n:"05",name:"Stakeholder",     short:"3 audience versions",        tier:"Solo", color:ACCENT_PURPLE, col:0,row:2},
  {n:"06",name:"Deadline RE",     short:"Work backwards to hit date", tier:"Team", color:ACCENT_AMBER, col:1,row:2},
];

function CometDot({ fromCx, fromCy, toCx, toCy, color }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let start;
    const dur = 580;
    const animate = ts => {
      if (!start) start = ts;
      const t = Math.min((ts-start)/dur, 1);
      const ease = t<0.5 ? 2*t*t : -1+(4-2*t)*t;
      el.style.left = (fromCx+(toCx-fromCx)*ease - 3)+"px";
      el.style.top  = (fromCy+(toCy-fromCy)*ease - 3)+"px";
      el.style.opacity = t>0.88 ? String(1-(t-0.88)/0.12) : "1";
      if (t<1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [fromCx,fromCy,toCx,toCy,color]);
  return (
    <div ref={ref} style={{
      position:"absolute", left:fromCx-3, top:fromCy-3,
      width:6, height:6, borderRadius:"50%", background:color,
      pointerEvents:"none", zIndex:10,
    }}/>
  );
}

function AgentFlow() {
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    let timer;
    const STEP = 680, HOLD = 2400;
    const tick = () => {
      phaseRef.current++;
      if (phaseRef.current > 5) {
        setPhase(-1);
        timer = setTimeout(() => { phaseRef.current=0; setPhase(0); timer=setTimeout(tick,STEP); }, 900);
      } else {
        setPhase(phaseRef.current);
        timer = setTimeout(tick, phaseRef.current===5 ? HOLD : STEP);
      }
    };
    timer = setTimeout(tick, STEP);
    return () => clearTimeout(timer);
  }, []);

  const CW=145, CH=74, GX=12, GY=12, PAD=12;
  const W = PAD+CW+GX+CW+PAD;
  const H = PAD+CH+GY+CH+GY+CH+PAD;

  const nodePos = (col, row) => ({
    x: PAD+col*(CW+GX), y: PAD+row*(CH+GY),
    cx: PAD+col*(CW+GX)+CW/2, cy: PAD+row*(CH+GY)+CH/2,
  });

  const edges = AGENT_NODES.map((a,i) => {
    if (i>=5) return null;
    const fp=nodePos(a.col,a.row), np=AGENT_NODES[i+1], tp=nodePos(np.col,np.row);
    let x1,y1,x2,y2;
    if (fp.cy===tp.cy) {
      x1=a.col<np.col?fp.x+CW:fp.x; y1=fp.cy;
      x2=a.col<np.col?tp.x:tp.x+CW; y2=tp.cy;
    } else {
      x1=fp.cx; y1=fp.cy<tp.cy?fp.y+CH:fp.y;
      x2=tp.cx; y2=fp.cy<tp.cy?tp.y:tp.y+CH;
    }
    return {x1,y1,x2,y2,color:a.color};
  }).filter(Boolean);

  const showComet = phase>=0 && phase<5;
  const fp = showComet ? nodePos(AGENT_NODES[phase].col, AGENT_NODES[phase].row) : null;
  const tp = showComet ? nodePos(AGENT_NODES[phase+1].col, AGENT_NODES[phase+1].row) : null;

  return (
    <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:14,overflow:"hidden",boxShadow:"0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.05)"}}>
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontSize:"0.68rem",fontWeight:600,color:TEXT_MID,display:"flex",alignItems:"center",gap:"0.4rem"}}>
          <span style={{width:5,height:5,borderRadius:"50%",background:BRAND_DEEP,animation:"pv-pulse 2s infinite",flexShrink:0}}/>
          Analysis Chain
        </div>
        <div style={{fontSize:"0.6rem",color:TEXT_DIM}}>6 agents</div>
      </div>
      <div style={{position:"relative",width:W,height:H}}>
        <svg style={{position:"absolute",inset:0,overflow:"visible",pointerEvents:"none"}} width={W} height={H}>
          {edges.map((e,i) => {
            const active = phase>i;
            const [r,g,b] = hex2rgb(e.color);
            return (
              <g key={i}>
                <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke={BORDER} strokeWidth={1.5}/>
                <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke={`rgba(${r},${g},${b},${active?0.6:0})`}
                  strokeWidth={1.5} strokeDasharray="4 3"
                  style={{transition:"stroke 0.35s ease"}}/>
              </g>
            );
          })}
        </svg>
        {AGENT_NODES.map((a,i) => {
          const p=nodePos(a.col,a.row);
          const active=phase>=i, current=phase===i;
          const [r,g,b]=hex2rgb(a.color);
          return (
            <div key={i} style={{
              position:"absolute", left:p.x, top:p.y, width:CW, height:CH,
              background: active?`rgba(${r},${g},${b},0.06)`:OFFGREY,
              border:`1px solid ${active?a.color+"40":BORDER}`,
              borderRadius:10, padding:"0.55rem 0.7rem",
              transition:"background 0.35s,border-color 0.35s",
              animation: current?"pv-agentBurst 0.42s ease":"none",
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.22rem"}}>
                <span style={{fontSize:"0.55rem",fontWeight:700,letterSpacing:"0.08em",color:active?(a.color===BRAND?BRAND_DEEP:a.color):TEXT_DIM}}>{a.n}</span>
                <span style={{fontSize:"0.5rem",fontWeight:600,padding:"0.08rem 0.32rem",borderRadius:100,
                  background:active?`rgba(${r},${g},${b},0.12)`:"transparent",
                  color:active?(a.color===BRAND?BRAND_DEEP:a.color):TEXT_DIM,
                  border:`1px solid ${active?a.color+"35":"transparent"}`,
                }}>{a.tier}</span>
              </div>
              <div style={{fontSize:"0.76rem",fontWeight:700,color:active?TEXT:TEXT_DIM,lineHeight:1.2,marginBottom:"0.18rem"}}>{a.name}</div>
              <div style={{fontSize:"0.62rem",color:active?TEXT_MID:TEXT_DIM,lineHeight:1.3}}>{a.short}</div>
            </div>
          );
        })}
        {showComet && (
          <CometDot key={phase}
            fromCx={fp.cx} fromCy={fp.cy}
            toCx={tp.cx}   toCy={tp.cy}
            color={AGENT_NODES[phase].color}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Demo data ──────────────────────────────────────────────────── */
const DEMO_TASKS = [
  {id:"t0",name:"Kickoff & Plan",     days:5, owner:"Marcus",  predecessors:[],          concurrent:false},
  {id:"t1",name:"Content & Copy",     days:8, owner:"Sarah",   predecessors:["t0"],      concurrent:false},
  {id:"t2",name:"Product Photos",     days:6, owner:"James",   predecessors:["t0"],      concurrent:true},
  {id:"t3",name:"Design",             days:10,owner:"Marcus",  predecessors:["t1","t2"], concurrent:false},
  {id:"t4",name:"Klaviyo Setup",      days:4, owner:"Sarah",   predecessors:["t3"],      concurrent:true},
  {id:"t5",name:"Development",        days:12,owner:"Dev Team",predecessors:["t3"],      concurrent:false},
  {id:"t6",name:"SEO Setup",          days:4, owner:"Sarah",   predecessors:["t0"],      concurrent:false},
  {id:"t7",name:"QA & Testing",       days:5, owner:"Dev Team",predecessors:["t5","t4"], concurrent:false},
  {id:"t8",name:"Launch",             days:1, owner:"Marcus",  predecessors:["t7","t6"], concurrent:false},
];
// Cascade-impact copy per node, derived from DEMO_TASKS' real dependency chain above —
// clicking a node in the demo graph below actually shows this, not a static placeholder.
const DEMO_RISK = {
  t0: {title:"Kickoff & Plan is the root dependency",  blurb:"Every other task waits on this. A slip here pushes the entire 41-day plan back day-for-day.",           delay:"+1d per 1d slip", blocked:"8 tasks", owners:"3 owners", cost:"$1,400/day",  fix:{title:"No slack to protect — lock scope before day 1", blurb:"This task can't safely run long. Freeze requirements before kickoff starts.", confidence:74}},
  t1: {title:"Content & Copy feeds the Design bottleneck", blurb:"Zero float. If copy slips, Design — and everything after it — slips with it.",                       delay:"+3–5d",           blocked:"5 tasks", owners:"3 owners", cost:"$3,100",      fix:{title:"Start copy outline during Kickoff", blurb:"Overlap the first 2 days with planning — recovers most of the float.", confidence:81}},
  t2: {title:"Product Photos has 2 days of buffer",     blurb:"Modest float — it can run 2 days long before it starts delaying Design.",                                delay:"Absorbed up to 2d",blocked:"0 tasks", owners:"—",        cost:"$0",          fix:null},
  t3: {title:"Design is the critical bottleneck",       blurb:"Both Development and Klaviyo Setup wait on this. Zero float — the highest-leverage task in the plan.",  delay:"+5–7d",           blocked:"4 tasks", owners:"3 owners", cost:"$4,200",      fix:{title:"Run Product Photos in parallel", blurb:"Already true in this plan — keeps Design from waiting on Photos.", confidence:86}},
  t4: {title:"Klaviyo Setup has 8 days of buffer",      blurb:"Comfortable float. Even a week-long slip won't touch the launch date.",                                 delay:"Absorbed",        blocked:"0 tasks", owners:"—",        cost:"$0",          fix:null},
  t5: {title:"Development is the bottleneck",           blurb:"QA & Testing can't start until it's done. 2 days of buffer remain on the critical path.",                delay:"+5–7d",           blocked:"2 tasks", owners:"3 owners", cost:"$4,200",      fix:{title:"Run Product Photos in parallel", blurb:"Already true in this plan — helps absorb slips upstream of Development.", confidence:86}},
  t6: {title:"SEO Setup has 31 days of buffer",         blurb:"The safest task in the plan — could run a full month long with zero downstream impact.",                delay:"Absorbed",        blocked:"0 tasks", owners:"—",        cost:"$0",          fix:null},
  t7: {title:"QA & Testing is the last gate before launch", blurb:"Zero float. Everything upstream funnels through here before the site goes live.",                    delay:"+2–4d",           blocked:"1 task",  owners:"1 owner",  cost:"$900",        fix:{title:"Start QA on completed modules early", blurb:"Test Development's finished pieces before the full build lands.", confidence:78}},
  t8: {title:"Launch is the finish line",                blurb:"Zero float, no downstream tasks — if this slips, the launch date slips with it, one day at a time.",   delay:"+1d per 1d slip", blocked:"0 tasks", owners:"1 owner",  cost:"$1,400/day",  fix:null},
};
const DEMO_RESULT = {
  bufferDays:2, bottleneck:{name:"Development"},
  tasks:[
    {id:"t0",name:"Kickoff & Plan",     days:5, es:0, ef:5, slack:0},
    {id:"t1",name:"Content & Copy",     days:8, es:5, ef:13,slack:0},
    {id:"t2",name:"Product Photos",     days:6, es:5, ef:11,slack:2},
    {id:"t3",name:"Design",             days:10,es:13,ef:23,slack:0},
    {id:"t4",name:"Klaviyo Setup",      days:4, es:23,ef:27,slack:8},
    {id:"t5",name:"Development",        days:12,es:23,ef:35,slack:0},
    {id:"t6",name:"SEO Setup",          days:4, es:5, ef:9, slack:31},
    {id:"t7",name:"QA & Testing",       days:5, es:35,ef:40,slack:0},
    {id:"t8",name:"Launch",             days:1, es:40,ef:41,slack:0},
  ],
};

/* ─── DependencyGraph — unchanged, renders inside the dark /results
     mockup shell below, which deliberately still matches the real
     (not-yet-migrated) /results page exactly ─────────────────────── */
function DependencyGraph({ tasks, result, onNodeClick }) {
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  function handleNodeClick(id) {
    const next = id === selectedId ? null : id;
    setSelectedId(next);
    onNodeClick && onNodeClick(next);
  }
  const DC = {
    nodeFill:"rgba(22,27,34,0.85)",nodeBorder:"#30363D",
    text:"#E6EDF3",textDim:"#8B949E",textSub:"#484F58",
    crit:"#EF4444",critFill:"rgba(239,68,68,0.1)",
    green:"#22C55E",greenFill:"rgba(34,197,94,0.08)",
    blue:"#3B82F6",amber:"#F59E0B",
    cascadeFill:"rgba(239,68,68,0.04)",cascadeStroke:"rgba(239,68,68,0.35)",
  };
  const layout = useMemo(() => {
    if (!tasks.length||!result) return {positions:{},W:600,H:300};
    const levels={};
    function al(id,lvl){if(levels[id]!==undefined&&levels[id]>=lvl)return;levels[id]=lvl;tasks.filter(t=>t.predecessors.includes(id)).forEach(s=>al(s.id,lvl+1));}
    tasks.filter(t=>t.predecessors.length===0).forEach(t=>al(t.id,0));
    tasks.forEach(t=>{if(levels[t.id]===undefined)al(t.id,0);});
    const byLevel={};
    tasks.forEach(t=>{const l=levels[t.id]||0;if(!byLevel[l])byLevel[l]=[];byLevel[l].push(t);});
    const maxLevel=Math.max(...Object.values(levels),0);
    const maxInCol=Math.max(...Object.values(byLevel).map(g=>g.length),1);
    const NW=118,NH=50,GX=64,GY=18,colW=NW+GX;
    const W=Math.max((maxLevel+1)*colW+GX,400);
    const H=Math.max(maxInCol*(NH+GY)-GY+80,200);
    const positions={};
    Object.entries(byLevel).forEach(([lvl,group])=>{
      const x=GX/2+parseInt(lvl)*colW;
      const totalH=group.length*(NH+GY)-GY;
      const startY=(H-totalH)/2;
      group.forEach((t,i)=>{positions[t.id]={x,y:Math.max(32,startY+i*(NH+GY)),w:NW,h:NH,cx:x+NW/2,cy:Math.max(32,startY+i*(NH+GY))+NH/2};});
    });
    return {positions,W,H};
  },[tasks,result]);
  const criticalIds=useMemo(()=>new Set(result?.tasks?.filter(t=>t.slack===0).map(t=>t.id)||[]),[result]);
  const focusId=hoveredId||selectedId;
  const upstream=useMemo(()=>{if(!focusId)return new Set();const set=new Set();function walk(id){const t=tasks.find(t=>t.id===id);if(!t)return;t.predecessors.forEach(pid=>{if(!set.has(pid)){set.add(pid);walk(pid);}});}walk(focusId);return set;},[focusId,tasks]);
  const downstream=useMemo(()=>{if(!focusId)return new Set();const set=new Set();function walk(id){tasks.filter(t=>t.predecessors.includes(id)).forEach(t=>{if(!set.has(t.id)){set.add(t.id);walk(t.id);}});}walk(focusId);return set;},[focusId,tasks]);
  const connected=new Set([...upstream,...downstream]);
  const cascadeRect=useMemo(()=>{if(!result||criticalIds.size<2)return null;const pts=[...criticalIds].map(id=>layout.positions[id]).filter(Boolean);if(pts.length<2)return null;const pad=12;return{x:Math.min(...pts.map(p=>p.x))-pad,y:Math.min(...pts.map(p=>p.y))-pad,w:Math.max(...pts.map(p=>p.x+p.w))+pad-(Math.min(...pts.map(p=>p.x))-pad),h:Math.max(...pts.map(p=>p.y+p.h))+pad-(Math.min(...pts.map(p=>p.y))-pad)};},[criticalIds,layout.positions,result]);
  function edgePath(from,to){const fx=from.x+from.w,fy=from.cy,tx=to.x,ty=to.cy,cp=(tx-fx)*0.5;return `M ${fx} ${fy} C ${fx+cp} ${fy}, ${tx-cp} ${ty}, ${tx} ${ty}`;}
  const {positions,W,H}=layout;
  if(!tasks.length||!result) return null;
  return (
    <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",width:"100%"}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:"block",minWidth:W}}>
        <defs>
          <marker id="pv-ac" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={DC.crit} opacity="0.85"/></marker>
          <marker id="pv-an" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={DC.textSub} opacity="0.5"/></marker>
          <marker id="pv-au" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={DC.blue} opacity="0.9"/></marker>
          <marker id="pv-ad" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={DC.crit} opacity="0.7"/></marker>
          <marker id="pv-dim" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={DC.textSub} opacity="0.2"/></marker>
          <filter id="pv-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {cascadeRect&&<g><rect x={cascadeRect.x} y={cascadeRect.y} width={cascadeRect.w} height={cascadeRect.h} rx="10" fill={DC.cascadeFill} stroke={DC.cascadeStroke} strokeWidth="1" strokeDasharray="6 4"/><text x={cascadeRect.x+cascadeRect.w/2} y={cascadeRect.y+13} textAnchor="middle" fontSize="7.5" fontFamily="system-ui" fontWeight="700" fill="rgba(239,68,68,0.7)" letterSpacing="0.08em">CASCADE IMPACT ZONE</text></g>}
        {tasks.map(t=>t.predecessors.map(pid=>{
          const from=positions[pid],to=positions[t.id];if(!from||!to)return null;
          const isCritE=criticalIds.has(pid)&&criticalIds.has(t.id);
          const isUp=focusId&&upstream.has(pid)&&(upstream.has(t.id)||t.id===focusId);
          const isDown=focusId&&downstream.has(t.id)&&(downstream.has(pid)||pid===focusId);
          const isDim=focusId&&!isUp&&!isDown&&pid!==focusId&&t.id!==focusId;
          const stroke=isDim?`${DC.textSub}33`:isUp?DC.blue:isDown?DC.crit:isCritE?`${DC.crit}AA`:`${DC.textSub}55`;
          const marker=isDim?"url(#pv-dim)":isUp?"url(#pv-au)":isDown?"url(#pv-ad)":isCritE?"url(#pv-ac)":"url(#pv-an)";
          return <path key={`${pid}-${t.id}`} d={edgePath(from,to)} fill="none" stroke={stroke} strokeWidth={isDim?1:isCritE||isUp||isDown?2:1.5} markerEnd={marker} strokeDasharray={t.concurrent?"5 4":"none"} style={{transition:"stroke 0.2s"}}/>;
        }))}
        {tasks.map(t=>{
          const pos=positions[t.id];if(!pos)return null;
          const rt=result.tasks.find(r=>r.id===t.id);
          const isCrit=criticalIds.has(t.id),isSelected=t.id===selectedId;
          const isUp=upstream.has(t.id),isDown=downstream.has(t.id);
          const isDim=focusId&&t.id!==focusId&&!connected.has(t.id);
          const floatDays=rt?.slack||0;
          const fill=isDim?"rgba(15,20,15,0.5)":isSelected?`${DC.blue}22`:isUp?`${DC.blue}18`:isDown?`${DC.crit}12`:isCrit?DC.critFill:t.concurrent?DC.greenFill:DC.nodeFill;
          const stroke=isDim?"#1E251E":isSelected?DC.blue:isUp?DC.blue:isDown?DC.crit:isCrit?DC.crit:DC.nodeBorder;
          const strokeW=isDim?1:(isSelected||isUp||isDown||isCrit)?2:1.5;
          const textFill=isDim?DC.textSub:isSelected?DC.blue:isUp?DC.blue:isDown?DC.crit:isCrit?DC.crit:DC.text;
          const subFill=isDim?DC.textSub:isUp?`${DC.blue}CC`:isDown?`${DC.crit}CC`:DC.textDim;
          const dotFill=isDim?"#252D25":isCrit?DC.crit:DC.green;
          const subLabel=`${t.days}d · ${(t.owner==="UNASSIGNED"?"Unassigned":t.owner)||"?"}`.slice(0,18);
          return (
            <g key={t.id} style={{cursor:"pointer",opacity:isDim?0.3:1,transition:"opacity 0.2s"}}
              onClick={()=>handleNodeClick(t.id)}
              onMouseEnter={()=>setHoveredId(t.id)} onMouseLeave={()=>setHoveredId(null)}
              filter={isSelected?"url(#pv-glow)":undefined}>
              {isSelected&&<rect x={pos.x-4} y={pos.y-4} width={pos.w+8} height={pos.h+8} rx="13" fill="none" stroke={`${DC.blue}33`} strokeWidth="2"/>}
              <rect x={pos.x} y={pos.y} width={pos.w} height={pos.h} rx="8" fill={fill} stroke={stroke} strokeWidth={strokeW} style={{transition:"fill 0.2s,stroke 0.2s"}}/>
              {isCrit&&!isDim&&<rect x={pos.x+1} y={pos.y+1} width={pos.w-2} height="2" rx="1" fill={DC.crit} opacity="0.55"/>}
              <text x={pos.x+9} y={pos.y+18} fontSize="10" fontFamily="system-ui" fontWeight={isCrit?"700":"500"} fill={isDim?DC.textSub:textFill} style={{transition:"fill 0.2s"}}>{t.name.length>14?t.name.slice(0,13)+"…":t.name}</text>
              <text x={pos.x+9} y={pos.y+32} fontSize="8.5" fontFamily="system-ui" fontWeight="400" fill={isDim?DC.textSub:subFill} style={{transition:"fill 0.2s"}}>{subLabel}</text>
              <circle cx={pos.x+pos.w-11} cy={pos.y+12} r="3.5" fill={dotFill} style={{transition:"fill 0.2s"}}/>
              {floatDays>0&&!isDim&&<g><rect x={pos.x+pos.w-28} y={pos.y+pos.h-13} width={24} height={10} rx="3" fill="rgba(34,197,94,0.18)"/><text x={pos.x+pos.w-16} y={pos.y+pos.h-5} fontSize="7" fontFamily="system-ui" fontWeight="700" fill={DC.green} textAnchor="middle">+{floatDays}d</text></g>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────── */
export default function Home() {
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [demoSelected, setDemoSelected] = useState("t5");
  const demoRisk = DEMO_RISK[demoSelected] || DEMO_RISK.t5;
  const demoNode = DEMO_TASKS.find(t => t.id === demoSelected) || DEMO_TASKS[5];
  useEffect(() => {
    const fn=()=>setScrolled(window.scrollY>60);
    window.addEventListener("scroll",fn,{passive:true});
    return ()=>window.removeEventListener("scroll",fn);
  },[]);

  const steps=[
    {n:"01",color:ACCENT_BLUE,icon:"⬡",title:"Map your project",desc:"Add tasks, set durations, assign owners, and define which tasks depend on each other. Takes about 5 minutes."},
    {n:"02",color:ACCENT_AMBER,icon:"⟳",title:"Pathflo finds the risks",desc:"Critical path is calculated instantly. Bottlenecks are flagged. Cascade impacts are simulated — automatically."},
    {n:"03",color:BRAND_DEEP,icon:"↗",title:"Execute with confidence",desc:"Share a live project health report with clients. Get early risk alerts. Defend your timeline with data."},
  ];
  const questions=[
    {q:"Will this project finish on time?",a:"Pathflo scores on-time confidence before a single day of work begins. Not a feeling — a probability backed by your actual dependency chain.",icon:"◈"},
    {q:"Who's most likely to break it?",a:"Workload Intelligence flags which team members own the most critical work and surfaces single points of failure before they become emergencies.",icon:"⊞"},
    {q:"What cascades if this task slips?",a:"The cascade simulator shows exactly which tasks get blocked, how many days you lose, and what it costs — in real time.",icon:"⚡"},
    {q:"How do I explain this to my client?",a:"One tap generates a shareable executive readout — formatted to forward. No PM skills needed to send it or understand it.",icon:"↗"},
  ];
  const comparison=[
    {pm:"Store your tasks",               pathflo:"Predict your outcomes before work begins"},
    {pm:"Tell you you're behind",         pathflo:"Tell you why — before it happens"},
    {pm:"Show you a Gantt chart",         pathflo:"Show you the critical path, cascade risks, and what to fix"},
    {pm:"Track what exists",              pathflo:"Forecast what's coming — confidence, failure probability, buffer"},
    {pm:"No workload visibility",         pathflo:"Flags who's overloaded and who's a single point of failure"},
    {pm:"Require a PM to read the output",pathflo:"One-tap shareable report — forward it from your phone"},
    {pm:"React to problems",              pathflo:"Prevent them"},
  ];
  const agents=[
    {n:"01",name:"Risk Scanner",             tier:"Free", color:BRAND_DEEP,   plain:"Reads your project plan and finds the top 3-5 things most likely to blow up — before they do. Each risk comes with a probability score and exactly which tasks are the trigger."},
    {n:"02",name:"Fix Generator",            tier:"Free", color:ACCENT_TEAL,  plain:"Takes the risks and produces specific actions to fix them. Not generic advice — it references your actual tasks and owners."},
    {n:"03",name:"Cascade Modeler",          tier:"Free", color:ACCENT_BLUE,  plain:"Picks the highest-risk failure point and plays it out step by step. If Task A slips 5 days, here's exactly which tasks get blocked, in what order, and what the final deadline impact is."},
    {n:"04",name:"Executive Writer",         tier:"Free", color:ACCENT_VIOLET,plain:"Turns everything above into a clean, one-page project status summary you can read in 60 seconds. Verdict, top risks, recommended actions — ready to share."},
    {n:"05",name:"Stakeholder Adapter",      tier:"Solo", color:ACCENT_PURPLE,plain:"Takes the executive summary and rewrites it three ways: client, team, and exec. Three audiences, zero rewriting."},
    {n:"06",name:"Deadline Reverse-Engineer",tier:"Team", color:ACCENT_AMBER, plain:"The deadline is fixed. This agent works backwards from it and tells you exactly what has to be cut, compressed, or resourced to hit it."},
  ];
  const pricing=[
    {name:"Free", price:"$0",  period:"forever",tag:null,          primary:false,cta:"Start free",  desc:"Run your first analysis and see exactly where your project stands.",items:["1 project analysis","Critical path + dependency graph","Cascade impact simulator","Workload intelligence","AI Executive Readout","Risk Scanner","Fix Generator"]},
    {name:"Solo", price:"$49", period:"/mo",    tag:"Most popular", primary:true, cta:"Start Solo",  desc:"For contractors and operators who need to communicate project status to clients and leadership.",items:["Everything in Free","Unlimited projects","Stakeholder Adapter — 3 ready-to-send report versions","Cascade Modeler — full domino-effect simulation","Save & revisit projects"]},
    {name:"Team", price:"$99", period:"/mo",    tag:null,          primary:false,cta:"Start Team",  desc:"For agencies and teams managing multiple projects with multiple owners.",items:["Everything in Solo","Deadline Reverse-Engineer","Multi-owner workload mapping","Priority support"]},
  ];

  return (
    <main style={{background:WHITE,color:TEXT,fontFamily:"'DM Sans',system-ui,sans-serif",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:ital,wght@0,300;0,700;1,300;1,700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        ::-webkit-scrollbar{width:8px}::-webkit-scrollbar-thumb{background:${BORDER};border-radius:4px}

        @keyframes pv-fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pv-pulse{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes pv-agentBurst{0%{transform:scale(0.96);opacity:0.6}55%{transform:scale(1.02)}100%{transform:scale(1);opacity:1}}

        .pv-h1{animation:pv-fadeUp 0.7s 0.05s ease both}
        .pv-h2{animation:pv-fadeUp 0.7s 0.15s ease both}
        .pv-h3{animation:pv-fadeUp 0.7s 0.25s ease both}
        .pv-h4{animation:pv-fadeUp 0.7s 0.35s ease both}
        .pv-h5{animation:pv-fadeUp 0.7s 0.45s ease both}

        .pv-btn-p{display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;background:${BRAND_DEEP};color:${WHITE};border:none;border-radius:100px;font-family:inherit;font-weight:700;font-size:0.95rem;padding:0.9rem 2rem;cursor:pointer;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.08);transition:transform 0.15s,box-shadow 0.15s}
        .pv-btn-p:hover{transform:translateY(-2px);box-shadow:0 2px 4px rgba(0,0,0,.08), 0 8px 20px rgba(0,0,0,.12)}
        .pv-btn-s{display:inline-flex;align-items:center;justify-content:center;background:${WHITE};color:${TEXT};border:1.5px solid ${BORDER};border-radius:100px;font-family:inherit;font-weight:500;font-size:0.95rem;padding:0.9rem 2rem;cursor:pointer;text-decoration:none;transition:all 0.15s}
        .pv-btn-s:hover{border-color:${BRAND_DEEP};color:${BRAND_DEEP}}

        .pv-card{background:${WHITE};border:1px solid ${BORDER};border-radius:16px;padding:1.75rem;position:relative;overflow:hidden;transition:box-shadow 0.2s,border-color 0.2s;box-shadow:0 1px 2px rgba(0,0,0,.03)}
        .pv-card:hover{box-shadow:0 1px 2px rgba(0,0,0,.04), 0 12px 28px rgba(0,0,0,.06);border-color:${BORDER_HOVER}}
        .pv-card::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:${BRAND};transform:scaleX(0);transform-origin:left;opacity:0;transition:transform 0.3s ease,opacity 0.3s ease}
        .pv-card:hover::after{transform:scaleX(1);opacity:1}

        a:focus-visible,button:focus-visible{outline:none;box-shadow:0 0 0 2px ${WHITE},0 0 0 4px ${BRAND};border-radius:4px;transition:box-shadow 0.2s ease}
        .pv-btn-p:focus-visible,.pv-btn-s:focus-visible{box-shadow:0 0 0 2px ${WHITE},0 0 0 4px ${BRAND},0 1px 2px rgba(0,0,0,.06)}

        .pv-price-card{background:${WHITE};border:1px solid ${BORDER};border-radius:20px;padding:1.75rem;position:relative;overflow:visible;box-shadow:0 1px 2px rgba(0,0,0,.03);transition:box-shadow 0.2s}
        .pv-price-card:hover{box-shadow:0 1px 2px rgba(0,0,0,.04), 0 12px 28px rgba(0,0,0,.06)}
        .pv-price-card.pv-featured{background:${OFFGREY};border-color:rgba(22,111,66,0.35)}

        .pv-ham{display:flex;flex-direction:column;gap:5px;cursor:pointer;padding:4px;border:none;background:transparent;z-index:202;position:relative}
        .pv-ham span{display:block;width:22px;height:2px;background:${TEXT};border-radius:2px;transition:all 0.28s}
        .pv-ham.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
        .pv-ham.open span:nth-child(2){opacity:0;transform:scaleX(0)}
        .pv-ham.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}

        .pv-nav-backdrop{position:fixed;inset:0;background:rgba(20,23,26,0.3);z-index:199;opacity:0;pointer-events:none;transition:opacity 0.3s}
        .pv-nav-backdrop.open{opacity:1;pointer-events:auto}

        .pv-nav-drawer{position:fixed;top:0;left:0;bottom:0;width:300px;background:${WHITE};z-index:200;display:flex;flex-direction:column;padding:5rem 2.5rem 2.5rem;border-right:1px solid ${BORDER};transform:translateX(-100%);transition:transform 0.32s cubic-bezier(0.4,0,0.2,1);box-shadow:8px 0 40px rgba(0,0,0,0.08)}
        .pv-nav-drawer.open{transform:translateX(0)}
        .pv-nav-drawer a{font-family:'Fraunces',serif;font-size:1.5rem;font-weight:300;color:${TEXT_MID};text-decoration:none;transition:color 0.15s;letter-spacing:-0.02em;padding:0.4rem 0}
        .pv-nav-drawer a:hover{color:${BRAND_DEEP}}
        .pv-nav-drawer .pv-drawer-links{display:flex;flex-direction:column;gap:0.5rem;flex:1}
        .pv-nav-drawer .pv-drawer-cta{margin-top:2rem}

        .pv-comp-row:hover .pv-comp-right{background:${OFFGREY}}

        @media(max-width:900px){
          .pv-hero-grid{grid-template-columns:1fr!important}
          .pv-hero-right{display:none!important}
          .pv-steps-grid{grid-template-columns:1fr!important}
          .pv-pgrid{grid-template-columns:1fr!important}
          .pv-graph-body{grid-template-columns:1fr!important}
          .pv-graph-rp{border-left:none!important;border-top:1px solid #1C2128!important}
          .pv-hbtns{flex-direction:column!important;align-items:stretch!important}
          .pv-stats{gap:2rem!important;flex-wrap:wrap!important;justify-content:center!important}
        }
      `}</style>

      <ScrollProgress/>

      <div className={`pv-nav-backdrop ${navOpen?"open":""}`} onClick={()=>setNavOpen(false)}/>

      <div className={`pv-nav-drawer ${navOpen?"open":""}`}>
        <div className="pv-drawer-links">
          {[["#how","How it works"],["#why","Why it works"],["#graph","See it live"],["#pricing","Pricing"]].map(([href,label])=>(
            <a key={href} href={href} onClick={()=>setNavOpen(false)}>{label}</a>
          ))}
        </div>
        <div className="pv-drawer-cta">
          <a href="/app" className="pv-btn-p" style={{width:"100%",justifyContent:"center",fontSize:"1rem"}} onClick={()=>setNavOpen(false)}>
            Get started →
          </a>
        </div>
      </div>

      <nav style={{
        position:"fixed",top:0,left:0,right:0,zIndex:201,height:64,
        display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 1.75rem",
        background:scrolled?"rgba(255,255,255,0.92)":"transparent",
        backdropFilter:scrolled?"blur(16px)":"none",
        borderBottom:scrolled?`1px solid ${BORDER}`:"1px solid transparent",
        transition:"all 0.25s",
      }}>
        <button className={`pv-ham ${navOpen?"open":""}`} onClick={()=>setNavOpen(o=>!o)} aria-label="Menu">
          <span/><span/><span/>
        </button>
        <a href="/" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:"0.5rem",position:"absolute",left:"50%",transform:"translateX(-50%)"}}>
          <Logo color={BRAND_DEEP} size={22}/>
          <span style={{fontWeight:700,fontSize:"1.05rem",color:TEXT,letterSpacing:"-0.02em"}}>
            Path<span style={{color:BRAND_DEEP}}>flo</span>
          </span>
        </a>
        <a href="/app" className="pv-btn-p" style={{fontSize:"0.85rem",padding:"0.5rem 1.3rem"}}>Get started</a>
      </nav>

      {/* ── HERO ── */}
      <section style={{position:"relative",zIndex:1,padding:"148px 2rem 100px",maxWidth:1200,margin:"0 auto"}}>
        <div className="pv-hero-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4rem",alignItems:"center"}}>
          <div>
            <div className="pv-h1" style={{marginBottom:"1.75rem"}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:"0.5rem",background:OFFGREY,border:`1px solid ${BORDER}`,borderRadius:"100px",padding:"0.4rem 1.1rem",fontSize:"0.68rem",fontWeight:600,color:TEXT_MID,letterSpacing:"0.1em"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:BRAND_DEEP,animation:"pv-pulse 2s infinite",flexShrink:0}}/>
                NOW LIVE — PLAN YOUR FIRST PROJECT FREE
              </span>
            </div>
            <h1 className="pv-h2" style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(2.7rem,5.8vw,4.2rem)",fontWeight:700,lineHeight:1.08,letterSpacing:"-0.03em",marginBottom:"1.5rem",color:TEXT}}>
              Know if your project<br/>will ship on time —<br/>
              <em style={{color:BRAND_DEEP,fontStyle:"italic",fontWeight:300}}>before work begins.</em>
            </h1>
            <p className="pv-h3" style={{fontSize:"clamp(1rem,2vw,1.1rem)",color:TEXT_MID,lineHeight:1.85,maxWidth:"460px",marginBottom:"2.5rem",fontWeight:400}}>
              Map your tasks, define your dependencies, and Pathflo instantly surfaces your critical path, bottlenecks, and cascade risks.{" "}
              <span style={{fontWeight:600,color:TEXT}}>No PM required.</span>
            </p>
            <div className="pv-h4 pv-hbtns" style={{display:"flex",gap:"1rem",marginBottom:"3.5rem"}}>
              <a href="/app" className="pv-btn-p" style={{fontSize:"1rem",padding:"1rem 2.25rem"}}>Build my first plan →</a>
              <a href="#how" className="pv-btn-s">See how it works</a>
            </div>
            <div className="pv-h5 pv-stats" style={{display:"flex",gap:"3rem"}}>
              {[{val:"5 min",label:"To your first risk report"},{val:"5 screens",label:"Of execution intelligence"},{val:"1 tap",label:"To share with a client"}].map(({val,label})=>(
                <div key={val}>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.5rem",fontWeight:700,color:TEXT,letterSpacing:"-0.02em"}}>{val}</div>
                  <div style={{fontSize:"0.68rem",color:TEXT_DIM,fontWeight:500,letterSpacing:"0.03em",marginTop:"0.2rem"}}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="pv-hero-right">
            <AgentFlow/>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <RevealSection id="how" style={{padding:"5rem 1.5rem",background:OFFGREY}}>
        <div style={{maxWidth:1050,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"3rem"}}>
          <div style={{fontSize:"0.65rem",color:BRAND_DEEP,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>HOW IT WORKS</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em",color:TEXT}}>
            From tasks to execution plan<br/><em style={{color:BRAND_DEEP,fontStyle:"italic",fontWeight:300}}>in under five minutes.</em>
          </h2>
        </div>
        <div className="pv-steps-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1.5rem"}}>
          {steps.map((step,i)=>(
            <div key={i} className="pv-card">
              <div style={{width:44,height:44,borderRadius:12,background:`${step.color}14`,border:`1px solid ${step.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.2rem",marginBottom:"1.25rem"}}>{step.icon}</div>
              <div style={{fontSize:"0.6rem",fontWeight:700,letterSpacing:"0.1em",color:step.color,marginBottom:"0.4rem",textTransform:"uppercase"}}>{step.n}</div>
              <div style={{fontSize:"1rem",fontWeight:700,color:TEXT,marginBottom:"0.75rem",lineHeight:1.3}}>{step.title}</div>
              <div style={{fontSize:"0.875rem",color:TEXT_MID,lineHeight:1.75,fontWeight:400}}>{step.desc}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"center",marginTop:"2.5rem"}}>
          <a href="/app" className="pv-btn-p">Start mapping my project →</a>
        </div>
        </div>
      </RevealSection>

      {/* WHY IT WORKS */}
      <RevealSection id="why" style={{padding:"5rem 1.5rem"}}>
        <div style={{maxWidth:820,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"2.5rem"}}>
          <div style={{fontSize:"0.65rem",color:BRAND_DEEP,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>WHY IT WORKS</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em",color:TEXT}}>
            Four questions every PM has.<br/><em style={{color:BRAND_DEEP,fontStyle:"italic",fontWeight:300}}>Pathflo answers all of them.</em>
          </h2>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"0.75rem",maxWidth:680,margin:"0 auto"}}>
          {questions.map(({q,a,icon},i)=>(
            <div key={i} style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
              <div style={{display:"flex",justifyContent:"flex-end"}}>
                <div style={{background:`${BRAND}0F`,border:`1px solid ${BRAND}40`,borderRadius:"18px 18px 4px 18px",padding:"0.7rem 1.1rem",maxWidth:"80%",fontSize:"0.9rem",fontWeight:600,color:BRAND_DEEP,lineHeight:1.5}}>{q}</div>
              </div>
              <div style={{display:"flex",justifyContent:"flex-start",gap:"0.5rem",alignItems:"flex-start"}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:OFFGREY,border:`1px solid ${BORDER}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",color:BRAND_DEEP,fontWeight:700,marginTop:2}}>{icon}</div>
                <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:"4px 18px 18px 18px",padding:"0.75rem 1.1rem",maxWidth:"85%",fontSize:"0.875rem",color:TEXT_MID,lineHeight:1.7}}>{a}</div>
              </div>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"center",marginTop:"0.5rem"}}>
            <a href="/app" className="pv-btn-p" style={{fontSize:"0.9rem"}}>Try it on my project →</a>
          </div>
        </div>
        </div>
      </RevealSection>

      {/* RESULTS PAGE MOCKUP — deliberately still dark: matches the real
          /results page exactly, which is not yet migrated to the new
          brand system (see brand/Brand.md Notes) */}
      <RevealSection id="graph" style={{padding:"5rem 1.5rem",background:OFFGREY}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"2.5rem"}}>
          <div style={{fontSize:"0.65rem",color:BRAND_DEEP,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>YOUR RESULTS DASHBOARD</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em",marginBottom:"0.85rem",color:TEXT}}>
            This is exactly what<br/><em style={{color:BRAND_DEEP,fontStyle:"italic",fontWeight:300}}>you'll see after analysis.</em>
          </h2>
          <p style={{color:TEXT_MID,fontSize:"0.95rem",fontWeight:400,lineHeight:1.8,maxWidth:"480px",margin:"0 auto"}}>
            Live demo of the real dashboard. Click any task node to see its cascade impact.
          </p>
        </div>

        {/* Results page shell — matches /results exactly, dark by design */}
        <div style={{borderRadius:16,overflow:"hidden",border:"1px solid #252D25",boxShadow:"0 24px 80px rgba(0,0,0,0.35)",background:"#080A08"}}>

          {/* Top bar — identical to results page */}
          <div style={{background:"rgba(8,10,8,0.96)",backdropFilter:"blur(20px)",borderBottom:"1px solid #1C2128",height:52,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 0.85rem",gap:"0.5rem",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.65rem",minWidth:0}}>
              <span style={{color:"#484F58",fontSize:"1rem",flexShrink:0}}>☰</span>
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none" style={{flexShrink:0}}>
                <path d="M4 24 C8 24 10 14 15 14 C20 14 22 6 26 6 C29 6 30 12 31 14" stroke="#3ECB6F" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <circle cx="4" cy="24" r="3" fill="#3ECB6F"/>
                <circle cx="15" cy="14" r="2.5" fill="#3ECB6F" opacity="0.7"/>
                <circle cx="26" cy="6" r="2.5" fill="#3ECB6F" opacity="0.5"/>
                <circle cx="31" cy="14" r="2.5" fill="#3ECB6F" opacity="0.9"/>
              </svg>
              <span style={{fontWeight:700,color:"#EEF2EE",fontSize:"0.9rem",flexShrink:0}}>Path<span style={{color:"#3ECB6F"}}>flo</span></span>
              <span style={{color:"#1C2128",fontSize:"1.2rem",flexShrink:0}}>|</span>
              <span style={{color:"#8A9E8A",fontSize:"0.82rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Website Launch — Northstar Nutrition</span>
              <span style={{background:"rgba(239,68,68,0.18)",color:"#EF4444",fontSize:"0.6rem",fontWeight:700,letterSpacing:"0.08em",padding:"0.18rem 0.55rem",borderRadius:100,border:"1px solid rgba(239,68,68,0.35)",flexShrink:0}}>AT RISK</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"0.75rem",flexShrink:0}}>
              <div style={{fontSize:"0.78rem",color:"#8A9E8A",display:"flex",alignItems:"center",gap:"0.35rem"}}>
                <span style={{color:"#EF4444",fontWeight:700,fontSize:"1rem"}}>74%</span>
                <span style={{color:"#484F58"}}>→</span>
                <span style={{color:"#3ECB6F",fontWeight:700,fontSize:"1rem"}}>86%</span>
                <span>if optimized</span>
              </div>
              <div style={{background:"transparent",border:"1px solid #252D25",borderRadius:8,color:"#8A9E8A",fontSize:"0.75rem",fontWeight:500,padding:"0.35rem 0.7rem",cursor:"default"}}>⬆ Share</div>
              <div style={{background:"transparent",border:"1px solid #252D25",borderRadius:8,color:"#8A9E8A",fontSize:"0.75rem",fontWeight:500,padding:"0.35rem 0.7rem",cursor:"default"}}>✎ Revise</div>
              <div style={{background:"#3ECB6F",color:"#080A08",borderRadius:8,fontSize:"0.78rem",fontWeight:600,padding:"0.38rem 0.9rem",cursor:"default"}}>+ New</div>
            </div>
          </div>

          {/* Main layout: left nav + content */}
          <div style={{display:"flex",overflow:"hidden"}}>

            {/* Left sidebar nav — identical to results page */}
            <nav style={{width:210,background:"rgba(8,10,8,0.92)",borderRight:"1px solid #1C2128",padding:"0.85rem 0",display:"flex",flexDirection:"column",flexShrink:0}}>
              {[
                {id:"overview", label:"Overview",       icon:"⬡", active:false},
                {id:"plan",     label:"Execution Plan", icon:"◈", active:true},
                {id:"risk",     label:"Risk & Fixes",   icon:"⚠", active:false},
                {id:"workload", label:"Workload",        icon:"⊞", active:false},
                {id:"readout",  label:"AI Readout",     icon:"✦", active:false},
              ].map(n=>(
                <div key={n.id} style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.55rem 0.75rem",background:n.active?"#0A1F12":"transparent",borderLeft:n.active?"2px solid #3ECB6F":"2px solid transparent",color:n.active?"#3ECB6F":"#8A9E8A",fontSize:"0.82rem",fontWeight:n.active?600:400,cursor:"default"}}>
                  <span style={{fontSize:"0.75rem",flexShrink:0}}>{n.icon}</span>
                  {n.label}
                </div>
              ))}
              <div style={{margin:"0.75rem 0.75rem 0",padding:"0.75rem",background:"rgba(62,203,111,0.04)",border:"1px solid rgba(62,203,111,0.12)",borderRadius:8,marginTop:"auto"}}>
                <div style={{fontSize:"0.58rem",fontWeight:700,color:"#3ECB6F",letterSpacing:"0.1em",marginBottom:"0.3rem"}}>CONFIDENCE</div>
                <div style={{display:"flex",alignItems:"baseline",gap:"0.4rem"}}>
                  <span style={{fontFamily:"'Fraunces',serif",fontSize:"1.8rem",fontWeight:700,color:"#EF4444",lineHeight:1}}>74</span>
                  <span style={{fontSize:"0.7rem",color:"#EF4444"}}>%</span>
                  <span style={{fontSize:"0.7rem",color:"#484F58",marginLeft:"0.2rem"}}>→</span>
                  <span style={{fontFamily:"'Fraunces',serif",fontSize:"1.5rem",fontWeight:700,color:"#3ECB6F",lineHeight:1}}>86</span>
                  <span style={{fontSize:"0.65rem",color:"#3ECB6F"}}>%</span>
                </div>
                <div style={{fontSize:"0.62rem",color:"#484F58",marginTop:"0.2rem"}}>if optimized</div>
              </div>
            </nav>

            {/* Main content area */}
            <div style={{flex:1,minWidth:0,overflow:"auto"}}>

              {/* Section header */}
              <div style={{padding:"0.85rem 1rem",borderBottom:"1px solid #1C2128",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"0.5rem",flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                  <span style={{fontSize:"0.75rem",color:"#8A9E8A"}}>◈</span>
                  <span style={{fontSize:"0.85rem",fontWeight:600,color:"#EEF2EE"}}>Execution Plan</span>
                  <span style={{fontSize:"0.62rem",padding:"0.15rem 0.5rem",background:"rgba(239,68,68,0.08)",color:"#EF4444",border:"1px solid rgba(239,68,68,0.2)",borderRadius:100}}>⚠ Cascade risk detected</span>
                </div>
                <div style={{display:"flex",gap:"1.25rem"}}>
                  {[{l:"Tasks",v:"9"},{l:"Deps",v:"11"},{l:"Critical path",v:"6 tasks"},{l:"Buffer",v:"2d"}].map(s=>(
                    <div key={s.l} style={{fontSize:"0.7rem",color:"#8A9E8A"}}>{s.l} <span style={{color:"#EEF2EE",fontWeight:700}}>{s.v}</span></div>
                  ))}
                </div>
              </div>

              {/* Graph + right panel */}
              <div className="pv-graph-body" style={{display:"grid",gridTemplateColumns:"1fr 260px",overflow:"visible"}}>
                <DependencyGraph tasks={DEMO_TASKS} result={DEMO_RESULT} onNodeClick={(id)=>{ if(id) setDemoSelected(id); }}/>
                <div className="pv-graph-rp" style={{borderLeft:"1px solid #1C2128",padding:"1rem",display:"flex",flexDirection:"column",gap:"0.85rem"}}>
                  <div>
                    <div style={{fontSize:"0.58rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:demoRisk.fix?"#EF4444":"#22C55E",marginBottom:"0.35rem"}}>{demoRisk.fix?"BIGGEST RISK":"BUFFER STATUS"}</div>
                    <div style={{background:demoRisk.fix?"rgba(239,68,68,0.05)":"rgba(34,197,94,0.05)",border:"1px solid "+(demoRisk.fix?"rgba(239,68,68,0.18)":"rgba(34,197,94,0.18)"),borderRadius:8,padding:"0.7rem"}}>
                      <div style={{fontSize:"0.78rem",fontWeight:700,color:demoRisk.fix?"#EF4444":"#22C55E",marginBottom:"0.25rem"}}>{demoRisk.fix?"⚠ ":"✓ "}{demoRisk.title}</div>
                      <div style={{fontSize:"0.74rem",lineHeight:1.6,color:"#8A9E8A"}}>{demoRisk.blurb}</div>
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:"0.58rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:"#8A9E8A",marginBottom:"0.35rem"}}>CASCADE IMPACT — {demoNode.name.toUpperCase()}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.35rem"}}>
                      {[{l:"Delay Risk",v:demoRisk.delay,c:demoRisk.fix?"#EF4444":"#22C55E"},{l:"Blocked",v:demoRisk.blocked,c:demoRisk.fix?"#EF4444":"#22C55E"},{l:"At Risk",v:demoRisk.owners,c:demoRisk.fix?"#F59E0B":"#22C55E"},{l:"Cost",v:demoRisk.cost,c:demoRisk.fix?"#F59E0B":"#22C55E"}].map((s,i)=>(
                        <div key={i} style={{background:"#111519",border:"1px solid #1C2128",borderRadius:6,padding:"0.4rem 0.55rem"}}>
                          <div style={{fontSize:"0.54rem",fontWeight:600,textTransform:"uppercase",color:"#3E4E3E",marginBottom:"0.1rem"}}>{s.l}</div>
                          <div style={{fontSize:"0.85rem",fontWeight:700,color:s.c}}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {demoRisk.fix ? (
                    <div>
                      <div style={{fontSize:"0.58rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:"#3ECB6F",marginBottom:"0.35rem"}}>PATHFLO FIX</div>
                      <div style={{background:"#0A1F12",border:"1px solid rgba(62,203,111,0.15)",borderRadius:8,padding:"0.7rem"}}>
                        <div style={{fontSize:"0.7rem",fontWeight:700,color:"#3ECB6F",marginBottom:"0.3rem"}}>+ {demoRisk.fix.title}</div>
                        <div style={{fontSize:"0.74rem",lineHeight:1.6,color:"#8A9E8A",marginBottom:"0.5rem"}}>{demoRisk.fix.blurb}</div>
                        <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                          <div style={{fontSize:"0.58rem",color:"#3E4E3E",flexShrink:0}}>Confidence</div>
                          <div style={{flex:1,height:3,borderRadius:2,background:"#1C2128"}}>
                            <div style={{height:"100%",width:demoRisk.fix.confidence+"%",background:"#3ECB6F",borderRadius:2}}/>
                          </div>
                          <div style={{fontSize:"0.7rem",fontWeight:700,color:"#3ECB6F",flexShrink:0}}>{demoRisk.fix.confidence}%</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{fontSize:"0.72rem",lineHeight:1.6,color:"#484F58",fontStyle:"italic"}}>No action needed on this task right now.</div>
                  )}
                  <a href="/app" className="pv-btn-p" style={{fontSize:"0.8rem",padding:"0.65rem 1rem",justifyContent:"center",borderRadius:8}}>
                    Run on my project →
                  </a>
                </div>
              </div>

              {/* Legend */}
              <div style={{display:"flex",flexWrap:"wrap",gap:"1rem",padding:"0.65rem 1rem",borderTop:"1px solid #1C2128"}}>
                {[{color:"#EF4444",label:"Critical / Zero float"},{color:"#F59E0B",label:"At risk"},{color:"#22C55E",label:"On track"},{color:"#3E4E3E",label:"Has buffer"}].map((l,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:"0.4rem",fontSize:"0.67rem",color:"#8A9E8A"}}>
                    <div style={{width:8,height:8,borderRadius:3,border:"1.5px solid "+l.color,background:l.color+"18"}}/>
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>
      </RevealSection>

      {/* COMPARISON */}
      <RevealSection style={{padding:"5rem 1.5rem"}}>
        <div style={{maxWidth:780,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"2.5rem"}}>
          <div style={{fontSize:"0.65rem",color:BRAND_DEEP,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>THE DIFFERENCE</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em",color:TEXT}}>
            PM tools track the work.<br/><em style={{color:BRAND_DEEP,fontStyle:"italic",fontWeight:300}}>Pathflo predicts the outcome.</em>
          </h2>
        </div>
        <div style={{background:WHITE,border:`1px solid ${BORDER}`,borderRadius:16,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}>
            <div style={{padding:"0.85rem 1.5rem",background:OFFGREY,fontSize:"0.7rem",fontWeight:700,color:TEXT_MID,letterSpacing:"0.1em"}}>OTHER PM TOOLS</div>
            <div style={{padding:"0.85rem 1.5rem",background:`${BRAND}0A`,fontSize:"0.7rem",fontWeight:700,color:BRAND_DEEP,letterSpacing:"0.1em",display:"flex",alignItems:"center",gap:"0.4rem"}}>
              <Logo color={BRAND_DEEP} size={12}/>PATHFLO
            </div>
          </div>
          {comparison.map(({pm,pathflo},i)=>(
            <div key={i} className="pv-comp-row" style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderTop:`1px solid ${BORDER}`}}>
              <div style={{padding:"0.9rem 1.5rem",fontSize:"0.875rem",color:TEXT_MID,display:"flex",gap:"0.6rem",alignItems:"flex-start"}}>
                <span style={{color:DANGER,flexShrink:0,fontSize:"0.68rem",marginTop:"0.1rem"}}>✕</span>{pm}
              </div>
              <div className="pv-comp-right" style={{padding:"0.9rem 1.5rem",fontSize:"0.875rem",color:TEXT,display:"flex",gap:"0.6rem",alignItems:"flex-start",transition:"background 0.2s"}}>
                <span style={{color:BRAND_DEEP,flexShrink:0,fontSize:"0.68rem",marginTop:"0.1rem"}}>✓</span>{pathflo}
              </div>
            </div>
          ))}
        </div>
        </div>
      </RevealSection>

      {/* AI AGENTS */}
      <RevealSection style={{padding:"5rem 1.5rem",background:OFFGREY}}>
        <div style={{maxWidth:1000,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"2.5rem"}}>
          <div style={{fontSize:"0.65rem",color:BRAND_DEEP,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>UNDER THE HOOD</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em",marginBottom:"0.85rem",color:TEXT}}>
            Six AI agents.<br/><em style={{color:BRAND_DEEP,fontStyle:"italic",fontWeight:300}}>One analysis.</em>
          </h2>
          <p style={{color:TEXT_MID,fontSize:"0.95rem",fontWeight:400,lineHeight:1.8,maxWidth:"480px",margin:"0 auto"}}>
            Each agent does one job. Together they turn your project plan into a complete risk picture — and the reports to act on it.
          </p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"1.25rem"}}>
          {agents.map((a,i)=>{
            const [r,g,b]=hex2rgb(a.color);
            return (
              <div key={i} className="pv-card">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.65rem"}}>
                  <div style={{fontSize:"0.6rem",color:a.color,fontWeight:700,letterSpacing:"0.1em"}}>{a.n} · {a.name.toUpperCase()}</div>
                  <div style={{fontSize:"0.55rem",fontWeight:700,padding:"0.2rem 0.5rem",borderRadius:100,background:`rgba(${r},${g},${b},0.1)`,color:a.color,border:`1px solid rgba(${r},${g},${b},0.3)`}}>{a.tier}</div>
                </div>
                <p style={{fontSize:"0.82rem",color:TEXT_MID,lineHeight:1.75}}>{a.plain}</p>
              </div>
            );
          })}
        </div>
        </div>
      </RevealSection>

      {/* PRICING */}
      <RevealSection id="pricing" style={{padding:"5rem 1.5rem"}}>
        <div style={{maxWidth:1000,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"3.5rem"}}>
          <div style={{fontSize:"0.65rem",color:BRAND_DEEP,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>PRICING</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em",marginBottom:"0.75rem",color:TEXT}}>
            Start free. Upgrade when it pays for itself.
          </h2>
          <p style={{color:TEXT_MID,fontSize:"0.95rem",fontWeight:400}}>No credit card required.</p>
        </div>
        <div className="pv-pgrid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1.25rem"}}>
          {pricing.map(({name,price,period,tag,desc,items,cta,primary})=>(
            <div key={name} className={`pv-price-card ${primary?"pv-featured":""}`}>
              {tag&&<div style={{position:"absolute",top:-13,left:"50%",transform:"translateX(-50%)",background:BRAND_DEEP,color:WHITE,fontWeight:700,fontSize:"0.65rem",letterSpacing:"0.08em",padding:"0.2rem 0.85rem",borderRadius:"100px",whiteSpace:"nowrap"}}>{tag}</div>}
              <div style={{fontSize:"0.65rem",fontWeight:700,color:primary?BRAND_DEEP:TEXT_MID,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"0.65rem"}}>{name}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:"0.2rem",marginBottom:"0.5rem"}}>
                <span style={{fontFamily:"'Fraunces',serif",fontSize:"2.8rem",fontWeight:700,color:TEXT,lineHeight:1}}>{price}</span>
                <span style={{fontSize:"0.8rem",color:TEXT_DIM}}>{period}</span>
              </div>
              <p style={{fontSize:"0.83rem",color:TEXT_MID,lineHeight:1.65,marginBottom:"1.5rem"}}>{desc}</p>
              <div style={{display:"flex",flexDirection:"column",gap:"0.6rem",marginBottom:"1.75rem"}}>
                {(items||[]).map(item=>(
                  <div key={item} style={{display:"flex",gap:"0.65rem",fontSize:"0.85rem",color:TEXT,alignItems:"flex-start"}}>
                    <span style={{color:BRAND_DEEP,flexShrink:0,fontSize:"0.7rem",marginTop:"0.15rem"}}>✓</span>
                    <span style={{fontWeight:400}}>{item}</span>
                  </div>
                ))}
              </div>
              <a href="/app" className={primary?"pv-btn-p":"pv-btn-s"} style={{width:"100%",justifyContent:"center"}}>{cta}</a>
            </div>
          ))}
        </div>
        <p style={{textAlign:"center",marginTop:"1.75rem",fontSize:"0.75rem",color:TEXT_MID}}>No credit card required for free plan. Cancel anytime.</p>
        </div>
      </RevealSection>

      {/* FINAL CTA */}
      <RevealSection style={{padding:"0 1.5rem 6rem"}}>
        <div style={{maxWidth:620,margin:"0 auto",textAlign:"center",padding:"3.5rem 2rem",background:OFFGREY,border:`1px solid ${BORDER}`,borderRadius:24,boxShadow:"0 1px 2px rgba(0,0,0,.04), 0 12px 40px rgba(0,0,0,.06)"}}>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(2.1rem,5.8vw,3.4rem)",fontWeight:700,lineHeight:1.06,letterSpacing:"-0.03em",marginBottom:"1.25rem",color:TEXT}}>
            Your next project<br/><em style={{color:BRAND_DEEP,fontStyle:"italic",fontWeight:300}}>deserves a plan that works.</em>
          </h2>
          <p style={{color:TEXT_MID,fontSize:"1rem",lineHeight:1.8,marginBottom:"2.5rem",fontWeight:400}}>Set up in 5 minutes. No PM required. No credit card needed.</p>
          <a href="/app" className="pv-btn-p" style={{fontSize:"1.05rem",padding:"1.1rem 2.75rem"}}>Start my first project free →</a>
          <p style={{marginTop:"1.25rem",fontSize:"0.75rem",color:TEXT_MID}}>Free forever · No setup required</p>
        </div>
      </RevealSection>

      {/* FOOTER */}
      <footer style={{borderTop:`1px solid ${BORDER}`,background:OFFGREY,padding:"2rem 2.5rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"1rem",maxWidth:1200,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
            <Logo color={BRAND_DEEP} size={15}/>
            <span style={{fontSize:"0.75rem",color:TEXT_DIM,fontWeight:400}}>© 2026 Pathflo. All rights reserved.</span>
          </div>
          <div style={{display:"flex",gap:"2rem"}}>
            {[{label:"Privacy",href:"#"},{label:"Terms",href:"#"},{label:"Contact",href:"mailto:mike.rerecich2@gmail.com"}].map(l=>(
              <a key={l.label} href={l.href} style={{fontSize:"0.75rem",color:TEXT_DIM,textDecoration:"none"}}>{l.label}</a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
