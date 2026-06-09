"use client";
import { useState, useEffect, useRef, useMemo } from "react";

/* ─── Logo ───────────────────────────────────────────────── */
const Logo = ({ color = "#3ECB6F", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ display:"inline-block", verticalAlign:"middle" }}>
    <path d="M4 24 C8 24 10 14 15 14 C20 14 22 6 26 6 C29 6 30 12 31 14" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
    <circle cx="4" cy="24" r="3" fill={color}/>
    <circle cx="15" cy="14" r="2.5" fill={color} opacity="0.7"/>
    <circle cx="26" cy="6" r="2.5" fill={color} opacity="0.5"/>
    <circle cx="31" cy="14" r="2.5" fill={color} opacity="0.9"/>
  </svg>
);

/* ─── Demo data ──────────────────────────────────────────── */
const DEMO_TASKS = [
  { id:"t0", name:"Strategy & Planning", days:5,  owner:"Marcus",   predecessors:[], concurrent:false },
  { id:"t1", name:"Content & Copy",      days:8,  owner:"Sarah",    predecessors:["t0"], concurrent:false },
  { id:"t2", name:"Product Photography", days:6,  owner:"James",    predecessors:["t0"], concurrent:true },
  { id:"t3", name:"Design",              days:10, owner:"Marcus",   predecessors:["t1","t2"], concurrent:false },
  { id:"t4", name:"Klaviyo Setup",       days:4,  owner:"Sarah",    predecessors:["t3"], concurrent:true },
  { id:"t5", name:"Development",         days:12, owner:"Dev Team", predecessors:["t3"], concurrent:false },
  { id:"t6", name:"SEO Setup",           days:4,  owner:"Sarah",    predecessors:["t0"], concurrent:false },
  { id:"t7", name:"QA & Testing",        days:5,  owner:"Dev Team", predecessors:["t5","t4"], concurrent:false },
  { id:"t8", name:"Launch",              days:1,  owner:"Marcus",   predecessors:["t7","t6"], concurrent:false },
];
const DEMO_RESULT = {
  bufferDays:2, bottleneck:{ name:"Development" },
  tasks:[
    { id:"t0", name:"Strategy & Planning", days:5,  es:0,  ef:5,  slack:0 },
    { id:"t1", name:"Content & Copy",      days:8,  es:5,  ef:13, slack:0 },
    { id:"t2", name:"Product Photography", days:6,  es:5,  ef:11, slack:4 },
    { id:"t3", name:"Design",              days:10, es:13, ef:23, slack:0 },
    { id:"t4", name:"Klaviyo Setup",       days:4,  es:23, ef:27, slack:6 },
    { id:"t5", name:"Development",         days:12, es:23, ef:35, slack:0 },
    { id:"t6", name:"SEO Setup",           days:4,  es:5,  ef:9,  slack:8 },
    { id:"t7", name:"QA & Testing",        days:5,  es:35, ef:40, slack:0 },
    { id:"t8", name:"Launch",              days:1,  es:40, ef:41, slack:0 },
  ],
};

