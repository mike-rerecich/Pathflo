"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
const Logo = ({ color = "#3ECB6F", size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}>
    <path d="M4 24 C8 24 10 14 15 14 C20 14 22 6 26 6 C29 6 30 12 31 14" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
    <circle cx="4" cy="24" r="3" fill={color}/>
    <circle cx="15" cy="14" r="2.5" fill={color} opacity="0.7"/>
    <circle cx="26" cy="6" r="2.5" fill={color} opacity="0.5"/>
    <circle cx="31" cy="14" r="2.5" fill={color} opacity="0.9"/>
  </svg>
);

// ── DEMO TASKS (Northstar Nutrition — realistic cascade risk scenario) ──────────
// Development is the bottleneck: it's delayed, causing QA and Launch to be at risk.
// The project has buffer but Development's slip is about to eat it.
const DEMO_TASKS = [
  { id:"t0", name:"Strategy & Planning", days:5,  owner:"Marcus",  predecessors:[], concurrent:false },
  { id:"t1", name:"Content & Copy",      days:8,  owner:"Sarah",   predecessors:["t0"], concurrent:false },
  { id:"t2", name:"Product Photography", days:6,  owner:"James",   predecessors:["t0"], concurrent:true },
  { id:"t3", name:"Design",              days:10, owner:"Marcus",  predecessors:["t1","t2"], concurrent:false },
  { id:"t4", name:"Klaviyo Setup",       days:4,  owner:"Sarah",   predecessors:["t3"], concurrent:true },
  { id:"t5", name:"Development",         days:12, owner:"Dev Team",predecessors:["t3"], concurrent:false },
  { id:"t6", name:"SEO Setup",           days:4,  owner:"Sarah",   predecessors:["t0"], concurrent:false },
  { id:"t7", name:"QA & Testing",        days:5,  owner:"Dev Team",predecessors:["t5","t4"], concurrent:false },
  { id:"t8", name:"Launch",              days:1,  owner:"Marcus",  predecessors:["t7","t6"], concurrent:false },
];

// Demo result: project has 2 days buffer but Development is delayed — cascade risk building
// Only QA & Testing and Launch are blocked (they directly depend on Development)
// Strategy, Content, Design, Photography are done or on track — NOT blocked
const DEMO_RESULT = {
  bufferDays: 2,  // Still positive — cascade RISK, not yet overrun
  bottleneck: { name: "Development" },
  tasks: [
    { id:"t0", name:"Strategy & Planning", days:5,  owner:"Marcus",  predecessors:[], concurrent:false, es:0,  ef:5,  slack:0  }, // done, critical
    { id:"t1", name:"Content & Copy",      days:8,  owner:"Sarah",   predecessors:["t0"], concurrent:false, es:5,  ef:13, slack:0  }, // done, critical
    { id:"t2", name:"Product Photography", days:6,  owner:"James",   predecessors:["t0"], concurrent:true,  es:5,  ef:11, slack:4  }, // on track, has float
    { id:"t3", name:"Design",              days:10, owner:"Marcus",  predecessors:["t1","t2"], concurrent:false, es:13, ef:23, slack:0  }, // critical
    { id:"t4", name:"Klaviyo Setup",       days:4,  owner:"Sarah",   predecessors:["t3"], concurrent:true,  es:23, ef:27, slack:6  }, // on track, has float
    { id:"t5", name:"Development",         days:12, owner:"Dev Team",predecessors:["t3"], concurrent:false, es:23, ef:35, slack:0  }, // BOTTLENECK — critical, at risk
    { id:"t6", name:"SEO Setup",           days:4,  owner:"Sarah",   predecessors:["t0"], concurrent:false, es:5,  ef:9,  slack:8  }, // on track, has float
    { id:"t7", name:"QA & Testing",        days:5,  owner:"Dev Team",predecessors:["t5","t4"], concurrent:false, es:35, ef:40, slack:0  }, // blocked by Development
    { id:"t8", name:"Launch",              days:1,  owner:"Marcus",  predecessors:["t7","t6"], concurrent:false, es:40, ef:41, slack:0  }, // at risk
  ],
};