/* ─── DependencyGraph ────────────────────────────────────── */
function DependencyGraph({ tasks, result, dark=true }) {
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const C = {
    nodeFill:"rgba(22,27,34,0.85)", nodeBorder:"#30363D",
    text:"#E6EDF3", textDim:"#8B949E", textSub:"#484F58",
    crit:"#EF4444", critFill:"rgba(239,68,68,0.1)",
    green:"#22C55E", greenFill:"rgba(34,197,94,0.08)",
    blue:"#3B82F6", amber:"#F59E0B",
    cascadeFill:"rgba(239,68,68,0.04)", cascadeStroke:"rgba(239,68,68,0.35)",
  };
  const layout = useMemo(() => {
    if (!tasks.length || !result) return { positions:{}, W:600, H:300 };
    const levels = {};
    function assignLevel(id, lvl) {
      if (levels[id] !== undefined && levels[id] >= lvl) return;
      levels[id] = lvl;
      tasks.filter(t => t.predecessors.includes(id)).forEach(s => assignLevel(s.id, lvl+1));
    }
    tasks.filter(t => t.predecessors.length === 0).forEach(t => assignLevel(t.id, 0));
    tasks.forEach(t => { if (levels[t.id] === undefined) assignLevel(t.id, 0); });
    const byLevel = {};
    tasks.forEach(t => { const l = levels[t.id]||0; if (!byLevel[l]) byLevel[l]=[]; byLevel[l].push(t); });
    const maxLevel = Math.max(...Object.values(levels), 0);
    const maxInCol = Math.max(...Object.values(byLevel).map(g => g.length), 1);
    const NW=118, NH=50, GAP_X=64, GAP_Y=18;
    const colW = NW+GAP_X;
    const W = Math.max((maxLevel+1)*colW+GAP_X, 400);
    const H = Math.max(maxInCol*(NH+GAP_Y)-GAP_Y+80, 200);
    const positions = {};
    Object.entries(byLevel).forEach(([lvl, group]) => {
      const x = GAP_X/2 + parseInt(lvl)*colW;
      const totalH = group.length*(NH+GAP_Y)-GAP_Y;
      const startY = (H-totalH)/2;
      group.forEach((t,i) => {
        positions[t.id] = { x, y:Math.max(32, startY+i*(NH+GAP_Y)), w:NW, h:NH, cx:x+NW/2, cy:Math.max(32, startY+i*(NH+GAP_Y))+NH/2 };
      });
    });
    return { positions, W, H };
  }, [tasks, result]);
  const criticalIds = useMemo(() => new Set(result?.tasks?.filter(t => t.slack===0).map(t => t.id)||[]), [result]);
  const focusId = hoveredId || selectedId;
  const upstream = useMemo(() => {
    if (!focusId) return new Set();
    const set = new Set();
    function walk(id) { const t=tasks.find(t=>t.id===id); if(!t) return; t.predecessors.forEach(pid=>{ if(!set.has(pid)){set.add(pid);walk(pid);} }); }
    walk(focusId); return set;
  }, [focusId, tasks]);
  const downstream = useMemo(() => {
    if (!focusId) return new Set();
    const set = new Set();
    function walk(id) { tasks.filter(t=>t.predecessors.includes(id)).forEach(t=>{ if(!set.has(t.id)){set.add(t.id);walk(t.id);} }); }
    walk(focusId); return set;
  }, [focusId, tasks]);
  const connected = new Set([...upstream, ...downstream]);
  const cascadeRect = useMemo(() => {
    if (!result || criticalIds.size < 2) return null;
    const pts = [...criticalIds].map(id => layout.positions[id]).filter(Boolean);
    if (pts.length < 2) return null;
    const pad=12;
    return { x:Math.min(...pts.map(p=>p.x))-pad, y:Math.min(...pts.map(p=>p.y))-pad, w:Math.max(...pts.map(p=>p.x+p.w))+pad-(Math.min(...pts.map(p=>p.x))-pad), h:Math.max(...pts.map(p=>p.y+p.h))+pad-(Math.min(...pts.map(p=>p.y))-pad) };
  }, [criticalIds, layout.positions, result]);
  function edgePath(from, to) {
    const fx=from.x+from.w, fy=from.cy, tx=to.x, ty=to.cy, cp=(tx-fx)*0.5;
    return `M ${fx} ${fy} C ${fx+cp} ${fy}, ${tx-cp} ${ty}, ${tx} ${ty}`;
  }
  const { positions, W, H } = layout;
  if (!tasks.length || !result) return null;
  return (
    <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch", width:"100%" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display:"block", minWidth:W }}>
        <defs>
          <marker id="lp-arr-c" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={C.crit} opacity="0.85"/></marker>
          <marker id="lp-arr-n" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={C.textSub} opacity="0.5"/></marker>
          <marker id="lp-arr-u" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={C.blue} opacity="0.9"/></marker>
          <marker id="lp-arr-d" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={C.crit} opacity="0.7"/></marker>
          <marker id="lp-arr-dim" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={C.textSub} opacity="0.2"/></marker>
          <filter id="lp-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {cascadeRect && (
          <g>
            <rect x={cascadeRect.x} y={cascadeRect.y} width={cascadeRect.w} height={cascadeRect.h} rx="10" fill={C.cascadeFill} stroke={C.cascadeStroke} strokeWidth="1" strokeDasharray="6 4"/>
            <text x={cascadeRect.x+9} y={cascadeRect.y+13} fontSize="7.5" fontFamily="system-ui" fontWeight="700" fill="rgba(239,68,68,0.7)" letterSpacing="0.08em">CASCADE IMPACT ZONE</text>
          </g>
        )}
        {tasks.map(t => t.predecessors.map(pid => {
          const from=positions[pid], to=positions[t.id];
          if (!from||!to) return null;
          const isCritE=criticalIds.has(pid)&&criticalIds.has(t.id);
          const isUp=focusId&&upstream.has(pid)&&(upstream.has(t.id)||t.id===focusId);
          const isDown=focusId&&downstream.has(t.id)&&(downstream.has(pid)||pid===focusId);
          const isDim=focusId&&!isUp&&!isDown&&pid!==focusId&&t.id!==focusId;
          const stroke=isDim?`${C.textSub}33`:isUp?C.blue:isDown?C.crit:isCritE?`${C.crit}AA`:`${C.textSub}55`;
          const marker=isDim?"url(#lp-arr-dim)":isUp?"url(#lp-arr-u)":isDown?"url(#lp-arr-d)":isCritE?"url(#lp-arr-c)":"url(#lp-arr-n)";
          return <path key={`${pid}-${t.id}`} d={edgePath(from,to)} fill="none" stroke={stroke} strokeWidth={isDim?1:isCritE||isUp||isDown?2:1.5} markerEnd={marker} strokeDasharray={t.concurrent?"5 4":"none"} style={{ transition:"stroke 0.2s" }}/>;
        }))}
        {tasks.map(t => {
          const pos=positions[t.id]; if (!pos) return null;
          const rt=result.tasks.find(r=>r.id===t.id);
          const isCrit=criticalIds.has(t.id);
          const isSelected=t.id===selectedId;
          const isUp=upstream.has(t.id), isDown=downstream.has(t.id);
          const isDim=focusId&&t.id!==focusId&&!connected.has(t.id);
          const showBlocked=result.bufferDays<0&&isCrit&&t.predecessors.some(pid=>{const p=tasks.find(tt=>tt.id===pid);return p&&p.name===result.bottleneck?.name;});
          const floatDays=rt?.slack||0;
          const fill=isDim?"rgba(15,20,15,0.5)":isSelected?`${C.blue}22`:isUp?`${C.blue}18`:isDown?`${C.crit}12`:isCrit?C.critFill:t.concurrent?C.greenFill:C.nodeFill;
          const stroke=isDim?"#1E251E":isSelected?C.blue:isUp?C.blue:isDown?C.crit:isCrit?C.crit:C.nodeBorder;
          const strokeW=isDim?1:(isSelected||isUp||isDown||isCrit)?2:1.5;
          const textFill=isDim?C.textSub:isSelected?C.blue:isUp?C.blue:isDown?C.crit:isCrit?C.crit:C.text;
          const subFill=isDim?C.textSub:showBlocked?C.crit:isUp?`${C.blue}CC`:isDown?`${C.crit}CC`:C.textDim;
          const dotFill=isDim?"#252D25":isCrit?C.crit:C.green;
          const subLabel=showBlocked?`Blocked by ${result.bottleneck?.name}`.slice(0,20):`${t.days}d · ${(t.owner==="UNASSIGNED"?"Unassigned":t.owner)||"?"}`.slice(0,18);
          return (
            <g key={t.id} style={{ cursor:"pointer", opacity:isDim?0.3:1, transition:"opacity 0.2s" }}
              onClick={()=>setSelectedId(t.id===selectedId?null:t.id)}
              onMouseEnter={()=>setHoveredId(t.id)} onMouseLeave={()=>setHoveredId(null)}
              filter={isSelected?"url(#lp-glow)":undefined}>
              {isSelected&&<rect x={pos.x-4} y={pos.y-4} width={pos.w+8} height={pos.h+8} rx="13" fill="none" stroke={`${C.blue}33`} strokeWidth="2"/>}
              <rect x={pos.x} y={pos.y} width={pos.w} height={pos.h} rx="8" fill={fill} stroke={stroke} strokeWidth={strokeW} style={{ transition:"fill 0.2s, stroke 0.2s" }}/>
              {isCrit&&!isDim&&<rect x={pos.x+1} y={pos.y+1} width={pos.w-2} height="2" rx="1" fill={C.crit} opacity="0.55"/>}
              <text x={pos.x+9} y={pos.y+18} fontSize="10" fontFamily="system-ui" fontWeight={isCrit?"700":"500"} fill={isDim?C.textSub:textFill} style={{ transition:"fill 0.2s" }}>
                {t.name.length>14?t.name.slice(0,13)+"…":t.name}
              </text>
              <text x={pos.x+9} y={pos.y+32} fontSize="8.5" fontFamily="system-ui" fontWeight="400" fill={isDim?C.textSub:subFill} style={{ transition:"fill 0.2s" }}>
                {subLabel}
              </text>
              <circle cx={pos.x+pos.w-11} cy={pos.y+12} r="3.5" fill={dotFill} style={{ transition:"fill 0.2s" }}/>
              {floatDays>0&&!isDim&&(
                <g>
                  <rect x={pos.x+pos.w-28} y={pos.y+pos.h-13} width={24} height={10} rx="3" fill="rgba(34,197,94,0.18)"/>
                  <text x={pos.x+pos.w-16} y={pos.y+pos.h-5} fontSize="7" fontFamily="system-ui" fontWeight="700" fill={C.green} textAnchor="middle">+{floatDays}d</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── SectionBubble ──────────────────────────────────────── */
function SectionBubble({ children, id, maxWidth="1100px", glowColor="rgba(62,203,111,0.06)" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.08 });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} id={id} style={{
      position:"relative", zIndex:1, padding:"0 1.5rem", margin:"0 auto 5rem",
      maxWidth, transition:"opacity 0.7s ease, transform 0.7s ease",
      opacity: visible?1:0, transform: visible?"translateY(0)":"translateY(32px)",
    }}>
      {visible && (
        <div style={{
          position:"absolute", inset:0,
          background:`radial-gradient(ellipse 80% 60% at 50% 50%, ${glowColor} 0%, transparent 70%)`,
          pointerEvents:"none", zIndex:0, borderRadius:32,
        }}/>
      )}
      <div style={{ position:"relative", zIndex:1 }}>{children}</div>
    </div>
  );
}

/* ─── TerminalWindow ─────────────────────────────────────── */
function TerminalWindow() {
  const [visible, setVisible] = useState(0);
  const lines = [
    { text: '$ pathflo analyze "Website Launch"',       color: '#3ECB6F' },
    { text: '  Mapping 9 tasks, 11 dependencies...',    color: '#8B949E' },
    { text: '  Running critical path algorithm...',     color: '#8B949E' },
    { text: '  ⚠  Bottleneck: Development (0d float)', color: '#EF4444' },
    { text: '  Simulating cascade scenarios...',        color: '#8B949E' },
    { text: '  ✓  On-time confidence: 86%',            color: '#3ECB6F' },
    { text: '  ✓  Executive report ready to share',    color: '#3ECB6F' },
  ];
  useEffect(() => {
    if (visible < lines.length) {
      const t = setTimeout(() => setVisible(v => v + 1), visible === 0 ? 500 : 720);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setVisible(0), 4200);
      return () => clearTimeout(t);
    }
  }, [visible]);
  return (
    <div style={{
      background:"#0D1117", border:"1px solid #1C2128", borderRadius:14, overflow:"hidden",
      boxShadow:"0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(62,203,111,0.06), inset 0 1px 0 rgba(255,255,255,0.03)",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"11px 16px", background:"#161B22", borderBottom:"1px solid #1C2128" }}>
        <div style={{ width:11, height:11, borderRadius:"50%", background:"#FF5F57" }}/>
        <div style={{ width:11, height:11, borderRadius:"50%", background:"#FEBC2E" }}/>
        <div style={{ width:11, height:11, borderRadius:"50%", background:"#28C840" }}/>
        <span style={{ marginLeft:10, fontSize:"0.7rem", color:"#484F58", fontFamily:"system-ui", letterSpacing:"0.04em" }}>
          pathflo — analysis
        </span>
      </div>
      <div style={{ padding:"20px 22px", minHeight:192 }}>
        {lines.slice(0, visible).map((line, i) => (
          <div key={i} style={{
            color:line.color, lineHeight:1.85,
            fontFamily:"'DM Mono', 'Courier New', monospace", fontSize:"0.8rem",
            animation:"termLine 0.18s ease both",
          }}>
            {line.text}
          </div>
        ))}
        {visible > 0 && visible < lines.length && (
          <span style={{ color:"#3ECB6F", fontFamily:"monospace", animation:"blink 1s step-end infinite" }}>▌</span>
        )}
      </div>
    </div>
  );
}

/* ─── ConfidenceWidget ───────────────────────────────────── */
function ConfidenceWidget({ T }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setPct(86), 2600);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{
      background:"rgba(13,17,23,0.9)", border:"1px solid #1C2128",
      borderRadius:12, padding:"1rem 1.25rem",
      backdropFilter:"blur(12px)",
      boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
      display:"flex", flexDirection:"column", gap:"0.6rem",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:"0.68rem", fontWeight:700, letterSpacing:"0.08em", color:"#484F58", textTransform:"uppercase" }}>
          ON-TIME CONFIDENCE
        </span>
        <span style={{
          fontSize:"1.1rem", fontWeight:700, color:"#3ECB6F",
          fontFamily:"'Fraunces', serif",
          transition:"all 1.2s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          {pct}%
        </span>
      </div>
      <div style={{ height:4, borderRadius:2, background:"#1C2128", overflow:"hidden" }}>
        <div style={{
          height:"100%", borderRadius:2, background:"linear-gradient(90deg, #3ECB6F, #22C55E)",
          width:`${pct}%`, transition:"width 1.4s cubic-bezier(0.34,1.56,0.64,1)",
          boxShadow:"0 0 8px rgba(62,203,111,0.5)",
        }}/>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.72rem" }}>
        <span style={{ color:"#EF4444", display:"flex", alignItems:"center", gap:"0.3rem" }}>
          <span>⚠</span> Dev bottleneck
        </span>
        <span style={{ color:"#8A9E8A" }}>2d buffer left</span>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const T = {
    bg:"#080A08", surface:"#0D1117", surface2:"#111519",
    border:"#1C2128", border2:"#252D25",
    text:"#EEF2EE", textMid:"#8A9E8A", textDim:"#3E4E3E",
    green:"#3ECB6F", greenDim:"#0A1F12", greenMid:"#0F2B1A",
    amber:"#F59E0B", red:"#EF4444", blue:"#3B82F6",
    navBg:"rgba(8,10,8,0.92)",
    shadow:"0 8px 40px rgba(0,0,0,0.5)",
  };

  const btnPrimary = {
    display:"inline-flex", alignItems:"center", justifyContent:"center", gap:"0.5rem",
    background:T.green, color:"#080A08",
    border:"none", borderRadius:"100px", fontFamily:"inherit", fontWeight:700,
    fontSize:"0.95rem", padding:"0.9rem 2rem", cursor:"pointer", textDecoration:"none",
    boxShadow:"0 0 0 1px rgba(62,203,111,0.3), 0 8px 32px rgba(62,203,111,0.22)",
    transition:"transform 0.15s, box-shadow 0.15s",
  };
  const btnSecondary = {
    display:"inline-flex", alignItems:"center", justifyContent:"center",
    background:"transparent", color:T.textMid, border:"1.5px solid " + T.border2,
    borderRadius:"100px", fontFamily:"inherit", fontWeight:500, fontSize:"0.95rem",
    padding:"0.9rem 2rem", cursor:"pointer", textDecoration:"none", transition:"all 0.15s",
  };

  const steps = [
    {
      n:"01", color:T.blue, icon:"⬡",
      title:"Map your project",
      desc:"Add tasks, set durations, assign owners, and define which tasks depend on each other. Takes about 5 minutes.",
    },
    {
      n:"02", color:T.amber, icon:"⟳",
      title:"Pathflo finds the risks",
      desc:"Critical path is calculated instantly. Bottlenecks are flagged. Cascade impacts are simulated — automatically.",
    },
    {
      n:"03", color:T.green, icon:"↗",
      title:"Execute with confidence",
      desc:"Share a live project health report with clients. Get early risk alerts. Defend your timeline with data.",
    },
  ];

  const questions = [
    { q:"Will this project finish on time?", a:"Pathflo scores on-time confidence before a single day of work begins. Not a feeling — a probability backed by your actual dependency chain.", icon:"◈" },
    { q:"Who's most likely to break it?", a:"Workload Intelligence flags which team members own the most critical work and surfaces single points of failure before they become emergencies.", icon:"⊞" },
    { q:"What cascades if this task slips?", a:"The cascade simulator shows exactly which tasks get blocked, how many days you lose, and what it costs — in real time.", icon:"⚡" },
    { q:"How do I explain this to my client?", a:"One tap generates a shareable executive readout — formatted to forward. No PM skills needed to send it or understand it.", icon:"↗" },
  ];

  const testimonials = [
    {
      quote:"We caught a cascade risk that would have pushed our launch back 3 weeks. We found it during planning — not mid-execution.",
      author:"Sarah M.", role:"Product Lead, SaaS Agency", initials:"SM", color:T.blue,
    },
    {
      quote:"I sent the Pathflo report to a skeptical client and they stopped questioning the timeline. The data spoke for itself.",
      author:"Alex R.", role:"Freelance Project Manager", initials:"AR", color:T.green,
    },
    {
      quote:"The dependency graph made my whole team finally understand why some tasks can't start early. That alone was worth it.",
      author:"James K.", role:"Engineering Manager", initials:"JK", color:T.amber,
    },
  ];

  const comparison = [
    { pm:"Store your tasks",                pathflo:"Predict your outcomes before work begins" },
    { pm:"Tell you you're behind",          pathflo:"Tell you why — before it happens" },
    { pm:"Show you a Gantt chart",          pathflo:"Show you the critical path, cascade risks, and what to fix" },
    { pm:"Track what exists",               pathflo:"Forecast what's coming — confidence, failure probability, buffer" },
    { pm:"No workload visibility",          pathflo:"Flags who's overloaded and who's a single point of failure" },
    { pm:"Require a PM to read the output", pathflo:"One-tap shareable report — forward it from your phone" },
    { pm:"React to problems",               pathflo:"Prevent them" },
  ];

  const pricing = [
    {
      name:"Solo", price:"$49", period:"/mo", tag:null,
      desc:"For contractors and independent operators managing client projects.",
      items:["1 active project","Critical path + dependency graph","Cascade simulator","Workload intelligence","Shareable readout","Risk & bottleneck detection","CSV export"],
      cta:"Start free", primary:false,
    },
    {
      name:"Team", price:"$99", period:"/mo", tag:"Most popular",
      desc:"For agencies and small teams managing multiple projects at once.",
      items:["Unlimited projects","Everything in Solo","Multi-owner dependency mapping","Cascade impact simulator","Priority support"],
      cta:"Start free", primary:true,
    },
    {
      name:"Business", price:"$299", period:"/mo", tag:null,
      desc:"For growing operations that need stakeholder-ready reporting.",
      items:["Everything in Team","Shareable leadership reports","Industry templates","Custom risk weights","Dedicated onboarding"],
      cta:"Contact us", primary:false,
    },
  ];

  const pillars = [
    {
      n:"01 · Timeline Health", title:"How tight is the schedule?",
      color:"#3B82F6",
      vals:[0.74, 0.81, 0.65], labels:["DEPENDENCY","ACCURACY","STABILITY"],
      pct:"74%", pctLabel:"DEPENDENCY",
      stats:[
        { name:"Dependency Compression", val:"74%", color:"#3B82F6" },
        { name:"Forecast Accuracy",       val:"81%", color:"#22C55E" },
        { name:"Schedule Stability",      val:"65%", color:"#F59E0B" },
      ],
    },
    {
      n:"02 · Workload Intel", title:"Who's carrying the most risk?",
      color:"#3ECB6F",
      vals:[0.62, 0.55, 0.80], labels:["OVERLOAD","CAPACITY","APPROVAL"],
      pct:"62%", pctLabel:"OVERLOAD",
      stats:[
        { name:"Team Overload",  val:"62%", color:"#EF4444" },
        { name:"Owner Capacity", val:"55%", color:"#F59E0B" },
        { name:"Approval Flow",  val:"80%", color:"#22C55E" },
      ],
    },
    {
      n:"03 · Operational Health", title:"Is the execution plan efficient?",
      color:"#22C55E",
      vals:[0.78, 0.85, 0.70], labels:["STABILITY","EXECUTION","EFFICIENCY"],
      pct:"78%", pctLabel:"STABILITY",
      stats:[
        { name:"Plan Stability",        val:"78%", color:"#22C55E" },
        { name:"Execution Confidence",  val:"85%", color:"#22C55E" },
        { name:"Structural Efficiency", val:"70%", color:"#F59E0B" },
      ],
    },
  ];

  return (
    <main style={{ background:T.bg, color:T.text, fontFamily:"'DM Sans', system-ui, sans-serif", overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@300;400;500&family=Fraunces:ital,wght@0,300;0,700;1,300;1,700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#252D25;border-radius:2px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes rotate{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{opacity:0.4}50%{opacity:0.7}100%{opacity:0.4}}
        @keyframes termLine{from{opacity:0;transform:translateX(-4px)}to{opacity:1;transform:translateX(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes gridPulse{0%,100%{opacity:0.4}50%{opacity:0.7}}
        @keyframes floatUp{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        .h1{animation:fadeUp 0.8s 0.05s ease both}
        .h2{animation:fadeUp 0.8s 0.2s ease both}
        .h3{animation:fadeUp 0.8s 0.35s ease both}
        .h4{animation:fadeUp 0.8s 0.5s ease both}
        .h5{animation:fadeUp 0.8s 0.65s ease both}
        .btnp:hover{transform:translateY(-2px)!important;box-shadow:0 0 0 1px rgba(62,203,111,0.5),0 12px 40px rgba(62,203,111,0.35)!important}
        .btns:hover{border-color:#3ECB6F!important;color:#3ECB6F!important}
        .navlink:hover{color:#EEF2EE!important}
        .card{transition:transform 0.2s,box-shadow 0.2s}
        .card:hover{transform:translateY(-3px)!important;box-shadow:0 12px 48px rgba(0,0,0,0.4)!important}
        .step-card:hover{border-color:rgba(62,203,111,0.2)!important}
        .tcard:hover{border-color:rgba(62,203,111,0.18)!important}
        .comp-row:hover .comp-right{background:rgba(62,203,111,0.05)!important}
        .terminal-float{animation:floatUp 5s ease-in-out infinite}
        @media(max-width:900px){
          .hero-grid{grid-template-columns:1fr!important}
          .hero-right{display:none!important}
          .steps-grid{grid-template-columns:1fr!important}
          .tgrid{grid-template-columns:1fr!important}
          .pgrid{grid-template-columns:1fr!important}
          .pillars-grid{grid-template-columns:1fr!important}
          .graph-body{grid-template-columns:1fr!important}
          .graph-right-panel{border-left:none!important;border-top:1px solid #1C2128!important}
          .navlinks{display:none!important}
          .hbtns{flex-direction:column!important;align-items:stretch!important}
          .hero-stats{gap:2rem!important;flex-wrap:wrap!important;justify-content:center!important}
          .comp-cell{padding:0.75rem 1rem!important;font-size:0.8rem!important}
          .metrics-strip{gap:2rem!important;flex-wrap:wrap!important}
        }
        @media(max-width:600px){
          .qgrid{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* ── BACKGROUND ── */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
        {/* Dot grid */}
        <div style={{
          position:"absolute", inset:0,
          backgroundImage:"radial-gradient(rgba(62,203,111,0.09) 1px, transparent 1px)",
          backgroundSize:"44px 44px",
          animation:"gridPulse 12s ease-in-out infinite",
        }}/>
        {/* Main eclipse glow */}
        <div style={{
          position:"absolute", top:"-30vh", left:"50%", transform:"translateX(-50%)",
          width:"900px", height:"900px", borderRadius:"50%",
          background:"radial-gradient(ellipse at center, rgba(62,203,111,0.07) 0%, rgba(62,203,111,0.03) 35%, transparent 65%)",
          animation:"shimmer 8s ease-in-out infinite",
        }}/>
        <div style={{
          position:"absolute", top:"-10vh", left:"50%", transform:"translateX(-50%)",
          width:"500px", height:"500px", borderRadius:"50%",
          background:"radial-gradient(ellipse at center, rgba(62,203,111,0.04) 0%, transparent 70%)",
        }}/>
        {/* Orbital rings */}
        <div style={{ position:"absolute", top:"-20vh", left:"50%", transform:"translateX(-50%)", width:"700px", height:"700px", borderRadius:"50%", border:"1px solid rgba(62,203,111,0.04)" }}/>
        <div style={{ position:"absolute", top:"-15vh", left:"50%", transform:"translateX(-50%)", width:"850px", height:"850px", borderRadius:"50%", border:"1px solid rgba(62,203,111,0.025)" }}/>
        {/* Bottom ambient blue */}
        <div style={{
          position:"absolute", bottom:"-20vh", left:"20%",
          width:"600px", height:"600px", borderRadius:"50%",
          background:"radial-gradient(ellipse at center, rgba(59,130,246,0.03) 0%, transparent 65%)",
        }}/>
      </div>

      {/* ── NAV ── */}
      <nav style={{
        position:"fixed", top:0, left:0, right:0, zIndex:200, height:64,
        display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 2rem",
        background: scrolled ? T.navBg : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid " + T.border : "none",
        transition:"all 0.4s",
      }}>
        <a href="/" style={{ textDecoration:"none", display:"flex", alignItems:"center", gap:"0.5rem" }}>
          <Logo color={T.green} size={22}/>
          <span style={{ fontWeight:700, fontSize:"1.05rem", color:T.text, letterSpacing:"-0.02em" }}>
            Path<span style={{ color:T.green }}>flo</span>
          </span>
        </a>
        <div className="navlinks" style={{ display:"flex", alignItems:"center", gap:"2.5rem" }}>
          {[["#how","How it works"],["#why","Why it works"],["#graph","See it live"],["#pricing","Pricing"]].map(([href,label]) => (
            <a key={href} className="navlink" href={href} style={{ color:T.textMid, fontSize:"0.875rem", textDecoration:"none", transition:"color 0.2s", fontWeight:400 }}>{label}</a>
          ))}
        </div>
        <a href="/app" className="btnp" style={{ ...btnPrimary, padding:"0.55rem 1.35rem", fontSize:"0.875rem" }}>Launch app</a>
      </nav>

      {/* ── HERO ── */}
      <section style={{ position:"relative", zIndex:1, padding:"140px 2rem 100px", maxWidth:1200, margin:"0 auto" }}>
        <div className="hero-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4rem", alignItems:"center" }}>

          {/* Left column */}
          <div>
            <div className="h1" style={{ marginBottom:"1.75rem" }}>
              <span style={{
                display:"inline-flex", alignItems:"center", gap:"0.5rem",
                background:"rgba(13,17,13,0.8)", border:"1px solid " + T.border2,
                borderRadius:"100px", padding:"0.4rem 1.1rem",
                fontSize:"0.68rem", fontWeight:600, color:T.textMid, letterSpacing:"0.1em",
                backdropFilter:"blur(8px)",
              }}>
                <span style={{ width:5, height:5, borderRadius:"50%", background:T.green, animation:"pulse 2s infinite", flexShrink:0 }}/>
                NOW LIVE — PLAN YOUR FIRST PROJECT FREE
              </span>
            </div>

            <h1 className="h2" style={{
              fontFamily:"'Fraunces', serif",
              fontSize:"clamp(2.8rem, 6vw, 4.4rem)",
              fontWeight:700, lineHeight:1.05, letterSpacing:"-0.03em",
              marginBottom:"1.5rem",
            }}>
              Know if your project<br/>
              will ship on time —<br/>
              <em style={{ color:T.green, fontStyle:"italic", fontWeight:300 }}>before work begins.</em>
            </h1>

            <p className="h3" style={{
              fontSize:"clamp(1rem, 2vw, 1.1rem)", color:T.textMid,
              lineHeight:1.85, maxWidth:"460px", marginBottom:"2.5rem", fontWeight:300,
            }}>
              Map your tasks, define your dependencies, and Pathflo instantly surfaces your critical path, bottlenecks, and cascade risks.{" "}
              <span style={{ fontWeight:500, color:T.text }}>No PM required.</span>
            </p>

            <div className="h4 hbtns" style={{ display:"flex", gap:"1rem", marginBottom:"3.5rem" }}>
              <a href="/app" className="btnp" style={{ ...btnPrimary, fontSize:"1rem", padding:"1rem 2.25rem" }}>Build my first plan →</a>
              <a href="#how" className="btns" style={btnSecondary}>See how it works</a>
            </div>

            {/* Stats */}
            <div className="h5 hero-stats" style={{ display:"flex", gap:"3rem" }}>
              {[
                { val:"5 min",    label:"To your first risk report" },
                { val:"5 screens",label:"Of execution intelligence" },
                { val:"1 tap",    label:"To share with a client" },
              ].map(({ val, label }) => (
                <div key={val} style={{ textAlign:"left" }}>
                  <div style={{ fontFamily:"'Fraunces', serif", fontSize:"1.6rem", fontWeight:700, color:T.text, letterSpacing:"-0.02em" }}>{val}</div>
                  <div style={{ fontSize:"0.68rem", color:T.textDim, fontWeight:500, letterSpacing:"0.07em", marginTop:"0.2rem", textTransform:"uppercase" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — terminal + confidence widget */}
          <div className="hero-right terminal-float" style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
            <TerminalWindow />
            <ConfidenceWidget T={T} />
          </div>

        </div>
      </section>

      {/* ── METRICS STRIP ── */}
      <div style={{ position:"relative", zIndex:1, borderTop:"1px solid " + T.border, borderBottom:"1px solid " + T.border, padding:"1.5rem 2rem", background:"rgba(13,17,19,0.5)", backdropFilter:"blur(8px)" }}>
        <div className="metrics-strip" style={{ display:"flex", justifyContent:"center", gap:"4rem", maxWidth:900, margin:"0 auto" }}>
          {[
            { val:"500+",   label:"Project leaders" },
            { val:"12,000+",label:"Projects analyzed" },
            { val:"87%",    label:"Average on-time rate" },
            { val:"$0",     label:"To start — no card needed" },
          ].map(({ val, label }) => (
            <div key={val} style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"'Fraunces', serif", fontSize:"1.4rem", fontWeight:700, color:T.green, letterSpacing:"-0.02em" }}>{val}</div>
              <div style={{ fontSize:"0.68rem", color:T.textDim, fontWeight:500, letterSpacing:"0.06em", marginTop:"0.15rem", textTransform:"uppercase" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <SectionBubble id="how" maxWidth="1050px" glowColor="rgba(59,130,246,0.05)">
        <div style={{ textAlign:"center", marginBottom:"3rem" }}>
          <div style={{ fontSize:"0.65rem", color:T.green, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"0.75rem" }}>HOW IT WORKS</div>
          <h2 style={{ fontFamily:"'Fraunces', serif", fontSize:"clamp(1.8rem, 4vw, 2.6rem)", fontWeight:700, lineHeight:1.1, letterSpacing:"-0.025em" }}>
            From tasks to execution plan<br/>
            <em style={{ color:T.green, fontStyle:"italic", fontWeight:300 }}>in under five minutes.</em>
          </h2>
        </div>
        <div className="steps-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1.5rem" }}>
          {steps.map((step, i) => (
            <div key={i} className="card step-card" style={{
              background:T.surface, border:"1px solid " + T.border,
              borderRadius:16, padding:"1.75rem", position:"relative", overflow:"hidden",
              transition:"transform 0.2s, box-shadow 0.2s, border-color 0.2s",
            }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:step.color, opacity:0.7 }}/>
              <div style={{
                width:44, height:44, borderRadius:12,
                background:`${step.color}12`, border:`1px solid ${step.color}30`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:"1.2rem", marginBottom:"1.25rem",
                color:step.color,
              }}>
                {step.icon}
              </div>
              <div style={{ fontSize:"0.6rem", fontWeight:700, letterSpacing:"0.1em", color:step.color, marginBottom:"0.4rem", textTransform:"uppercase" }}>{step.n}</div>
              <div style={{ fontSize:"1rem", fontWeight:700, color:T.text, marginBottom:"0.75rem", lineHeight:1.3 }}>{step.title}</div>
              <div style={{ fontSize:"0.875rem", color:T.textMid, lineHeight:1.75, fontWeight:300 }}>{step.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"center", marginTop:"2.5rem" }}>
          <a href="/app" className="btnp" style={{ ...btnPrimary }}>Start mapping my project →</a>
        </div>
      </SectionBubble>

      {/* ── FOUR QUESTIONS — chatbot style ── */}
      <SectionBubble id="why" maxWidth="820px" glowColor="rgba(62,203,111,0.07)">
        <div style={{ textAlign:"center", marginBottom:"2.5rem" }}>
          <div style={{ fontSize:"0.65rem", color:T.green, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"0.75rem" }}>WHY IT WORKS</div>
          <h2 style={{ fontFamily:"'Fraunces', serif", fontSize:"clamp(1.8rem, 4vw, 2.6rem)", fontWeight:700, lineHeight:1.1, letterSpacing:"-0.025em" }}>
            Four questions every PM has.<br/>
            <em style={{ color:T.green, fontStyle:"italic", fontWeight:300 }}>Pathflo answers all of them.</em>
          </h2>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem", maxWidth:680, margin:"0 auto" }}>
          {questions.map(({ q, a, icon }, i) => (
            <div key={i} style={{ display:"flex", flexDirection:"column", gap:"0.4rem" }}>
              <div style={{ display:"flex", justifyContent:"flex-end" }}>
                <div style={{
                  background:"rgba(62,203,111,0.08)", border:"1px solid rgba(62,203,111,0.2)",
                  borderRadius:"18px 18px 4px 18px", padding:"0.7rem 1.1rem",
                  maxWidth:"80%", fontSize:"0.9rem", fontWeight:500, color:T.green, lineHeight:1.5,
                }}>{q}</div>
              </div>
              <div style={{ display:"flex", justifyContent:"flex-start", gap:"0.5rem", alignItems:"flex-start" }}>
                <div style={{
                  width:30, height:30, borderRadius:"50%", background:T.greenDim,
                  border:"1px solid " + T.border2, flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:"0.7rem", color:T.green, fontWeight:700, marginTop:2,
                }}>{icon}</div>
                <div style={{
                  background:T.surface, border:"1px solid " + T.border,
                  borderRadius:"4px 18px 18px 18px", padding:"0.75rem 1.1rem",
                  maxWidth:"85%", fontSize:"0.875rem", color:T.textMid, lineHeight:1.7,
                }}>{a}</div>
              </div>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"center", marginTop:"0.5rem" }}>
            <a href="/app" className="btnp" style={{ ...btnPrimary, fontSize:"0.9rem" }}>Try it on my project →</a>
          </div>
        </div>
      </SectionBubble>

      {/* ── DEPENDENCY GRAPH ── */}
      <SectionBubble id="graph" maxWidth="1140px" glowColor="rgba(62,203,111,0.05)">
        <div style={{ textAlign:"center", marginBottom:"2.5rem" }}>
          <div style={{ fontSize:"0.65rem", color:T.green, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"0.75rem" }}>DEPENDENCY INTELLIGENCE</div>
          <h2 style={{ fontFamily:"'Fraunces', serif", fontSize:"clamp(1.8rem, 4vw, 2.6rem)", fontWeight:700, lineHeight:1.1, letterSpacing:"-0.025em", marginBottom:"0.85rem" }}>
            See the failure chain<br/>
            <em style={{ color:T.green, fontStyle:"italic", fontWeight:300 }}>before it happens.</em>
          </h2>
          <p style={{ color:T.textMid, fontSize:"0.95rem", fontWeight:300, lineHeight:1.8, maxWidth:"480px", margin:"0 auto" }}>
            Every dependency mapped. Every cascade risk surfaced. Every optimization identified — before a single day of work begins.
          </p>
        </div>
        <div style={{ background:T.surface, border:"1px solid " + T.border, borderRadius:20, overflow:"hidden", boxShadow:T.shadow }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1rem 1.5rem", borderBottom:"1px solid " + T.border, flexWrap:"wrap", gap:"0.5rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"0.6rem", fontSize:"0.85rem", fontWeight:600, color:T.text }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:T.green, display:"inline-block", animation:"pulse 2s infinite" }}/>
              Website Launch — Northstar Nutrition
            </div>
            <div style={{ display:"flex", gap:"1.5rem", flexWrap:"wrap" }}>
              {[{ label:"Tasks", val:"9" },{ label:"Dependencies", val:"11" },{ label:"Critical Path", val:"5 tasks" }].map(s => (
                <div key={s.label} style={{ fontSize:"0.72rem", color:T.textMid }}>
                  {s.label} <span style={{ color:T.text, fontWeight:700 }}>{s.val}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:"0.68rem", borderRadius:6, padding:"0.25rem 0.75rem", fontWeight:700, letterSpacing:"0.06em", background:"rgba(239,68,68,0.08)", color:"#EF4444", border:"1px solid rgba(239,68,68,0.25)" }}>
              ⚠ CASCADE RISK DETECTED
            </div>
          </div>
          <div className="graph-body" style={{ display:"grid", gridTemplateColumns:"1fr 272px", overflow:"visible" }}>
            <DependencyGraph tasks={DEMO_TASKS} result={DEMO_RESULT} dark={true}/>
            <div className="graph-right-panel" style={{ borderLeft:"1px solid " + T.border, padding:"1.25rem", display:"flex", flexDirection:"column", gap:"1rem" }}>
              <div>
                <div style={{ fontSize:"0.6rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:"#EF4444", marginBottom:"0.4rem" }}>BIGGEST RISK</div>
                <div style={{ background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:10, padding:"0.85rem" }}>
                  <div style={{ fontSize:"0.8rem", fontWeight:700, color:"#EF4444", marginBottom:"0.3rem" }}>⚠ Development is the bottleneck</div>
                  <div style={{ fontSize:"0.77rem", lineHeight:1.65, color:T.textMid }}>QA & Testing can't start until it's done. 2 days of buffer remain — any slip cascades into Launch.</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize:"0.6rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:T.textMid, marginBottom:"0.4rem" }}>CASCADE IMPACT</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.4rem" }}>
                  {[{ label:"Delay Risk", val:"+5–7d", color:"#EF4444" },{ label:"Tasks Blocked", val:"3 tasks", color:"#EF4444" },{ label:"Owners at Risk", val:"3 people", color:T.amber },{ label:"Cost Exposure", val:"$4,200", color:T.amber }].map((s,i) => (
                    <div key={i} style={{ background:T.surface2, border:"1px solid " + T.border, borderRadius:8, padding:"0.5rem 0.65rem" }}>
                      <div style={{ fontSize:"0.56rem", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", color:T.textDim, marginBottom:"0.15rem" }}>{s.label}</div>
                      <div style={{ fontSize:"0.9rem", fontWeight:700, color:s.color }}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:"0.6rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", color:T.green, marginBottom:"0.4rem" }}>PATHFLO FIX</div>
                <div style={{ background:T.greenDim, border:"1px solid rgba(62,203,111,0.15)", borderRadius:10, padding:"0.85rem" }}>
                  <div style={{ fontSize:"0.72rem", fontWeight:700, color:T.green, marginBottom:"0.35rem" }}>+ Run Photography in parallel with Design</div>
                  <div style={{ fontSize:"0.77rem", lineHeight:1.65, color:T.textMid }}>Recovers 4 days. Protects the deadline at zero cost.</div>
                  <div style={{ display:"flex", alignItems:"center", gap:"0.6rem", marginTop:"0.65rem" }}>
                    <div style={{ fontSize:"0.6rem", color:T.textDim }}>Confidence</div>
                    <div style={{ flex:1, height:3, borderRadius:2, background:T.border }}>
                      <div style={{ height:"100%", width:"86%", background:T.green, borderRadius:2 }}/>
                    </div>
                    <div style={{ fontSize:"0.72rem", fontWeight:700, color:T.green }}>86%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"1rem", padding:"0.75rem 1.5rem", borderTop:"1px solid " + T.border }}>
            {[{ color:"#EF4444", label:"Critical / Zero float" },{ color:T.amber, label:"At risk" },{ color:T.green, label:"On track" },{ color:T.textDim, label:"Has buffer" }].map((l,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.68rem", color:T.textMid }}>
                <div style={{ width:9, height:9, borderRadius:3, border:"1.5px solid " + l.color, background:l.color+"18" }}/>
                {l.label}
              </div>
            ))}
          </div>
        </div>
      </SectionBubble>

      {/* ── TESTIMONIALS ── */}
      <SectionBubble maxWidth="1050px" glowColor="rgba(62,203,111,0.05)">
        <div style={{ textAlign:"center", marginBottom:"2.5rem" }}>
          <div style={{ fontSize:"0.65rem", color:T.green, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"0.75rem" }}>REAL RESULTS</div>
          <h2 style={{ fontFamily:"'Fraunces', serif", fontSize:"clamp(1.8rem, 4vw, 2.6rem)", fontWeight:700, lineHeight:1.1, letterSpacing:"-0.025em" }}>
            Teams that ship on time<br/>
            <em style={{ color:T.green, fontStyle:"italic", fontWeight:300 }}>use Pathflo.</em>
          </h2>
        </div>
        <div className="tgrid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1.25rem" }}>
          {testimonials.map(({ quote, author, role, initials, color }, i) => (
            <div key={i} className="card tcard" style={{
              background:T.surface, border:"1px solid " + T.border,
              borderRadius:16, padding:"1.5rem", position:"relative", overflow:"hidden",
              transition:"transform 0.2s, box-shadow 0.2s, border-color 0.2s",
            }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:color, opacity:0.5 }}/>
              {/* Quote mark */}
              <div style={{
                fontSize:"2.5rem", lineHeight:1, color:color, opacity:0.2,
                fontFamily:"Georgia, serif", marginBottom:"0.5rem", fontWeight:700,
              }}>"</div>
              <p style={{ fontSize:"0.9rem", color:T.text, lineHeight:1.8, fontWeight:300, marginBottom:"1.5rem" }}>
                {quote}
              </p>
              <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                <div style={{
                  width:36, height:36, borderRadius:"50%",
                  background:`${color}18`, border:`1px solid ${color}40`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:"0.72rem", fontWeight:700, color, flexShrink:0,
                }}>{initials}</div>
                <div>
                  <div style={{ fontSize:"0.85rem", fontWeight:600, color:T.text }}>{author}</div>
                  <div style={{ fontSize:"0.75rem", color:T.textMid, marginTop:"0.1rem" }}>{role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionBubble>

      {/* ── INTELLIGENCE PILLARS ── */}
      <SectionBubble maxWidth="1100px" glowColor="rgba(59,130,246,0.05)">
        <div style={{ textAlign:"center", marginBottom:"2.5rem" }}>
          <div style={{ fontSize:"0.65rem", color:T.green, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"0.75rem" }}>EXECUTION INTELLIGENCE</div>
          <h2 style={{ fontFamily:"'Fraunces', serif", fontSize:"clamp(1.8rem, 4vw, 2.6rem)", fontWeight:700, lineHeight:1.1, letterSpacing:"-0.025em", marginBottom:"0.85rem" }}>
            Three dimensions of<br/>
            <em style={{ color:T.green, fontStyle:"italic", fontWeight:300 }}>execution health.</em>
          </h2>
          <p style={{ color:T.textMid, fontSize:"0.95rem", fontWeight:300, lineHeight:1.8, maxWidth:"460px", margin:"0 auto" }}>
            Every project is scored across three intelligence pillars. Numbers in the chart match the stats below — no guessing.
          </p>
        </div>
        <div className="pillars-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1.5rem" }}>
          {pillars.map((pillar, i) => {
            const size=156, cx=size/2, cy=size/2, r=50, np=3;
            const outerPts = Array.from({ length:np }, (_,j) => {
              const a=(j*2*Math.PI/np)-Math.PI/2;
              return { x:cx+r*Math.cos(a), y:cy+r*Math.sin(a) };
            });
            const innerPts = pillar.vals.map((v,j) => {
              const a=(j*2*Math.PI/np)-Math.PI/2;
              return { x:cx+r*v*Math.cos(a), y:cy+r*v*Math.sin(a) };
            });
            const labelPts = outerPts.map((p,j) => ({
              x:cx+(r+20)*Math.cos((j*2*Math.PI/np)-Math.PI/2),
              y:cy+(r+20)*Math.sin((j*2*Math.PI/np)-Math.PI/2),
            }));
            const poly = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
            const valPcts = pillar.vals.map(v => Math.round(v*100)+"%");
            return (
              <div key={i} className="card" style={{
                background:T.surface, border:"1px solid " + T.border,
                borderRadius:16, padding:"1.5rem", position:"relative", overflow:"hidden",
              }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:pillar.color }}/>
                <div style={{ fontSize:"0.65rem", fontWeight:700, letterSpacing:"0.06em", color:pillar.color, marginBottom:"0.4rem", textTransform:"uppercase" }}>{pillar.n}</div>
                <div style={{ fontSize:"0.95rem", fontWeight:700, marginBottom:"1.25rem", color:T.text, lineHeight:1.3 }}>{pillar.title}</div>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:"1.25rem" }}>
                  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow:"visible" }}>
                    <polygon points={poly(outerPts)} fill="none" stroke={pillar.color} strokeWidth="1" opacity="0.2"/>
                    <polygon points={poly(innerPts)} fill={pillar.color} fillOpacity="0.14" stroke={pillar.color} strokeWidth="1.5"/>
                    {outerPts.map((p,j) => <circle key={j} cx={p.x} cy={p.y} r="3.5" fill={pillar.color} opacity="0.25"/>)}
                    {innerPts.map((p,j) => <circle key={j} cx={p.x} cy={p.y} r="2.5" fill={pillar.color}/>)}
                    {labelPts.map((p,j) => (
                      <g key={j}>
                        <text x={p.x.toFixed(1)} y={(p.y-5).toFixed(1)} textAnchor="middle" fontSize="5.5" fontFamily="system-ui" fill={T.textDim} dominantBaseline="middle" letterSpacing="0.06em">{pillar.labels[j]}</text>
                        <text x={p.x.toFixed(1)} y={(p.y+5).toFixed(1)} textAnchor="middle" fontSize="7" fontFamily="system-ui" fill={pillar.color} dominantBaseline="middle" fontWeight="700">{valPcts[j]}</text>
                      </g>
                    ))}
                    <text x={cx} y={cy-5} textAnchor="middle" fontSize="18" fontFamily="Georgia,serif" fill={pillar.color} fontWeight="700">{pillar.pct}</text>
                    <text x={cx} y={cy+9} textAnchor="middle" fontSize="6" fontFamily="system-ui" fill={T.textDim} letterSpacing="0.07em">{pillar.pctLabel}</text>
                  </svg>
                </div>
                {pillar.stats.map((s,j) => (
                  <div key={j} style={{ display:"flex", justifyContent:"space-between", fontSize:"0.8rem", padding:"0.4rem 0", borderBottom:j<pillar.stats.length-1?"1px solid "+T.border:"none" }}>
                    <span style={{ color:T.textMid }}>{s.name}</span>
                    <span style={{ fontWeight:700, color:s.color }}>{s.val}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </SectionBubble>

      {/* ── COMPARISON ── */}
      <SectionBubble maxWidth="780px" glowColor="rgba(62,203,111,0.04)">
        <div style={{ textAlign:"center", marginBottom:"2.5rem" }}>
          <div style={{ fontSize:"0.65rem", color:T.green, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"0.75rem" }}>THE DIFFERENCE</div>
          <h2 style={{ fontFamily:"'Fraunces', serif", fontSize:"clamp(1.8rem, 4vw, 2.6rem)", fontWeight:700, lineHeight:1.1, letterSpacing:"-0.025em" }}>
            PM tools track the work.<br/>
            <em style={{ color:T.green, fontStyle:"italic", fontWeight:300 }}>Pathflo predicts the outcome.</em>
          </h2>
        </div>
        <div style={{ background:T.surface, border:"1px solid " + T.border, borderRadius:16, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr" }}>
            <div style={{ padding:"0.85rem 1.5rem", background:T.surface2, fontSize:"0.7rem", fontWeight:700, color:T.textMid, letterSpacing:"0.1em" }}>OTHER PM TOOLS</div>
            <div style={{ padding:"0.85rem 1.5rem", background:"rgba(62,203,111,0.05)", fontSize:"0.7rem", fontWeight:700, color:T.green, letterSpacing:"0.1em", display:"flex", alignItems:"center", gap:"0.4rem" }}>
              <Logo color={T.green} size={12}/>PATHFLO
            </div>
          </div>
          {comparison.map(({ pm, pathflo }, i) => (
            <div key={i} className="comp-row" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", borderTop:"1px solid " + T.border }}>
              <div className="comp-cell" style={{ padding:"0.9rem 1.5rem", fontSize:"0.875rem", color:T.textMid, display:"flex", gap:"0.6rem", alignItems:"flex-start" }}>
                <span style={{ color:"#EF4444", flexShrink:0, fontSize:"0.68rem", marginTop:"0.1rem" }}>✕</span>{pm}
              </div>
              <div className="comp-cell comp-right" style={{ padding:"0.9rem 1.5rem", fontSize:"0.875rem", color:T.text, display:"flex", gap:"0.6rem", alignItems:"flex-start", transition:"background 0.2s" }}>
                <span style={{ color:T.green, flexShrink:0, fontSize:"0.68rem", marginTop:"0.1rem" }}>✓</span>{pathflo}
              </div>
            </div>
          ))}
        </div>
      </SectionBubble>

      {/* ── PRICING ── */}
      <SectionBubble id="pricing" maxWidth="1000px" glowColor="rgba(62,203,111,0.06)">
        <div style={{ textAlign:"center", marginBottom:"3.5rem" }}>
          <div style={{ fontSize:"0.65rem", color:T.green, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"0.75rem" }}>PRICING</div>
          <h2 style={{ fontFamily:"'Fraunces', serif", fontSize:"clamp(1.8rem, 4vw, 2.6rem)", fontWeight:700, lineHeight:1.1, letterSpacing:"-0.025em", marginBottom:"0.75rem" }}>
            Start free. Upgrade when it pays for itself.
          </h2>
          <p style={{ color:T.textMid, fontSize:"0.95rem", fontWeight:300 }}>No credit card required.</p>
        </div>
        <div className="pgrid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1.25rem" }}>
          {pricing.map(({ name, price, period, tag, desc, items, cta, primary }) => (
            <div key={name} className="card" style={{
              background: primary ? "linear-gradient(145deg,rgba(62,203,111,0.08),rgba(13,17,13,0.95))" : T.surface,
              border: primary ? "1px solid rgba(62,203,111,0.35)" : "1px solid " + T.border,
              borderRadius:20, padding:"1.75rem", position:"relative", overflow:"visible",
              boxShadow: primary ? "0 0 0 1px rgba(62,203,111,0.15), 0 20px 60px rgba(62,203,111,0.1)" : "none",
            }}>
              {tag && (
                <div style={{ position:"absolute", top:-13, left:"50%", transform:"translateX(-50%)", background:T.green, color:"#080A08", fontWeight:700, fontSize:"0.65rem", letterSpacing:"0.08em", padding:"0.2rem 0.85rem", borderRadius:"100px", whiteSpace:"nowrap" }}>{tag}</div>
              )}
              <div style={{ fontSize:"0.65rem", fontWeight:700, color:primary?T.green:T.textMid, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"0.65rem" }}>{name}</div>
              <div style={{ display:"flex", alignItems:"baseline", gap:"0.2rem", marginBottom:"0.5rem" }}>
                <span style={{ fontFamily:"'Fraunces', serif", fontSize:"2.8rem", fontWeight:700, color:T.text, lineHeight:1 }}>{price}</span>
                <span style={{ fontSize:"0.8rem", color:T.textDim }}>{period}</span>
              </div>
              <p style={{ fontSize:"0.83rem", color:T.textMid, lineHeight:1.65, marginBottom:"1.5rem" }}>{desc}</p>
              <div style={{ display:"flex", flexDirection:"column", gap:"0.6rem", marginBottom:"1.75rem" }}>
                {(items||[]).map(item => (
                  <div key={item} style={{ display:"flex", gap:"0.65rem", fontSize:"0.85rem", color:T.text, alignItems:"flex-start" }}>
                    <span style={{ color:T.green, flexShrink:0, fontSize:"0.7rem", marginTop:"0.15rem" }}>✓</span>
                    <span style={{ fontWeight:300 }}>{item}</span>
                  </div>
                ))}
              </div>
              <a href="/app" className={primary?"btnp":"btns"} style={primary ? { ...btnPrimary, width:"100%", justifyContent:"center" } : { ...btnSecondary, width:"100%", justifyContent:"center" }}>
                {cta}
              </a>
            </div>
          ))}
        </div>
        <p style={{ textAlign:"center", marginTop:"1.75rem", fontSize:"0.75rem", color:T.textDim }}>
          No credit card required for free plan. Cancel anytime.
        </p>
      </SectionBubble>

      {/* ── FINAL CTA ── */}
      <SectionBubble maxWidth="620px" glowColor="rgba(62,203,111,0.1)">
        <div style={{
          textAlign:"center", padding:"3.5rem 2rem",
          background:T.surface, border:"1px solid " + T.border2,
          borderRadius:24,
          boxShadow:"0 0 0 1px rgba(62,203,111,0.06), 0 32px 80px rgba(0,0,0,0.4)",
        }}>
          {/* Terminal badge */}
          <div style={{
            display:"inline-flex", alignItems:"center", gap:"0.5rem",
            background:"rgba(62,203,111,0.06)", border:"1px solid rgba(62,203,111,0.15)",
            borderRadius:8, padding:"0.4rem 0.85rem", marginBottom:"1.75rem",
            fontFamily:"'DM Mono', monospace", fontSize:"0.72rem", color:T.green,
          }}>
            <span style={{ animation:"pulse 2s infinite", width:5, height:5, borderRadius:"50%", background:T.green, flexShrink:0 }}/>
            {"$ pathflo init --project new"}
          </div>
          <h2 style={{ fontFamily:"'Fraunces', serif", fontSize:"clamp(2.2rem, 6vw, 3.5rem)", fontWeight:700, lineHeight:1.06, letterSpacing:"-0.03em", marginBottom:"1.25rem" }}>
            Your next project<br/>
            <em style={{ color:T.green, fontStyle:"italic", fontWeight:300 }}>deserves a plan that works.</em>
          </h2>
          <p style={{ color:T.textMid, fontSize:"1rem", lineHeight:1.8, marginBottom:"2.5rem", fontWeight:300 }}>
            Set up in 5 minutes. No PM required. No credit card needed.
          </p>
          <a href="/app" className="btnp" style={{ ...btnPrimary, fontSize:"1.05rem", padding:"1.1rem 2.75rem" }}>
            Start my first project free →
          </a>
          <p style={{ marginTop:"1.25rem", fontSize:"0.75rem", color:T.textDim }}>
            Free forever on Solo plan · No setup required
          </p>
        </div>
      </SectionBubble>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop:"1px solid " + T.border, padding:"2rem 2.5rem", position:"relative", zIndex:1 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"1rem", maxWidth:1200, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
            <Logo color={T.green} size={15}/>
            <span style={{ fontSize:"0.75rem", color:T.textDim, fontWeight:300 }}>© 2026 Pathflo. All rights reserved.</span>
          </div>
          <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background:T.green, animation:"pulse 2s infinite" }}/>
            <span style={{ fontSize:"0.7rem", color:T.textDim, fontFamily:"'DM Mono', monospace" }}>All systems operational</span>
          </div>
          <div style={{ display:"flex", gap:"2rem" }}>
            {["Privacy","Terms","Contact"].map(l => (
              <a key={l} href="#" style={{ fontSize:"0.75rem", color:T.textDim, textDecoration:"none" }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