// ── SVG DEPENDENCY GRAPH — landing page ─────────────────────────────────────
function DependencyGraph({ tasks, result, dark = true }) {
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const C = dark ? {
    bg: "transparent", nodeFill: "rgba(22,27,34,0.85)", nodeBorder: "#30363D",
    text: "#E6EDF3", textDim: "#8B949E", textSub: "#484F58",
    crit: "#EF4444", critFill: "rgba(239,68,68,0.1)",
    green: "#22C55E", greenFill: "rgba(34,197,94,0.08)",
    purple: "#7C3AED", blue: "#3B82F6",
    amber: "#F59E0B",
    cascadeFill: "rgba(239,68,68,0.04)", cascadeStroke: "rgba(239,68,68,0.35)",
  } : {
    bg: "transparent", nodeFill: "rgba(255,255,255,0.9)", nodeBorder: "#D1D5DB",
    text: "#111827", textDim: "#6B7280", textSub: "#9CA3AF",
    crit: "#DC2626", critFill: "rgba(220,38,38,0.08)",
    green: "#16A34A", greenFill: "rgba(22,163,74,0.06)",
    purple: "#7C3AED", blue: "#2563EB",
    amber: "#D97706",
    cascadeFill: "rgba(220,38,38,0.04)", cascadeStroke: "rgba(220,38,38,0.3)",
  };

  const layout = useMemo(() => {
    if (!tasks.length || !result) return { positions: {}, W: 600, H: 300 };
    const levels = {};
    function assignLevel(id, lvl) {
      if (levels[id] !== undefined && levels[id] >= lvl) return;
      levels[id] = lvl;
      tasks.filter(t => t.predecessors.includes(id)).forEach(s => assignLevel(s.id, lvl + 1));
    }
    tasks.filter(t => t.predecessors.length === 0).forEach(t => assignLevel(t.id, 0));
    tasks.forEach(t => { if (levels[t.id] === undefined) assignLevel(t.id, 0); });
    const byLevel = {};
    tasks.forEach(t => {
      const l = levels[t.id] || 0;
      if (!byLevel[l]) byLevel[l] = [];
      byLevel[l].push(t);
    });
    const maxLevel = Math.max(...Object.values(levels), 0);
    const maxInCol = Math.max(...Object.values(byLevel).map(g => g.length), 1);
    const NW = 118, NH = 50, GAP_X = 64, GAP_Y = 18;
    const colW = NW + GAP_X;
    const W = Math.max((maxLevel + 1) * colW + GAP_X, 400);
    const H = Math.max(maxInCol * (NH + GAP_Y) - GAP_Y + 80, 200);
    const positions = {};
    Object.entries(byLevel).forEach(([lvl, group]) => {
      const x = GAP_X / 2 + parseInt(lvl) * colW;
      const totalH = group.length * (NH + GAP_Y) - GAP_Y;
      const startY = (H - totalH) / 2;
      group.forEach((t, i) => {
        positions[t.id] = { x, y: Math.max(32, startY + i * (NH + GAP_Y)), w: NW, h: NH, cx: x + NW/2, cy: Math.max(32, startY + i * (NH + GAP_Y)) + NH/2 };
      });
    });
    return { positions, W, H };
  }, [tasks, result]);

  const criticalIds = useMemo(() => new Set(result?.tasks?.filter(t => t.slack === 0).map(t => t.id) || []), [result]);
  const focusId = hoveredId || selectedId;
  const upstream = useMemo(() => {
    if (!focusId) return new Set();
    const set = new Set();
    function walk(id) { const t = tasks.find(t => t.id === id); if (!t) return; t.predecessors.forEach(pid => { if (!set.has(pid)) { set.add(pid); walk(pid); } }); }
    walk(focusId); return set;
  }, [focusId, tasks]);
  const downstream = useMemo(() => {
    if (!focusId) return new Set();
    const set = new Set();
    function walk(id) { tasks.filter(t => t.predecessors.includes(id)).forEach(t => { if (!set.has(t.id)) { set.add(t.id); walk(t.id); } }); }
    walk(focusId); return set;
  }, [focusId, tasks]);
  const connected = new Set([...upstream, ...downstream]);

  const bottleneckName = result?.bottleneck?.name || "";

  function edgePath(from, to) {
    const fx = from.x + from.w, fy = from.cy, tx = to.x, ty = to.cy;
    const cp = (tx - fx) * 0.5;
    return `M ${fx} ${fy} C ${fx + cp} ${fy}, ${tx - cp} ${ty}, ${tx} ${ty}`;
  }

  const cascadeRect = useMemo(() => {
    if (!result || criticalIds.size < 2) return null;
    const pts = [...criticalIds].map(id => layout.positions[id]).filter(Boolean);
    if (pts.length < 2) return null;
    const pad = 12;
    return {
      x: Math.min(...pts.map(p => p.x)) - pad,
      y: Math.min(...pts.map(p => p.y)) - pad,
      w: Math.max(...pts.map(p => p.x + p.w)) + pad - (Math.min(...pts.map(p => p.x)) - pad),
      h: Math.max(...pts.map(p => p.y + p.h)) + pad - (Math.min(...pts.map(p => p.y)) - pad),
    };
  }, [criticalIds, layout.positions, result]);

  const { positions, W, H } = layout;
  if (!tasks.length || !result) return null;

  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", minWidth: W }}>
        <defs>
          <marker id="lp-arr-c" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={C.crit} opacity="0.85"/></marker>
          <marker id="lp-arr-n" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={C.textSub} opacity="0.5"/></marker>
          <marker id="lp-arr-u" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={C.blue} opacity="0.9"/></marker>
          <marker id="lp-arr-d" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={C.crit} opacity="0.7"/></marker>
          <marker id="lp-arr-dim" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill={C.textSub} opacity="0.2"/></marker>
          <filter id="lp-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {cascadeRect && (
          <g>
            <rect x={cascadeRect.x} y={cascadeRect.y} width={cascadeRect.w} height={cascadeRect.h} rx="10" fill={C.cascadeFill} stroke={C.cascadeStroke} strokeWidth="1" strokeDasharray="6 4"/>
            <text x={cascadeRect.x + 9} y={cascadeRect.y + 13} fontSize="7.5" fontFamily="system-ui" fontWeight="700" fill={C.cascadeStroke.replace("0.35","0.7")} letterSpacing="0.08em">CASCADE IMPACT ZONE</text>
          </g>
        )}

        {tasks.map(t => t.predecessors.map(pid => {
          const from = positions[pid], to = positions[t.id];
          if (!from || !to) return null;
          const isCritE = criticalIds.has(pid) && criticalIds.has(t.id);
          const isUp = focusId && upstream.has(pid) && (upstream.has(t.id) || t.id === focusId);
          const isDown = focusId && downstream.has(t.id) && (downstream.has(pid) || pid === focusId);
          const isDim = focusId && !isUp && !isDown && pid !== focusId && t.id !== focusId;
          const stroke = isDim ? `${C.textSub}33` : isUp ? C.blue : isDown ? C.crit : isCritE ? `${C.crit}AA` : `${C.textSub}55`;
          const marker = isDim ? "url(#lp-arr-dim)" : isUp ? "url(#lp-arr-u)" : isDown ? "url(#lp-arr-d)" : isCritE ? "url(#lp-arr-c)" : "url(#lp-arr-n)";
          return <path key={`${pid}-${t.id}`} d={edgePath(from, to)} fill="none" stroke={stroke} strokeWidth={isDim ? 1 : isCritE || isUp || isDown ? 2 : 1.5} markerEnd={marker} strokeDasharray={t.concurrent ? "5 4" : "none"} style={{ transition: "stroke 0.2s" }}/>;
        }))}

        {tasks.map(t => {
          const pos = positions[t.id];
          if (!pos) return null;
          const rt = result.tasks.find(r => r.id === t.id);
          const isCrit = criticalIds.has(t.id);
          const isSelected = t.id === selectedId;
          const isUp = upstream.has(t.id);
          const isDown = downstream.has(t.id);
          const isDim = focusId && t.id !== focusId && !connected.has(t.id);
          const showBlocked = result.bufferDays < 0 && isCrit && t.predecessors.some(pid => { const p = tasks.find(tt => tt.id === pid); return p && p.name === bottleneckName; });
          const floatDays = rt?.slack || 0;
          const fill = isDim ? (dark ? "rgba(15,20,15,0.5)" : "rgba(240,242,240,0.5)") : isSelected ? `${C.purple}22` : isUp ? `${C.blue}18` : isDown ? `${C.crit}12` : isCrit ? C.critFill : t.concurrent ? C.greenFill : C.nodeFill;
          const stroke = isDim ? (dark ? "#1E251E" : "#E5E7EB") : isSelected ? C.purple : isUp ? C.blue : isDown ? C.crit : isCrit ? C.crit : C.nodeBorder;
          const strokeW = isDim ? 1 : (isSelected || isUp || isDown || isCrit) ? 2 : 1.5;
          const textFill = isDim ? C.textSub : isSelected ? C.purple : isUp ? C.blue : isDown ? C.crit : isCrit ? C.crit : C.text;
          const subFill = isDim ? C.textSub : showBlocked ? C.crit : isUp ? `${C.blue}CC` : isDown ? `${C.crit}CC` : C.textDim;
          const dotFill = isDim ? (dark ? "#252D25" : "#D1D5DB") : isCrit ? C.crit : C.green;
          const subLabel = showBlocked ? `Blocked by ${bottleneckName}`.slice(0,20) : `${t.days}d · ${(t.owner === "UNASSIGNED" ? "Unassigned" : t.owner) || "?"}`.slice(0,18);
          return (
            <g key={t.id} style={{ cursor: "pointer", opacity: isDim ? 0.3 : 1, transition: "opacity 0.2s" }}
              onClick={() => { const next = t.id === selectedId ? null : t.id; setSelectedId(next); }}
              onMouseEnter={() => setHoveredId(t.id)} onMouseLeave={() => setHoveredId(null)}
              filter={isSelected ? "url(#lp-glow)" : undefined}
            >
              {isSelected && <rect x={pos.x-4} y={pos.y-4} width={pos.w+8} height={pos.h+8} rx="13" fill="none" stroke={`${C.purple}33`} strokeWidth="2"/>}
              <rect x={pos.x} y={pos.y} width={pos.w} height={pos.h} rx="8" fill={fill} stroke={stroke} strokeWidth={strokeW} style={{ transition: "fill 0.2s, stroke 0.2s" }}/>
              {isCrit && !isDim && <rect x={pos.x+1} y={pos.y+1} width={pos.w-2} height="2" rx="1" fill={C.crit} opacity="0.55"/>}
              <text x={pos.x+9} y={pos.y+18} fontSize="10" fontFamily="system-ui" fontWeight={isCrit ? "700" : "500"} fill={isDim ? C.textSub : textFill} style={{ transition: "fill 0.2s" }}>
                {t.name.length > 14 ? t.name.slice(0,13)+"…" : t.name}
              </text>
              <text x={pos.x+9} y={pos.y+32} fontSize="8.5" fontFamily="system-ui" fontWeight="400" fill={isDim ? C.textSub : subFill} style={{ transition: "fill 0.2s" }}>
                {subLabel}
              </text>
              <circle cx={pos.x+pos.w-11} cy={pos.y+12} r="3.5" fill={dotFill} style={{ transition: "fill 0.2s" }}/>
              {floatDays > 0 && !isDim && (
                <g>
                  <rect x={pos.x+pos.w-28} y={pos.y+pos.h-13} width={24} height={10} rx="3" fill={dark ? "rgba(34,197,94,0.18)" : "rgba(22,163,74,0.12)"}/>
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



export default function Home() {
  const [dark, setDark] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const T = dark ? {
    bg: "#080A08", surface: "#0D1117", surface2: "#161B22",
    border: "#21262D", border2: "#30363D", text: "#E6EDF3", textMid: "#8B949E",
    textDim: "#484F58", green: "#22C55E", greenDim: "#0D2818", greenMid: "#1A4A28",
    shadow: "0 4px 32px rgba(0,0,0,0.6)", navBg: "rgba(8,10,8,0.9)",
    gradHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(62,203,111,0.12) 0%, transparent 70%)",
    green: "#3ECB6F",
  } : {
    bg: "#F7F8F5", surface: "#FFFFFF", surface2: "#F2F3EF",
    border: "#E2E4DC", border2: "#D4D6CC", text: "#0F140F", textMid: "#4A5A4A",
    textDim: "#8A9A8A", green: "#16A34A", greenDim: "#E8F5EE", greenMid: "#C8E8D4",
    shadow: "0 4px 24px rgba(0,0,0,0.08)", navBg: "rgba(247,248,245,0.9)",
    gradHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(30,138,69,0.07) 0%, transparent 70%)",
    green: "#3ECB6F",
  };

  const btnPrimary = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
    background: T.green, color: "#FFFFFF",
    border: "none", borderRadius: "100px", fontFamily: "inherit", fontWeight: 700,
    fontSize: "0.95rem", padding: "0.9rem 2rem", cursor: "pointer", textDecoration: "none",
    boxShadow: dark ? "0 0 0 1px rgba(62,203,111,0.3), 0 8px 32px rgba(62,203,111,0.2)" : "0 4px 20px rgba(30,138,69,0.3)",
    transition: "transform 0.15s",
  };
  const btnSecondary = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: "transparent", color: T.textMid, border: "1.5px solid " + T.border2,
    borderRadius: "100px", fontFamily: "inherit", fontWeight: 500, fontSize: "0.95rem",
    padding: "0.9rem 2rem", cursor: "pointer", textDecoration: "none", transition: "all 0.15s",
  };

  const questions = [
    { q: "Will this project actually succeed?", a: "Pathflo scores execution confidence before work begins — not after something breaks." },
    { q: "When will it actually finish?", a: "Not a guess. A projected completion date backed by critical path analysis and dependency mapping." },
    { q: "What is going to break it?", a: "Bottleneck detection flags the three milestones most likely to blow your deadline, and explains why." },
    { q: "How do we fix it before it costs us?", a: "Concrete moves for each constraint: what to compress, what to parallelize, what to escalate." },
  ];

  const comparison = [
    { pm: "Store your tasks", pathflo: "Predict your outcomes before work begins" },
    { pm: "Tell you you're behind", pathflo: "Tell you why — before it happens" },
    { pm: "Show you a Gantt chart", pathflo: "Show you the critical path, cascade risks, and what to fix" },
    { pm: "Track what exists", pathflo: "Forecast what's coming — confidence score, failure probability, buffer" },
    { pm: "No workload visibility", pathflo: "Flags who's overloaded and who's a single point of failure" },
    { pm: "Require a PM to read the output", pathflo: "One-tap shareable report — forward it from your phone" },
    { pm: "React to problems", pathflo: "Prevent them" },
  ];

  const pricing = [
    {
      name: "Solo", price: "$49", period: "/mo", tag: null,
      desc: "For contractors and independent operators running client projects.",
      items: ["1 active project", "Critical path + dependency graph", "Cascade simulator", "Workload intelligence", "Shareable readout", "Risk & bottleneck detection", "CSV export"],
      cta: "Start free", primary: false,
    },
    {
      name: "Team", price: "$99", period: "/mo", tag: "Most popular",
      desc: "For agencies and small teams managing multiple projects at once.",
      items: ["Unlimited projects", "Everything in Solo", "Multi-owner dependency mapping", "Cascade impact simulator", "Priority support"],
      cta: "Start free", primary: true,
    },
    {
      name: "Business", price: "$299", period: "/mo", tag: null,
      desc: "For growing operations that need stakeholder-ready reporting.",
      items: ["Everything in Team", "Shareable leadership reports", "Industry templates", "Custom risk weights", "Dedicated onboarding"],
      cta: "Contact us", primary: false,
    },
  ];

  return (
    <main style={{ background: T.bg, color: T.text, fontFamily: "'DM Sans', system-ui, sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&family=Fraunces:ital,wght@0,300;0,700;1,300;1,700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #30363D; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .h1{animation:fadeUp 0.7s 0.1s ease both} .h2{animation:fadeUp 0.7s 0.25s ease both}
        .h3{animation:fadeUp 0.7s 0.4s ease both} .h4{animation:fadeUp 0.7s 0.55s ease both}
        .btnp:hover{transform:translateY(-2px)} .btns:hover{border-color:#3ECB6F !important;color:#3ECB6F !important}
        .navlink:hover{color:#E6EDF3 !important} .card{transition:transform 0.2s} .card:hover{transform:translateY(-2px)}
        .qcard:hover{border-color:#3ECB6F33 !important}
        .comp-row:hover .comp-right{background:rgba(62,203,111,0.06) !important}
        @media(max-width:768px){
          .pgrid{grid-template-columns:1fr !important}
          .qgrid{grid-template-columns:1fr !important}
          .pillars-grid{grid-template-columns:1fr !important}
          .graph-body{grid-template-columns:1fr !important}
          .graph-right-panel{border-left:none !important;border-top:1px solid #30363D !important}
          .hbtns{flex-direction:column !important;align-items:center !important}
          .navlinks{display:none !important}
          .comp-header{font-size:0.62rem !important}
          .comp-cell{padding:0.75rem 0.85rem !important;font-size:0.78rem !important}
          .hero-stats{gap:1.5rem !important;flex-wrap:wrap !important;justify-content:center !important}
        }
      `}</style>

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100vh", background: T.gradHero, pointerEvents: "none", zIndex: 0 }} />

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, height: "68px",
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2rem",
        background: scrolled ? T.navBg : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid " + T.border : "none",
        transition: "all 0.3s",
      }}>
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Logo color={T.green} size={24} />
          <span style={{ fontWeight: 700, fontSize: "1.1rem", color: T.text, letterSpacing: "-0.02em" }}>
            Path<span style={{ color: T.green }}>flo</span>
          </span>
        </a>
        <div className="navlinks" style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <a className="navlink" href="#why" style={{ color: T.textMid, fontSize: "0.88rem", textDecoration: "none", transition: "color 0.15s" }}>Why it works</a>
          <a className="navlink" href="#pricing" style={{ color: T.textMid, fontSize: "0.88rem", textDecoration: "none", transition: "color 0.15s" }}>Pricing</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button onClick={() => setDark(!dark)} title="Toggle theme" style={{
            width: 44, height: 28, borderRadius: 14, border: "1.5px solid " + T.border2,
            background: T.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: dark ? "#080A08" : "#F7F8F5", border: "2px solid " + T.border2 }} />
          </button>
          <a href="/app" className="btnp" style={{ ...btnPrimary, padding: "0.6rem 1.4rem", fontSize: "0.88rem" }}>Launch app</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: "relative", zIndex: 1, padding: "160px 2rem 100px", textAlign: "center" }}>
        <div className="h1" style={{ marginBottom: "1.75rem" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            background: T.surface, border: "1px solid " + T.border2,
            borderRadius: "100px", padding: "0.35rem 1rem",
            fontSize: "0.7rem", fontWeight: 600, color: T.textMid, letterSpacing: "0.08em",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, animation: "pulse 2s infinite" }} />
            NOW LIVE — PLAN YOUR FIRST PROJECT FREE
          </span>
        </div>
        <h1 className="h2" style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(3rem, 8vw, 5.5rem)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", maxWidth: "800px", margin: "0 auto 1.5rem" }}>
          Operational clarity.<br />
          <em style={{ color: T.green, fontStyle: "italic", fontWeight: 300 }}>Execution predictability.</em>
        </h1>
        <p className="h3" style={{ fontSize: "clamp(1rem, 2.5vw, 1.2rem)", color: T.textMid, lineHeight: 1.75, maxWidth: "560px", margin: "0 auto 2.5rem", fontWeight: 300 }}>
          The PMO you cannot afford to hire. <Logo color={T.green} size={14} />{" "}
          <span style={{ fontWeight: 500, color: T.text }}>Pathflo</span> gives you the execution intelligence to plan, predict, and deliver — without a formal project manager.
        </p>
        <div className="h4 hbtns" style={{ display: "flex", gap: "1rem", justifyContent: "center", marginBottom: "3rem" }}>
          <a href="/app" className="btnp" style={{ ...btnPrimary, fontSize: "1rem", padding: "1rem 2.25rem" }}>Build my first plan →</a>
          <a href="#why" className="btns" style={btnSecondary}>See why it works</a>
        </div>
        <div className="h4 hero-stats" style={{ display: "flex", justifyContent: "center", gap: "3.5rem" }}>
          {[{ val: "5 min", label: "To your first risk report" }, { val: "5 screens", label: "Of execution intelligence" }, { val: "1 tap", label: "To share with a client" }].map(({ val, label }) => (
            <div key={val} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.75rem", fontWeight: 700, color: T.text }}>{val}</div>
              <div style={{ fontSize: "0.72rem", color: T.textDim, fontWeight: 500, letterSpacing: "0.06em", marginTop: "0.2rem" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FOUR QUESTIONS */}
      <section id="why" style={{ padding: "80px 2rem", maxWidth: "900px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "0.7rem", color: T.green, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem" }}>WHY IT WORKS</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Four questions you already have.<br /><em style={{ color: T.green, fontStyle: "italic" }}>Pathflo answers all of them.</em>
          </h2>
        </div>
        <div className="qgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
          {questions.map(({ q, a }, i) => (
            <div key={i} className="qcard" style={{ background: T.surface, border: "1px solid " + T.border2, borderRadius: "16px", padding: "1.75rem", transition: "border-color 0.2s" }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1rem", fontWeight: 400, marginBottom: "0.75rem", lineHeight: 1.4 }}>{q}</div>
              <p style={{ fontSize: "0.87rem", color: T.textMid, lineHeight: 1.75, fontWeight: 300 }}>{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DEPENDENCY INTELLIGENCE GRAPH — real canvas, same as results page */}
      <section style={{ padding: "80px 2rem", maxWidth: "1140px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "0.7rem", color: T.green, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem" }}>DEPENDENCY INTELLIGENCE</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
            See the failure chain<br /><em style={{ color: T.green, fontStyle: "italic" }}>before it happens.</em>
          </h2>
          <p style={{ color: T.textMid, fontSize: "1rem", fontWeight: 300, lineHeight: 1.75, maxWidth: "520px", margin: "0 auto" }}>
            Pathflo maps every task dependency, flags cascade impact, and tells you exactly which tasks will blow your deadline — before a single day is lost.
          </p>
        </div>

        {/* Graph card — same visual language as results page */}
        <div style={{ background: T.surface, border: "1px solid " + T.border2, borderRadius: "16px", overflow: "visible", boxShadow: T.shadow }}>

          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", borderBottom: "1px solid " + T.border, flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.85rem", fontWeight: 600, color: T.text }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, display: "inline-block", animation: "pulse 2s infinite" }} />
              Website Launch — Northstar Nutrition
            </div>
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              {[{ label: "Tasks", val: "9" }, { label: "Dependencies", val: "11" }, { label: "Critical Path", val: "5 tasks" }].map(s => (
                <div key={s.label} style={{ fontSize: "0.72rem", color: T.textMid }}>
                  {s.label} <span style={{ color: T.text, fontWeight: 700 }}>{s.val}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: "0.7rem", borderRadius: 6, padding: "0.25rem 0.75rem", fontWeight: 700, letterSpacing: "0.06em", background: dark ? "#200a0a" : "#FEE2E2", color: "#EF4444", border: "1px solid rgba(239,68,68,0.35)" }}>
              ⚠ CASCADE RISK DETECTED
            </div>
          </div>

          {/* Graph body — left: canvas graph | right: detail panel */}
          <div className="graph-body" style={{ display: "grid", gridTemplateColumns: "1fr 288px", overflow: "visible" }}>

            {/* SVG dependency graph — responsive, no canvas */}
            <DependencyGraph tasks={DEMO_TASKS} result={DEMO_RESULT} dark={dark} />

            {/* Right panel */}
            <div className="graph-right-panel" style={{ borderLeft: "1px solid " + T.border, padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>

              <div>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#EF4444", marginBottom: "0.5rem" }}>BIGGEST RISK</div>
                <div style={{ background: dark ? "#160404" : "#FEE2E2", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "10px", padding: "0.85rem" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#EF4444", marginBottom: "0.3rem" }}>⚠ Development is the critical bottleneck</div>
                  <div style={{ fontSize: "0.78rem", lineHeight: 1.6, color: T.textMid }}>QA & Testing can't start until it's done. Only 2 days of buffer remain — any slip cascades into Launch.</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: T.textMid, marginBottom: "0.5rem" }}>CASCADE IMPACT</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {[
                    { label: "Delay Risk", val: "+5–7d", color: "#EF4444" },
                    { label: "Tasks Blocked", val: "3 tasks", color: "#EF4444" },
                    { label: "Owners at Risk", val: "3 people", color: "#F59E0B" },
                    { label: "Cost Exposure", val: "$4,200", color: "#F59E0B" },
                  ].map((s, i) => (
                    <div key={i} style={{ background: T.surface2, border: "1px solid " + T.border, borderRadius: "8px", padding: "0.55rem 0.7rem" }}>
                      <div style={{ fontSize: "0.58rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textDim, marginBottom: "0.2rem" }}>{s.label}</div>
                      <div style={{ fontSize: "0.92rem", fontWeight: 700, color: s.color }}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: dark ? "#22C55E" : "#16A34A", marginBottom: "0.5rem" }}>PATHFLO RECOMMENDATION</div>
                <div style={{ background: dark ? "#0D2818" : "#E8F5EE", border: "1px solid " + (dark ? "#1A4A28" : "#C8E8D4"), borderRadius: "10px", padding: "0.85rem" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: dark ? "#22C55E" : "#16A34A", marginBottom: "0.4rem" }}>+ Run Product Photography in parallel with Design</div>
                  <div style={{ fontSize: "0.78rem", lineHeight: 1.6, color: T.textMid }}>They share the same predecessor (Strategy). Running them at the same time recovers 4 days and protects the deadline.</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.7rem" }}>
                    <div style={{ fontSize: "0.6rem", fontWeight: 600, color: T.textDim, whiteSpace: "nowrap" }}>Confidence</div>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: T.border2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: "86%", background: dark ? "#22C55E" : "#16A34A", borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: dark ? "#22C55E" : "#16A34A" }}>86%</div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Legend row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", padding: "0.85rem 1.5rem", borderTop: "1px solid " + T.border }}>
            {[
              { color: "#EF4444", label: "Critical / Zero float" },
              { color: "#F59E0B", label: "At risk" },
              { color: "#22C55E", label: "On track" },
              { color: T.textDim, label: "Completed" },
              { color: T.green, label: "Cascade zone →" },
            ].map((l, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.7rem", color: T.textMid }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, border: "1.5px solid " + l.color, background: l.color + "18" }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXECUTION INTELLIGENCE PILLARS */}
      <section style={{ padding: "80px 2rem", maxWidth: "1100px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "0.7rem", color: T.green, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem" }}>EXECUTION INTELLIGENCE</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
            Five outputs of<br /><em style={{ color: T.green, fontStyle: "italic" }}>execution intelligence.</em>
          </h2>
          <p style={{ color: T.textMid, fontSize: "1rem", fontWeight: 300, lineHeight: 1.75, maxWidth: "500px", margin: "0 auto" }}>
            Every project you enter is scored across five intelligence dimensions. Each one answers a different question — in plain English, not PM jargon.t what's at risk.
          </p>
        </div>
        <div className="pillars-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1.75rem" }}>
          {[
            {
              n: "01 · Timeline Health", title: "How your schedule holds under pressure",
              color: "#3B82F6", vals: [0.74, 0.81, 0.65], labels: ["DEPENDENCY", "ACCURACY", "STABILITY"],
              pct: "74%", pctLabel: "TIMELINE",
              stats: [{ name: "Dependency Compression", val: "Moderate", color: "#F59E0B" }, { name: "Critical Path Stability", val: "Good", color: "#22C55E" }, { name: "Forecast Accuracy", val: "81%", color: "#3B82F6" }],
            },
            {
              n: "02 · Workload Intel", title: "Who's overloaded and who's a single point of failure",
              color: T.green, vals: [0.62, 0.55, 0.80], labels: ["OVERLOAD", "CAPACITY", "APPROVAL"],
              pct: "62%", pctLabel: "CAPACITY",
              stats: [{ name: "Team Overload", val: "High", color: "#EF4444" }, { name: "Single Owner Risk", val: "Elevated", color: "#F59E0B" }, { name: "Approval Capacity", val: "Limited", color: "#F59E0B" }],
            },
            {
              n: "03 · Operational Health", title: "Execution confidence and rework risk",
              color: "#22C55E", vals: [0.78, 0.85, 0.70], labels: ["STABILITY", "EXECUTION", "REWORK"],
              pct: "78%", pctLabel: "EXECUTION",
              stats: [{ name: "Budget Stability", val: "Strong", color: "#22C55E" }, { name: "Rework Risk", val: "Moderate", color: "#F59E0B" }, { name: "Execution Confidence", val: "74%", color: "#22C55E" }],
            },
          ].map((pillar, i) => {
            const size = 160, cx = size / 2, cy = size / 2, r = 52, np = 3;
            const outerPts = Array.from({ length: np }, (_, j) => {
              const a = (j * 2 * Math.PI / np) - Math.PI / 2;
              return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
            });
            const innerPts = pillar.vals.map((v, j) => {
              const a = (j * 2 * Math.PI / np) - Math.PI / 2;
              return { x: cx + r * v * Math.cos(a), y: cy + r * v * Math.sin(a) };
            });
            const labelPts = outerPts.map((p, j) => ({
              x: cx + (r + 18) * Math.cos((j * 2 * Math.PI / np) - Math.PI / 2),
              y: cy + (r + 18) * Math.sin((j * 2 * Math.PI / np) - Math.PI / 2),
            }));
            const poly = (pts) => pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
            return (
              <div key={i} className="card" style={{ background: T.surface, border: "1px solid " + T.border2, borderRadius: "16px", padding: "1.75rem", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: pillar.color }} />
                <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.04em", color: pillar.color, marginBottom: "0.5rem", textTransform: "uppercase" }}>{pillar.n}</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.4rem", color: T.text, lineHeight: 1.3 }}>{pillar.title}</div>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.4rem" }}>
                  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
                    <polygon points={poly(outerPts)} fill="none" stroke={pillar.color} strokeWidth="1" opacity="0.25"/>
                    <polygon points={poly(innerPts)} fill={pillar.color} fillOpacity="0.16" stroke={pillar.color} strokeWidth="1.5"/>
                    {outerPts.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r="4" fill={pillar.color} opacity="0.3"/>)}
                    {innerPts.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r="3" fill={pillar.color}/>)}
                    {labelPts.map((p, j) => (
                      <text key={j} x={p.x.toFixed(1)} y={p.y.toFixed(1)} textAnchor="middle" fontSize="6" fontFamily="system-ui" fill={T.textDim} dominantBaseline="middle">{pillar.labels[j]}</text>
                    ))}
                    <text x={cx} y={cy - 4} textAnchor="middle" fontSize="20" fontFamily="Georgia, serif" fill={pillar.color} fontWeight="700">{pillar.pct}</text>
                    <text x={cx} y={cy + 11} textAnchor="middle" fontSize="7" fontFamily="system-ui" fill={T.textDim} letterSpacing="0.05em">{pillar.pctLabel}</text>
                  </svg>
                </div>
                {pillar.stats.map((s, j) => (
                  <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", padding: "0.4rem 0", borderBottom: j < pillar.stats.length - 1 ? "1px solid " + T.border : "none" }}>
                    <span style={{ color: T.textMid }}>{s.name}</span>
                    <span style={{ fontWeight: 700, color: s.color }}>{s.val}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {/* PM TOOLS VS PATHFLO */}
      <section style={{ padding: "80px 2rem", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "780px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div style={{ fontSize: "0.7rem", color: T.green, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem" }}>THE DIFFERENCE</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              Most PM tools are systems of record.<br />
              <em style={{ color: T.green, fontStyle: "italic" }}>Pathflo is a system of intelligence.</em>
            </h2>
          </div>
          <div style={{ background: T.surface, border: "1px solid " + T.border2, borderRadius: "16px", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              <div className="comp-header" style={{ padding: "1rem 1.5rem", background: T.surface2, fontSize: "0.75rem", fontWeight: 700, color: T.textMid, letterSpacing: "0.1em" }}>OTHER PM TOOLS</div>
              <div className="comp-header" style={{ padding: "1rem 1.5rem", background: dark ? "#1A1035" : "#0F2B1A", fontSize: "0.75rem", fontWeight: 700, color: T.green, letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Logo color={T.green} size={14} />Pathflo
              </div>
            </div>
            {comparison.map(({ pm, pathflo }, i) => (
              <div key={i} className="comp-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid " + T.border }}>
                <div className="comp-cell" style={{ padding: "1rem 1.5rem", fontSize: "0.88rem", color: T.textMid, display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                  <span style={{ color: "#EF4444", flexShrink: 0, fontSize: "0.72rem" }}>✕</span>{pm}
                </div>
                <div className="comp-cell comp-right" style={{ padding: "1rem 1.5rem", fontSize: "0.88rem", color: T.text, display: "flex", gap: "0.6rem", alignItems: "flex-start", transition: "background 0.2s" }}>
                  <span style={{ color: T.green, flexShrink: 0, fontSize: "0.72rem" }}>✓</span>{pathflo}
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.88rem", color: T.textDim, lineHeight: 1.7 }}>
            Companies do not buy PM tools for task management. They buy predictability, speed to delivery, and confidence that the plan will actually work.
          </p>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "80px 2rem 100px", maxWidth: "1000px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <div style={{ fontSize: "0.7rem", color: T.green, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem" }}>PRICING</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>
            Start free. Upgrade when it pays for itself.
          </h2>
          <p style={{ color: T.textMid, fontSize: "1rem", fontWeight: 300 }}>No credit card required to start.</p>
        </div>
        <div className="pgrid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
          {pricing.map(({ name, price, period, tag, desc, items, cta, primary }) => (
            <div key={name} className="card" style={{
              background: primary ? (dark ? "linear-gradient(135deg,#1A1035,#161B22)" : "linear-gradient(135deg,#EDE9FE,#FFFFFF)") : T.surface,
              border: primary ? "1px solid " + T.green : "1px solid " + T.border2,
              borderRadius: "20px", padding: "2rem", position: "relative", overflow: "visible",
              boxShadow: primary ? (dark ? "0 0 0 1px #3ECB6F33, 0 20px 60px rgba(62,203,111,0.12)" : "0 0 0 1px #3ECB6F22, 0 20px 60px rgba(30,138,69,0.1)") : T.shadow,
            }}>
              {tag && (
                <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: T.green, color: "#fff", fontWeight: 700, fontSize: "0.68rem", letterSpacing: "0.08em", padding: "0.25rem 0.85rem", borderRadius: "100px", whiteSpace: "nowrap" }}>{tag}</div>
              )}
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: primary ? T.greenLight : T.textMid, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.75rem" }}>{name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.2rem", marginBottom: "0.5rem" }}>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: "3rem", fontWeight: 700, color: T.text, lineHeight: 1 }}>{price}</span>
                <span style={{ fontSize: "0.8rem", color: T.textDim }}>{period}</span>
              </div>
              <p style={{ fontSize: "0.85rem", color: T.textMid, lineHeight: 1.65, marginBottom: "1.5rem" }}>{desc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1.75rem" }}>
                {(items || []).map(item => (
                  <div key={item} style={{ display: "flex", gap: "0.75rem", fontSize: "0.87rem", color: T.text, alignItems: "flex-start" }}>
                    <span style={{ color: T.green, flexShrink: 0 }}>✓</span>
                    <span style={{ fontWeight: 300 }}>{item}</span>
                  </div>
                ))}
              </div>
              <a href="/app" className={primary ? "btnp" : "btns"} style={primary ? { ...btnPrimary, width: "100%", justifyContent: "center" } : { ...btnSecondary, width: "100%", justifyContent: "center" }}>
                {cta}
              </a>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.75rem", color: T.textDim }}>
          No credit card required for free plan. Cancel anytime.
        </p>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding: "80px 2rem 120px", textAlign: "center", borderTop: "1px solid " + T.border, position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "580px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(2.2rem, 6vw, 3.8rem)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: "1.5rem" }}>
            Stop guessing.<br />
            <em style={{ color: T.green, fontStyle: "italic" }}>Start knowing.</em>
          </h2>
          <p style={{ color: T.textMid, fontSize: "1rem", lineHeight: 1.75, marginBottom: "2.5rem", fontWeight: 300 }}>
            <Logo color={T.green} size={14} /><span style={{ fontWeight: 500, color: T.text }}> Pathflo</span> gives every project a critical path, a risk score, and a leadership readout — in minutes, not hours.
          </p>
          <a href="/app" className="btnp" style={{ ...btnPrimary, fontSize: "1.05rem", padding: "1.1rem 2.5rem" }}>Build my first plan — it's free →</a>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid " + T.border, padding: "2rem 2.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Logo color={T.green} size={16} />
          <span style={{ fontSize: "0.75rem", color: T.textDim, fontWeight: 300 }}>© 2026 Pathflo. All rights reserved.</span>
        </div>
        <div style={{ display: "flex", gap: "1.75rem" }}>
          {["Privacy", "Terms", "Contact"].map(l => (
            <a key={l} href="#" style={{ fontSize: "0.75rem", color: T.textDim, textDecoration: "none" }}>{l}</a>
          ))}
        </div>
      </footer>
    </main>
  );
}
