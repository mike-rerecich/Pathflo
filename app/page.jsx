"use client";
import { useState, useEffect, useRef, useMemo } from "react";

const G = "#3ECB6F";
const PALETTE = ["#3ECB6F","#3B82F6","#8B5CF6","#14B8A6","#F59E0B","#EC4899"];

function hex2rgb(hex) {
  return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
}

/* ─── Logo ───────────────────────────────────────────────────────── */
const Logo = ({ color=G, size=18 }) => (
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
      opacity: visible?1:0, transform: visible?"translateY(0)":"translateY(32px)",
      transition:"opacity 0.7s ease, transform 0.7s ease",
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
    <div style={{position:"fixed",top:0,left:0,right:0,height:"2px",zIndex:9999,background:"rgba(255,255,255,0.04)",pointerEvents:"none"}}>
      <div ref={barRef} style={{height:"100%",width:"0%",background:`linear-gradient(90deg,${G},#22C55E)`,boxShadow:`0 0 8px ${G}99`,transition:"none"}}/>
    </div>
  );
}

/* ─── Preloader — text flash only ───────────────────────────────── */
function Preloader() {
  const [phase, setPhase] = useState("in");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("out"), 1200);
    const t2 = setTimeout(() => setPhase("done"), 1900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (phase === "done") return null;
  const fading = phase === "out";
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9998, background:"#080A08",
      display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"0.5rem",
      opacity: fading ? 0 : 1, transition:"opacity 0.7s ease",
      pointerEvents: fading ? "none" : "auto",
    }}>
      <div style={{fontFamily:"'Fraunces',serif", fontSize:"2.8rem", fontWeight:700, letterSpacing:"-0.03em", color:"#EEF2EE",
        opacity: fading ? 0 : 1, transform: fading ? "translateY(-6px)" : "translateY(0)",
        transition:"opacity 0.5s ease, transform 0.5s ease",
      }}>
        Path<span style={{color:G}}>flo</span>
      </div>
      <div style={{fontFamily:"'DM Mono',monospace", fontSize:"0.65rem", letterSpacing:"0.2em", color:G+"80",
        opacity: fading ? 0 : 1, transition:"opacity 0.4s ease 0.1s",
      }}>
        EXECUTION INTELLIGENCE
      </div>
    </div>
  );
}

/* ─── BackgroundField — multicolor canvas ────────────────────────── */
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
      x: ((idx%3)+0.5+Math.random()*0.5) * ((W||1400)/3),
      y: ((Math.floor(idx/3))+0.5+Math.random()*0.4) * ((H||900)/2),
      burst: Math.random()*280,
      color: col,
      rgb: hex2rgb(col),
      orbs: Array.from({length:4+Math.floor(Math.random()*4)}, (_,j) => ({
        angle: Math.random()*Math.PI*2,
        r: 18 + j*15,
        size: 0.7 + Math.random()*1.3,
        speed: 0.0006 + Math.random()*0.0018,
        alpha: 0.2 + Math.random()*0.5,
        rgb: hex2rgb(PALETTE[Math.floor(Math.random()*PALETTE.length)]),
      })),
    }));

    const mesh = Array.from({length:28}, () => ({
      x: Math.random()*(W||1400), y: Math.random()*(H||900),
      vx:(Math.random()-0.5)*0.2, vy:(Math.random()-0.5)*0.2,
      rgb: hex2rgb(PALETTE[Math.floor(Math.random()*PALETTE.length)]),
    }));

    const draw = () => {
      ctx.clearRect(0,0,W,H);
      for (let i=0;i<mesh.length;i++) {
        const p=mesh[i];
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<0||p.x>W) p.vx*=-1;
        if(p.y<0||p.y>H) p.vy*=-1;
        for(let j=i+1;j<mesh.length;j++) {
          const q=mesh[j];
          const d=Math.hypot(p.x-q.x,p.y-q.y);
          if(d<200) {
            ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y);
            ctx.strokeStyle=`rgba(${p.rgb[0]},${p.rgb[1]},${p.rgb[2]},${(1-d/200)*0.07})`;
            ctx.lineWidth=0.5; ctx.stroke();
          }
        }
      }
      systems.forEach(s => {
        s.burst++;
        const bst=s.burst%260<22;
        const [r,g,b]=s.rgb;
        const grd=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,80);
        grd.addColorStop(0,`rgba(${r},${g},${b},${bst?0.09:0.04})`);
        grd.addColorStop(1,"transparent");
        ctx.beginPath(); ctx.arc(s.x,s.y,80,0,Math.PI*2);
        ctx.fillStyle=grd; ctx.fill();
        s.orbs.forEach(o => {
          o.angle+=o.speed;
          const px=s.x+Math.cos(o.angle)*o.r;
          const py=s.y+Math.sin(o.angle)*o.r;
          const [or,og,ob]=o.rgb;
          ctx.beginPath(); ctx.arc(px,py,o.size*(bst?1.9:1),0,Math.PI*2);
          ctx.fillStyle=`rgba(${or},${og},${ob},${o.alpha*(bst?1.7:1)})`;
          ctx.fill();
        });
        const outerR=s.orbs[s.orbs.length-1]?.r||40;
        ctx.beginPath(); ctx.arc(s.x,s.y,outerR,0,Math.PI*2);
        ctx.strokeStyle=`rgba(${r},${g},${b},0.03)`; ctx.lineWidth=1; ctx.stroke();
      });
      animId=requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);
  return <canvas ref={canvasRef} style={{position:"fixed",inset:0,width:"100%",height:"100%",zIndex:0,pointerEvents:"none",opacity:0.72}}/>;
}

/* ─── AgentFlow — comet travels between nodes ────────────────────── */
const AGENT_NODES = [
  {n:"01",name:"Risk Scanner",    short:"Top failure points",         tier:"Free", color:"#3ECB6F", col:0,row:0},
  {n:"02",name:"Fix Generator",   short:"Specific fixes",             tier:"Free", color:"#22D3EE", col:1,row:0},
  {n:"03",name:"Cascade Modeler", short:"Domino simulation",          tier:"Free", color:"#3B82F6", col:1,row:1},
  {n:"04",name:"Exec Writer",     short:"60s forwardable readout",    tier:"Free", color:"#8B5CF6", col:0,row:1},
  {n:"05",name:"Stakeholder",     short:"3 audience versions",        tier:"Solo", color:"#A78BFA", col:0,row:2},
  {n:"06",name:"Deadline RE",     short:"Work backwards to hit date", tier:"Team", color:"#F59E0B", col:1,row:2},
];

function CometDot({ fromCx, fromCy, toCx, toCy, color }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let start;
    const dur = 580;
    const [r,g,b] = hex2rgb(color);
    el.style.boxShadow = `0 0 14px 4px rgba(${r},${g},${b},0.7)`;
    const animate = ts => {
      if (!start) start = ts;
      const t = Math.min((ts-start)/dur, 1);
      const ease = t<0.5 ? 2*t*t : -1+(4-2*t)*t;
      el.style.left = (fromCx+(toCx-fromCx)*ease - 4)+"px";
      el.style.top  = (fromCy+(toCy-fromCy)*ease - 4)+"px";
      el.style.opacity = t>0.88 ? String(1-(t-0.88)/0.12) : "1";
      if (t<1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [fromCx,fromCy,toCx,toCy,color]);
  return (
    <div ref={ref} style={{
      position:"absolute", left:fromCx-4, top:fromCy-4,
      width:8, height:8, borderRadius:"50%", background:color,
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
    <div style={{background:"rgba(7,10,8,0.93)",border:"1px solid #1C2128",borderRadius:14,overflow:"hidden",boxShadow:"0 28px 70px rgba(0,0,0,0.7), 0 0 0 1px rgba(62,203,111,0.05)",backdropFilter:"blur(16px)"}}>
      <div style={{padding:"10px 14px",borderBottom:"1px solid #1C2128",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontSize:"0.68rem",fontWeight:600,color:"#8A9E8A",display:"flex",alignItems:"center",gap:"0.4rem"}}>
          <span style={{width:5,height:5,borderRadius:"50%",background:G,animation:"pv-pulse 2s infinite",flexShrink:0}}/>
          Analysis Chain — active
        </div>
        <div style={{fontSize:"0.6rem",color:"#3E4E3E",fontFamily:"monospace"}}>6 agents</div>
      </div>
      <div style={{position:"relative",width:W,height:H}}>
        <svg style={{position:"absolute",inset:0,overflow:"visible",pointerEvents:"none"}} width={W} height={H}>
          {edges.map((e,i) => {
            const active = phase>i;
            const [r,g,b] = hex2rgb(e.color);
            return (
              <g key={i}>
                <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke={`rgba(${r},${g},${b},0.07)`} strokeWidth={1.5}/>
                <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke={`rgba(${r},${g},${b},${active?0.55:0})`}
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
              background: active?`rgba(${r},${g},${b},0.1)`:"rgba(255,255,255,0.015)",
              border:`1px solid ${active?a.color+"55":"#1C2128"}`,
              borderRadius:10, padding:"0.55rem 0.7rem",
              transition:"background 0.35s,border-color 0.35s,box-shadow 0.35s",
              boxShadow: current?`0 0 22px rgba(${r},${g},${b},0.25)`:"none",
              animation: current?"pv-agentBurst 0.42s ease":"none",
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.22rem"}}>
                <span style={{fontSize:"0.55rem",fontWeight:700,letterSpacing:"0.08em",color:active?a.color:"#3E4E3E"}}>{a.n}</span>
                <span style={{fontSize:"0.5rem",fontWeight:600,padding:"0.08rem 0.32rem",borderRadius:100,
                  background:active?`rgba(${r},${g},${b},0.15)`:"transparent",
                  color:active?a.color:"#3E4E3E",
                  border:`1px solid ${active?a.color+"35":"transparent"}`,
                }}>{a.tier}</span>
              </div>
              <div style={{fontSize:"0.76rem",fontWeight:700,color:active?"#EEF2EE":"#3E4E3E",lineHeight:1.2,marginBottom:"0.18rem"}}>{a.name}</div>
              <div style={{fontSize:"0.62rem",color:active?"#8A9E8A":"#3E4E3E",lineHeight:1.3}}>{a.short}</div>
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
      <div style={{padding:"10px 14px",borderTop:"1px solid #1C2128",display:"flex",alignItems:"center",gap:"0.75rem"}}>
        <div style={{fontSize:"0.6rem",fontWeight:600,letterSpacing:"0.08em",color:"#484F58",textTransform:"uppercase",flexShrink:0}}>On-time</div>
        <div style={{flex:1,height:3,borderRadius:2,background:"#1C2128"}}>
          <div style={{height:"100%",width:"86%",background:`linear-gradient(90deg,${G},#22C55E)`,borderRadius:2,boxShadow:`0 0 6px ${G}66`}}/>
        </div>
        <div style={{fontSize:"0.72rem",fontWeight:700,color:G,flexShrink:0}}>86%</div>
      </div>
    </div>
  );
}

/* ─── Demo data ──────────────────────────────────────────────────── */
const DEMO_TASKS = [
  {id:"t0",name:"Strategy & Planning",days:5, owner:"Marcus",  predecessors:[],          concurrent:false},
  {id:"t1",name:"Content & Copy",     days:8, owner:"Sarah",   predecessors:["t0"],      concurrent:false},
  {id:"t2",name:"Product Photography",days:6, owner:"James",   predecessors:["t0"],      concurrent:true},
  {id:"t3",name:"Design",             days:10,owner:"Marcus",  predecessors:["t1","t2"], concurrent:false},
  {id:"t4",name:"Klaviyo Setup",      days:4, owner:"Sarah",   predecessors:["t3"],      concurrent:true},
  {id:"t5",name:"Development",        days:12,owner:"Dev Team",predecessors:["t3"],      concurrent:false},
  {id:"t6",name:"SEO Setup",          days:4, owner:"Sarah",   predecessors:["t0"],      concurrent:false},
  {id:"t7",name:"QA & Testing",       days:5, owner:"Dev Team",predecessors:["t5","t4"], concurrent:false},
  {id:"t8",name:"Launch",             days:1, owner:"Marcus",  predecessors:["t7","t6"], concurrent:false},
];
const DEMO_RESULT = {
  bufferDays:2, bottleneck:{name:"Development"},
  tasks:[
    {id:"t0",name:"Strategy & Planning",days:5, es:0, ef:5, slack:0},
    {id:"t1",name:"Content & Copy",     days:8, es:5, ef:13,slack:0},
    {id:"t2",name:"Product Photography",days:6, es:5, ef:11,slack:4},
    {id:"t3",name:"Design",             days:10,es:13,ef:23,slack:0},
    {id:"t4",name:"Klaviyo Setup",      days:4, es:23,ef:27,slack:6},
    {id:"t5",name:"Development",        days:12,es:23,ef:35,slack:0},
    {id:"t6",name:"SEO Setup",          days:4, es:5, ef:9, slack:8},
    {id:"t7",name:"QA & Testing",       days:5, es:35,ef:40,slack:0},
    {id:"t8",name:"Launch",             days:1, es:40,ef:41,slack:0},
  ],
};

/* ─── DependencyGraph ────────────────────────────────────────────── */
function DependencyGraph({ tasks, result }) {
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
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
              onClick={()=>setSelectedId(t.id===selectedId?null:t.id)}
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
  useEffect(() => {
    const fn=()=>setScrolled(window.scrollY>60);
    window.addEventListener("scroll",fn,{passive:true});
    return ()=>window.removeEventListener("scroll",fn);
  },[]);

  const T = {
    bg:"#080A08",surface:"#0D1117",surface2:"#111519",
    border:"#1C2128",border2:"#252D25",
    text:"#EEF2EE",textMid:"#8A9E8A",textDim:"#3E4E3E",
    greenDim:"#0A1F12",amber:"#F59E0B",red:"#EF4444",blue:"#3B82F6",
  };

  const steps=[
    {n:"01",color:T.blue,icon:"⬡",title:"Map your project",desc:"Add tasks, set durations, assign owners, and define which tasks depend on each other. Takes about 5 minutes."},
    {n:"02",color:T.amber,icon:"⟳",title:"Pathflo finds the risks",desc:"Critical path is calculated instantly. Bottlenecks are flagged. Cascade impacts are simulated — automatically."},
    {n:"03",color:G,icon:"↗",title:"Execute with confidence",desc:"Share a live project health report with clients. Get early risk alerts. Defend your timeline with data."},
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
    {n:"01",name:"Risk Scanner",             tier:"Free", color:G,         plain:"Reads your project plan and finds the top 3-5 things most likely to blow up — before they do. Each risk comes with a probability score and exactly which tasks are the trigger."},
    {n:"02",name:"Fix Generator",            tier:"Free", color:"#22D3EE", plain:"Takes the risks and produces specific actions to fix them. Not generic advice — it references your actual tasks and owners."},
    {n:"03",name:"Cascade Modeler",          tier:"Free", color:T.blue,    plain:"Picks the highest-risk failure point and plays it out step by step. If Task A slips 5 days, here's exactly which tasks get blocked, in what order, and what the final deadline impact is."},
    {n:"04",name:"Executive Writer",         tier:"Free", color:"#8B5CF6", plain:"Turns everything above into a clean, one-page project status summary you can read in 60 seconds. Verdict, top risks, recommended actions — ready to share."},
    {n:"05",name:"Stakeholder Adapter",      tier:"Solo", color:"#A78BFA", plain:"Takes the executive summary and rewrites it three ways: client, team, and exec. Three audiences, zero rewriting."},
    {n:"06",name:"Deadline Reverse-Engineer",tier:"Team", color:T.amber,   plain:"The deadline is fixed. This agent works backwards from it and tells you exactly what has to be cut, compressed, or resourced to hit it."},
  ];
  const pricing=[
    {name:"Free", price:"$0",  period:"forever",tag:null,          primary:false,cta:"Start free",  desc:"Run your first analysis and see exactly where your project stands.",items:["1 project analysis","Critical path + dependency graph","Cascade impact simulator","Workload intelligence","AI Executive Readout","Risk Scanner","Fix Generator"]},
    {name:"Solo", price:"$49", period:"/mo",    tag:"Most popular", primary:true, cta:"Start Solo",  desc:"For contractors and operators who need to communicate project status to clients and leadership.",items:["Everything in Free","Unlimited projects","Stakeholder Adapter — 3 ready-to-send report versions","Cascade Modeler — full domino-effect simulation","Save & revisit projects"]},
    {name:"Team", price:"$99", period:"/mo",    tag:null,          primary:false,cta:"Start Team",  desc:"For agencies and teams managing multiple projects with multiple owners.",items:["Everything in Solo","Deadline Reverse-Engineer","Multi-owner workload mapping","Priority support"]},
  ];

  return (
    <main style={{background:T.bg,color:T.text,fontFamily:"'DM Sans',system-ui,sans-serif",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@300;400;500&family=Fraunces:ital,wght@0,300;0,700;1,300;1,700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#252D25;border-radius:2px}

        @keyframes pv-fadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pv-pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes pv-floatUp{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes pv-emberRise{0%{transform:translateY(0) scale(1);opacity:0.8}60%{opacity:0.5}100%{transform:translateY(-140px) scale(0.3);opacity:0}}
        @keyframes pv-cometStreak{0%{transform:translateX(-80px) translateY(0);opacity:0}12%{opacity:0.8}88%{opacity:0.5}100%{transform:translateX(340px) translateY(-70px);opacity:0}}
        @keyframes pv-haloSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pv-haloSpinR{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
        @keyframes pv-drift{0%,100%{transform:translateY(0) translateX(0)}33%{transform:translateY(-20px) translateX(12px)}66%{transform:translateY(12px) translateX(-9px)}}
        @keyframes pv-drift2{0%,100%{transform:translateY(0) translateX(0)}40%{transform:translateY(16px) translateX(-14px)}70%{transform:translateY(-12px) translateX(9px)}}
        @keyframes pv-noiseShift{0%{background-position:0 0}100%{background-position:100px 100px}}
        @keyframes pv-agentBurst{0%{transform:scale(0.85);opacity:0.4}55%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}

        .pv-grain{position:fixed;inset:0;z-index:5;pointer-events:none;opacity:0.025;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size:200px 200px;animation:pv-noiseShift 8s linear infinite}

        .pv-h1{animation:pv-fadeUp 0.85s 0.1s ease both}
        .pv-h2{animation:pv-fadeUp 0.85s 0.25s ease both}
        .pv-h3{animation:pv-fadeUp 0.85s 0.4s ease both}
        .pv-h4{animation:pv-fadeUp 0.85s 0.55s ease both}
        .pv-h5{animation:pv-fadeUp 0.85s 0.7s ease both}

        .pv-ember{position:absolute;width:3px;height:3px;border-radius:50%;background:${G};animation:pv-emberRise linear infinite;pointer-events:none}
        .pv-comet{position:absolute;width:80px;height:1px;background:linear-gradient(90deg,transparent,${G}88,transparent);border-radius:1px;animation:pv-cometStreak linear infinite;pointer-events:none}
        .pv-halo{position:absolute;border-radius:50%;border:1px solid rgba(62,203,111,0.06);animation:pv-haloSpin 28s linear infinite;pointer-events:none}
        .pv-halo2{position:absolute;border-radius:50%;border:1px solid rgba(62,203,111,0.035);animation:pv-haloSpinR 44s linear infinite;pointer-events:none}
        .pv-mist{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none}

        .pv-btn-p{display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;background:${G};color:#080A08;border:none;border-radius:100px;font-family:inherit;font-weight:700;font-size:0.95rem;padding:0.9rem 2rem;cursor:pointer;text-decoration:none;box-shadow:0 0 0 1px rgba(62,203,111,0.3),0 8px 32px rgba(62,203,111,0.22);transition:transform 0.15s,box-shadow 0.15s}
        .pv-btn-p:hover{transform:translateY(-2px);box-shadow:0 0 0 1px rgba(62,203,111,0.5),0 12px 40px rgba(62,203,111,0.35)}
        .pv-btn-s{display:inline-flex;align-items:center;justify-content:center;background:transparent;color:#8A9E8A;border:1.5px solid #252D25;border-radius:100px;font-family:inherit;font-weight:500;font-size:0.95rem;padding:0.9rem 2rem;cursor:pointer;text-decoration:none;transition:all 0.15s}
        .pv-btn-s:hover{border-color:${G};color:${G}}

        .pv-card{background:#0D1117;border:1px solid #1C2128;border-radius:16px;padding:1.75rem;position:relative;overflow:hidden;transition:transform 0.22s,box-shadow 0.22s,border-color 0.22s}
        .pv-card:hover{transform:translateY(-3px);box-shadow:0 12px 48px rgba(0,0,0,0.4);border-color:rgba(62,203,111,0.15)}

        .pv-price-card{background:#0D1117;border:1px solid #1C2128;border-radius:20px;padding:1.75rem;position:relative;overflow:visible;transition:transform 0.2s,box-shadow 0.2s}
        .pv-price-card:hover{transform:translateY(-3px);box-shadow:0 12px 48px rgba(0,0,0,0.4)}
        .pv-price-card.pv-featured{background:linear-gradient(145deg,rgba(62,203,111,0.08),rgba(13,17,13,0.95));border-color:rgba(62,203,111,0.35);box-shadow:0 0 0 1px rgba(62,203,111,0.15),0 20px 60px rgba(62,203,111,0.1)}

        .pv-ham{display:flex;flex-direction:column;gap:5px;cursor:pointer;padding:4px;border:none;background:transparent;z-index:202;position:relative}
        .pv-ham span{display:block;width:22px;height:2px;background:#EEF2EE;border-radius:2px;transition:all 0.28s}
        .pv-ham.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
        .pv-ham.open span:nth-child(2){opacity:0;transform:scaleX(0)}
        .pv-ham.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}

        .pv-nav-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:199;opacity:0;pointer-events:none;transition:opacity 0.3s;backdrop-filter:blur(4px)}
        .pv-nav-backdrop.open{opacity:1;pointer-events:auto}

        .pv-nav-drawer{position:fixed;top:0;left:0;bottom:0;width:300px;background:rgba(8,10,8,0.98);z-index:200;display:flex;flex-direction:column;padding:5rem 2.5rem 2.5rem;border-right:1px solid #1C2128;transform:translateX(-100%);transition:transform 0.32s cubic-bezier(0.4,0,0.2,1);box-shadow:8px 0 40px rgba(0,0,0,0.5)}
        .pv-nav-drawer.open{transform:translateX(0)}
        .pv-nav-drawer a{font-family:'Fraunces',serif;font-size:1.6rem;font-weight:300;color:#8A9E8A;text-decoration:none;transition:color 0.15s;letter-spacing:-0.02em;padding:0.4rem 0}
        .pv-nav-drawer a:hover{color:#EEF2EE}
        .pv-nav-drawer .pv-drawer-links{display:flex;flex-direction:column;gap:0.5rem;flex:1}
        .pv-nav-drawer .pv-drawer-cta{margin-top:2rem}

        .pv-comp-row:hover .pv-comp-right{background:rgba(62,203,111,0.05)}
        .pv-float{animation:pv-floatUp 5s ease-in-out infinite}

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

      <div className="pv-grain"/>
      <Preloader/>
      <ScrollProgress/>
      <BackgroundField/>

      {/* Fixed ambient cloudiness */}
      <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-15vh",left:"28%",width:900,height:900,borderRadius:"50%",background:"radial-gradient(circle,rgba(62,203,111,0.055) 0%,transparent 65%)",filter:"blur(50px)",animation:"pv-drift 32s ease-in-out infinite"}}/>
        <div style={{position:"absolute",top:"35vh",right:"-8%",width:700,height:700,borderRadius:"50%",background:"radial-gradient(circle,rgba(59,130,246,0.045) 0%,transparent 65%)",filter:"blur(70px)",animation:"pv-drift2 27s ease-in-out infinite"}}/>
        <div style={{position:"absolute",bottom:"15vh",left:"-8%",width:800,height:800,borderRadius:"50%",background:"radial-gradient(circle,rgba(139,92,246,0.04) 0%,transparent 65%)",filter:"blur(60px)",animation:"pv-drift 38s ease-in-out infinite reverse"}}/>
        <div style={{position:"absolute",top:"65vh",left:"38%",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(20,184,166,0.035) 0%,transparent 65%)",filter:"blur(80px)",animation:"pv-drift2 30s ease-in-out infinite reverse"}}/>
        <div style={{position:"absolute",top:"10vh",right:"15%",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(236,72,153,0.025) 0%,transparent 65%)",filter:"blur(90px)",animation:"pv-drift 42s ease-in-out infinite"}}/>
      </div>

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
        position:"fixed",top:2,left:0,right:0,zIndex:201,height:62,
        display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 1.75rem",
        background:scrolled?"rgba(8,10,8,0.94)":"transparent",
        backdropFilter:scrolled?"blur(24px)":"none",
        borderBottom:scrolled?"1px solid #1C2128":"none",
        transition:"all 0.35s",
      }}>
        <button className={`pv-ham ${navOpen?"open":""}`} onClick={()=>setNavOpen(o=>!o)} aria-label="Menu">
          <span/><span/><span/>
        </button>
        <a href="/" style={{textDecoration:"none",display:"flex",alignItems:"center",gap:"0.5rem",position:"absolute",left:"50%",transform:"translateX(-50%)"}}>
          <Logo color={G} size={22}/>
          <span style={{fontWeight:700,fontSize:"1.05rem",color:"#EEF2EE",letterSpacing:"-0.02em"}}>
            Path<span style={{color:G}}>flo</span>
          </span>
        </a>
        <a href="/app" className="pv-btn-p" style={{fontSize:"0.85rem",padding:"0.5rem 1.3rem"}}>Get started</a>
      </nav>

      {/* ── HERO ── */}
      <section style={{position:"relative",zIndex:1,padding:"148px 2rem 110px",maxWidth:1200,margin:"0 auto",overflow:"hidden"}}>
        <div className="pv-mist" style={{width:560,height:560,background:"radial-gradient(circle,rgba(62,203,111,0.1) 0%,transparent 70%)",top:"-12%",left:"52%",animation:"pv-drift 22s ease-in-out infinite"}}/>
        <div className="pv-mist" style={{width:380,height:380,background:"radial-gradient(circle,rgba(62,203,111,0.07) 0%,transparent 70%)",top:"18%",left:"-6%",animation:"pv-drift2 18s ease-in-out infinite"}}/>
        <div className="pv-mist" style={{width:300,height:300,background:"radial-gradient(circle,rgba(59,130,246,0.06) 0%,transparent 70%)",top:"55%",right:"-2%",animation:"pv-drift 26s ease-in-out infinite reverse"}}/>
        <div className="pv-mist" style={{width:220,height:220,background:"radial-gradient(circle,rgba(139,92,246,0.05) 0%,transparent 70%)",bottom:"8%",left:"25%",animation:"pv-drift2 20s ease-in-out infinite"}}/>
        <div className="pv-mist" style={{width:180,height:180,background:"radial-gradient(circle,rgba(20,184,166,0.05) 0%,transparent 70%)",top:"35%",left:"45%",animation:"pv-drift 24s ease-in-out infinite reverse"}}/>
        <div className="pv-halo"  style={{width:580,height:580,top:"calc(50% - 290px)",left:"calc(50% - 290px)"}}/>
        <div className="pv-halo2" style={{width:780,height:780,top:"calc(50% - 390px)",left:"calc(50% - 390px)"}}/>
        {[
          {l:"8%",b:"18%",d:"0s",r:"4.2s"},{l:"14%",b:"22%",d:"0.7s",r:"5.1s"},
          {l:"22%",b:"15%",d:"1.3s",r:"3.9s"},{l:"32%",b:"25%",d:"0.4s",r:"4.7s"},
          {l:"45%",b:"20%",d:"1.8s",r:"5.5s"},{l:"55%",b:"30%",d:"0.2s",r:"4.0s"},
          {l:"63%",b:"12%",d:"1.1s",r:"5.2s"},{l:"72%",b:"22%",d:"0.9s",r:"3.7s"},
          {l:"80%",b:"18%",d:"1.6s",r:"4.4s"},{l:"88%",b:"28%",d:"0.5s",r:"5.0s"},
          {l:"18%",b:"10%",d:"2.1s",r:"4.8s"},{l:"38%",b:"8%", d:"1.4s",r:"3.5s"},
          {l:"58%",b:"14%",d:"0.3s",r:"4.6s"},{l:"76%",b:"10%",d:"1.9s",r:"5.3s"},
        ].map((e,i)=>(
          <div key={i} className="pv-ember" style={{left:e.l,bottom:e.b,animationDelay:e.d,animationDuration:e.r}}/>
        ))}
        <div className="pv-comet" style={{top:"22%",left:"58%",animationDuration:"6s",animationDelay:"0s"}}/>
        <div className="pv-comet" style={{top:"54%",left:"18%",animationDuration:"8.5s",animationDelay:"3.2s"}}/>

        <div className="pv-hero-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4rem",alignItems:"center"}}>
          <div>
            <div className="pv-h1" style={{marginBottom:"1.75rem"}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:"0.5rem",background:"rgba(13,17,13,0.8)",border:"1px solid #252D25",borderRadius:"100px",padding:"0.4rem 1.1rem",fontSize:"0.68rem",fontWeight:600,color:"#8A9E8A",letterSpacing:"0.1em",backdropFilter:"blur(8px)"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:G,animation:"pv-pulse 2s infinite",flexShrink:0}}/>
                NOW LIVE — PLAN YOUR FIRST PROJECT FREE
              </span>
            </div>
            <h1 className="pv-h2" style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(2.8rem,6vw,4.4rem)",fontWeight:700,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:"1.5rem"}}>
              Know if your project<br/>will ship on time —<br/>
              <em style={{color:G,fontStyle:"italic",fontWeight:300}}>before work begins.</em>
            </h1>
            <p className="pv-h3" style={{fontSize:"clamp(1rem,2vw,1.1rem)",color:"#8A9E8A",lineHeight:1.85,maxWidth:"460px",marginBottom:"2.5rem",fontWeight:300}}>
              Map your tasks, define your dependencies, and Pathflo instantly surfaces your critical path, bottlenecks, and cascade risks.{" "}
              <span style={{fontWeight:500,color:"#EEF2EE"}}>No PM required.</span>
            </p>
            <div className="pv-h4 pv-hbtns" style={{display:"flex",gap:"1rem",marginBottom:"3.5rem"}}>
              <a href="/app" className="pv-btn-p" style={{fontSize:"1rem",padding:"1rem 2.25rem"}}>Build my first plan →</a>
              <a href="#how" className="pv-btn-s">See how it works</a>
            </div>
            <div className="pv-h5 pv-stats" style={{display:"flex",gap:"3rem"}}>
              {[{val:"5 min",label:"To your first risk report"},{val:"5 screens",label:"Of execution intelligence"},{val:"1 tap",label:"To share with a client"}].map(({val,label})=>(
                <div key={val}>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:"1.6rem",fontWeight:700,color:"#EEF2EE",letterSpacing:"-0.02em"}}>{val}</div>
                  <div style={{fontSize:"0.68rem",color:"#3E4E3E",fontWeight:500,letterSpacing:"0.07em",marginTop:"0.2rem",textTransform:"uppercase"}}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="pv-hero-right pv-float">
            <AgentFlow/>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <RevealSection id="how" style={{padding:"0 1.5rem",maxWidth:1050,margin:"0 auto 5rem"}}>
        <div style={{textAlign:"center",marginBottom:"3rem"}}>
          <div style={{fontSize:"0.65rem",color:G,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>HOW IT WORKS</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em"}}>
            From tasks to execution plan<br/><em style={{color:G,fontStyle:"italic",fontWeight:300}}>in under five minutes.</em>
          </h2>
        </div>
        <div className="pv-steps-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1.5rem"}}>
          {steps.map((step,i)=>(
            <div key={i} className="pv-card">
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:step.color,opacity:0.7}}/>
              <div style={{width:44,height:44,borderRadius:12,background:`${step.color}12`,border:`1px solid ${step.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.2rem",marginBottom:"1.25rem",color:step.color}}>{step.icon}</div>
              <div style={{fontSize:"0.6rem",fontWeight:700,letterSpacing:"0.1em",color:step.color,marginBottom:"0.4rem",textTransform:"uppercase"}}>{step.n}</div>
              <div style={{fontSize:"1rem",fontWeight:700,color:"#EEF2EE",marginBottom:"0.75rem",lineHeight:1.3}}>{step.title}</div>
              <div style={{fontSize:"0.875rem",color:"#8A9E8A",lineHeight:1.75,fontWeight:300}}>{step.desc}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"center",marginTop:"2.5rem"}}>
          <a href="/app" className="pv-btn-p">Start mapping my project →</a>
        </div>
      </RevealSection>

      {/* WHY IT WORKS */}
      <RevealSection id="why" style={{padding:"0 1.5rem",maxWidth:820,margin:"0 auto 5rem"}}>
        <div style={{textAlign:"center",marginBottom:"2.5rem"}}>
          <div style={{fontSize:"0.65rem",color:G,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>WHY IT WORKS</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em"}}>
            Four questions every PM has.<br/><em style={{color:G,fontStyle:"italic",fontWeight:300}}>Pathflo answers all of them.</em>
          </h2>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"0.75rem",maxWidth:680,margin:"0 auto"}}>
          {questions.map(({q,a,icon},i)=>(
            <div key={i} style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
              <div style={{display:"flex",justifyContent:"flex-end"}}>
                <div style={{background:"rgba(62,203,111,0.08)",border:"1px solid rgba(62,203,111,0.2)",borderRadius:"18px 18px 4px 18px",padding:"0.7rem 1.1rem",maxWidth:"80%",fontSize:"0.9rem",fontWeight:500,color:G,lineHeight:1.5}}>{q}</div>
              </div>
              <div style={{display:"flex",justifyContent:"flex-start",gap:"0.5rem",alignItems:"flex-start"}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:"#0A1F12",border:"1px solid #252D25",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",color:G,fontWeight:700,marginTop:2}}>{icon}</div>
                <div style={{background:"#0D1117",border:"1px solid #1C2128",borderRadius:"4px 18px 18px 18px",padding:"0.75rem 1.1rem",maxWidth:"85%",fontSize:"0.875rem",color:"#8A9E8A",lineHeight:1.7}}>{a}</div>
              </div>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"center",marginTop:"0.5rem"}}>
            <a href="/app" className="pv-btn-p" style={{fontSize:"0.9rem"}}>Try it on my project →</a>
          </div>
        </div>
      </RevealSection>

      {/* DEPENDENCY GRAPH */}
      <RevealSection id="graph" style={{padding:"0 1.5rem",maxWidth:1140,margin:"0 auto 5rem"}}>
        <div style={{textAlign:"center",marginBottom:"2.5rem"}}>
          <div style={{fontSize:"0.65rem",color:G,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>DEPENDENCY INTELLIGENCE</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em",marginBottom:"0.85rem"}}>
            See the failure chain<br/><em style={{color:G,fontStyle:"italic",fontWeight:300}}>before it happens.</em>
          </h2>
          <p style={{color:"#8A9E8A",fontSize:"0.95rem",fontWeight:300,lineHeight:1.8,maxWidth:"480px",margin:"0 auto"}}>
            Every dependency mapped. Every cascade risk surfaced. Every optimization identified — before a single day of work begins.
          </p>
        </div>
        <div style={{background:"#0D1117",border:"1px solid #1C2128",borderRadius:20,overflow:"hidden",boxShadow:"0 8px 40px rgba(0,0,0,0.5)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1rem 1.5rem",borderBottom:"1px solid #1C2128",flexWrap:"wrap",gap:"0.5rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.6rem",fontSize:"0.85rem",fontWeight:600,color:"#EEF2EE"}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:G,display:"inline-block",animation:"pv-pulse 2s infinite"}}/>
              Website Launch — Northstar Nutrition
            </div>
            <div style={{display:"flex",gap:"1.5rem",flexWrap:"wrap"}}>
              {[{label:"Tasks",val:"9"},{label:"Dependencies",val:"11"},{label:"Critical Path",val:"5 tasks"}].map(s=>(
                <div key={s.label} style={{fontSize:"0.72rem",color:"#8A9E8A"}}>{s.label} <span style={{color:"#EEF2EE",fontWeight:700}}>{s.val}</span></div>
              ))}
            </div>
            <div style={{fontSize:"0.68rem",borderRadius:6,padding:"0.25rem 0.75rem",fontWeight:700,letterSpacing:"0.06em",background:"rgba(239,68,68,0.08)",color:"#EF4444",border:"1px solid rgba(239,68,68,0.25)"}}>⚠ CASCADE RISK DETECTED</div>
          </div>
          <div className="pv-graph-body" style={{display:"grid",gridTemplateColumns:"1fr 272px",overflow:"visible"}}>
            <DependencyGraph tasks={DEMO_TASKS} result={DEMO_RESULT}/>
            <div className="pv-graph-rp" style={{borderLeft:"1px solid #1C2128",padding:"1.25rem",display:"flex",flexDirection:"column",gap:"1rem"}}>
              <div>
                <div style={{fontSize:"0.6rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:"#EF4444",marginBottom:"0.4rem"}}>BIGGEST RISK</div>
                <div style={{background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"0.85rem"}}>
                  <div style={{fontSize:"0.8rem",fontWeight:700,color:"#EF4444",marginBottom:"0.3rem"}}>⚠ Development is the bottleneck</div>
                  <div style={{fontSize:"0.77rem",lineHeight:1.65,color:"#8A9E8A"}}>QA &amp; Testing can't start until it's done. 2 days of buffer remain — any slip cascades into Launch.</div>
                </div>
              </div>
              <div>
                <div style={{fontSize:"0.6rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:"#8A9E8A",marginBottom:"0.4rem"}}>CASCADE IMPACT</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.4rem"}}>
                  {[{label:"Delay Risk",val:"+5–7d",color:"#EF4444"},{label:"Tasks Blocked",val:"3 tasks",color:"#EF4444"},{label:"Owners at Risk",val:"3 people",color:T.amber},{label:"Cost Exposure",val:"$4,200",color:T.amber}].map((s,i)=>(
                    <div key={i} style={{background:"#111519",border:"1px solid #1C2128",borderRadius:8,padding:"0.5rem 0.65rem"}}>
                      <div style={{fontSize:"0.56rem",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",color:"#3E4E3E",marginBottom:"0.15rem"}}>{s.label}</div>
                      <div style={{fontSize:"0.9rem",fontWeight:700,color:s.color}}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:"0.6rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:G,marginBottom:"0.4rem"}}>PATHFLO FIX</div>
                <div style={{background:"#0A1F12",border:"1px solid rgba(62,203,111,0.15)",borderRadius:10,padding:"0.85rem"}}>
                  <div style={{fontSize:"0.72rem",fontWeight:700,color:G,marginBottom:"0.35rem"}}>+ Run Photography in parallel with Design</div>
                  <div style={{fontSize:"0.77rem",lineHeight:1.65,color:"#8A9E8A"}}>Recovers 4 days. Protects the deadline at zero cost.</div>
                  <div style={{display:"flex",alignItems:"center",gap:"0.6rem",marginTop:"0.65rem"}}>
                    <div style={{fontSize:"0.6rem",color:"#3E4E3E"}}>Confidence</div>
                    <div style={{flex:1,height:3,borderRadius:2,background:"#1C2128"}}>
                      <div style={{height:"100%",width:"86%",background:G,borderRadius:2}}/>
                    </div>
                    <div style={{fontSize:"0.72rem",fontWeight:700,color:G}}>86%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"1rem",padding:"0.75rem 1.5rem",borderTop:"1px solid #1C2128"}}>
            {[{color:"#EF4444",label:"Critical / Zero float"},{color:T.amber,label:"At risk"},{color:G,label:"On track"},{color:"#3E4E3E",label:"Has buffer"}].map((l,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:"0.4rem",fontSize:"0.68rem",color:"#8A9E8A"}}>
                <div style={{width:9,height:9,borderRadius:3,border:"1.5px solid "+l.color,background:l.color+"18"}}/>
                {l.label}
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* COMPARISON */}
      <RevealSection style={{padding:"0 1.5rem",maxWidth:780,margin:"0 auto 5rem"}}>
        <div style={{textAlign:"center",marginBottom:"2.5rem"}}>
          <div style={{fontSize:"0.65rem",color:G,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>THE DIFFERENCE</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em"}}>
            PM tools track the work.<br/><em style={{color:G,fontStyle:"italic",fontWeight:300}}>Pathflo predicts the outcome.</em>
          </h2>
        </div>
        <div style={{background:"#0D1117",border:"1px solid #1C2128",borderRadius:16,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}>
            <div style={{padding:"0.85rem 1.5rem",background:"#111519",fontSize:"0.7rem",fontWeight:700,color:"#8A9E8A",letterSpacing:"0.1em"}}>OTHER PM TOOLS</div>
            <div style={{padding:"0.85rem 1.5rem",background:"rgba(62,203,111,0.05)",fontSize:"0.7rem",fontWeight:700,color:G,letterSpacing:"0.1em",display:"flex",alignItems:"center",gap:"0.4rem"}}>
              <Logo color={G} size={12}/>PATHFLO
            </div>
          </div>
          {comparison.map(({pm,pathflo},i)=>(
            <div key={i} className="pv-comp-row" style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderTop:"1px solid #1C2128"}}>
              <div style={{padding:"0.9rem 1.5rem",fontSize:"0.875rem",color:"#8A9E8A",display:"flex",gap:"0.6rem",alignItems:"flex-start"}}>
                <span style={{color:"#EF4444",flexShrink:0,fontSize:"0.68rem",marginTop:"0.1rem"}}>✕</span>{pm}
              </div>
              <div className="pv-comp-right" style={{padding:"0.9rem 1.5rem",fontSize:"0.875rem",color:"#EEF2EE",display:"flex",gap:"0.6rem",alignItems:"flex-start",transition:"background 0.2s"}}>
                <span style={{color:G,flexShrink:0,fontSize:"0.68rem",marginTop:"0.1rem"}}>✓</span>{pathflo}
              </div>
            </div>
          ))}
        </div>
      </RevealSection>

      {/* AI AGENTS */}
      <RevealSection style={{padding:"0 1.5rem",maxWidth:1000,margin:"0 auto 5rem"}}>
        <div style={{textAlign:"center",marginBottom:"2.5rem"}}>
          <div style={{fontSize:"0.65rem",color:G,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>UNDER THE HOOD</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em",marginBottom:"0.85rem"}}>
            Six AI agents.<br/><em style={{color:G,fontStyle:"italic",fontWeight:300}}>One analysis.</em>
          </h2>
          <p style={{color:"#8A9E8A",fontSize:"0.95rem",fontWeight:300,lineHeight:1.8,maxWidth:"480px",margin:"0 auto"}}>
            Each agent does one job. Together they turn your project plan into a complete risk picture — and the reports to act on it.
          </p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"1.25rem"}}>
          {agents.map((a,i)=>{
            const [r,g,b]=hex2rgb(a.color);
            return (
              <div key={i} className="pv-card">
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:a.color}}/>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.65rem"}}>
                  <div style={{fontSize:"0.6rem",color:a.color,fontWeight:700,letterSpacing:"0.1em"}}>{a.n} · {a.name.toUpperCase()}</div>
                  <div style={{fontSize:"0.55rem",fontWeight:700,padding:"0.2rem 0.5rem",borderRadius:100,background:`rgba(${r},${g},${b},0.12)`,color:a.color,border:`1px solid rgba(${r},${g},${b},0.3)`}}>{a.tier}</div>
                </div>
                <p style={{fontSize:"0.82rem",color:"#8A9E8A",lineHeight:1.75}}>{a.plain}</p>
              </div>
            );
          })}
        </div>
      </RevealSection>

      {/* PRICING */}
      <RevealSection id="pricing" style={{padding:"0 1.5rem",maxWidth:1000,margin:"0 auto 5rem"}}>
        <div style={{textAlign:"center",marginBottom:"3.5rem"}}>
          <div style={{fontSize:"0.65rem",color:G,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:"0.75rem"}}>PRICING</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(1.8rem,4vw,2.6rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.025em",marginBottom:"0.75rem"}}>
            Start free. Upgrade when it pays for itself.
          </h2>
          <p style={{color:"#8A9E8A",fontSize:"0.95rem",fontWeight:300}}>No credit card required.</p>
        </div>
        <div className="pv-pgrid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1.25rem"}}>
          {pricing.map(({name,price,period,tag,desc,items,cta,primary})=>(
            <div key={name} className={`pv-price-card ${primary?"pv-featured":""}`}>
              {tag&&<div style={{position:"absolute",top:-13,left:"50%",transform:"translateX(-50%)",background:G,color:"#080A08",fontWeight:700,fontSize:"0.65rem",letterSpacing:"0.08em",padding:"0.2rem 0.85rem",borderRadius:"100px",whiteSpace:"nowrap"}}>{tag}</div>}
              <div style={{fontSize:"0.65rem",fontWeight:700,color:primary?G:"#8A9E8A",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"0.65rem"}}>{name}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:"0.2rem",marginBottom:"0.5rem"}}>
                <span style={{fontFamily:"'Fraunces',serif",fontSize:"2.8rem",fontWeight:700,color:"#EEF2EE",lineHeight:1}}>{price}</span>
                <span style={{fontSize:"0.8rem",color:"#3E4E3E"}}>{period}</span>
              </div>
              <p style={{fontSize:"0.83rem",color:"#8A9E8A",lineHeight:1.65,marginBottom:"1.5rem"}}>{desc}</p>
              <div style={{display:"flex",flexDirection:"column",gap:"0.6rem",marginBottom:"1.75rem"}}>
                {(items||[]).map(item=>(
                  <div key={item} style={{display:"flex",gap:"0.65rem",fontSize:"0.85rem",color:"#EEF2EE",alignItems:"flex-start"}}>
                    <span style={{color:G,flexShrink:0,fontSize:"0.7rem",marginTop:"0.15rem"}}>✓</span>
                    <span style={{fontWeight:300}}>{item}</span>
                  </div>
                ))}
              </div>
              <a href="/app" className={primary?"pv-btn-p":"pv-btn-s"} style={{width:"100%",justifyContent:"center"}}>{cta}</a>
            </div>
          ))}
        </div>
        <p style={{textAlign:"center",marginTop:"1.75rem",fontSize:"0.75rem",color:"#3E4E3E"}}>No credit card required for free plan. Cancel anytime.</p>
      </RevealSection>

      {/* FINAL CTA */}
      <RevealSection style={{padding:"0 1.5rem",maxWidth:620,margin:"0 auto 5rem"}}>
        <div style={{textAlign:"center",padding:"3.5rem 2rem",background:"#0D1117",border:"1px solid #252D25",borderRadius:24,boxShadow:"0 0 0 1px rgba(62,203,111,0.06),0 32px 80px rgba(0,0,0,0.4)",position:"relative",overflow:"hidden"}}>
          <div className="pv-mist" style={{width:320,height:320,background:"radial-gradient(circle,rgba(62,203,111,0.08) 0%,transparent 70%)",top:"-30%",left:"50%",transform:"translateX(-50%)",animation:"pv-drift 18s ease-in-out infinite"}}/>
          <div style={{position:"relative",zIndex:1}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:"0.5rem",background:"rgba(62,203,111,0.06)",border:"1px solid rgba(62,203,111,0.15)",borderRadius:8,padding:"0.4rem 0.85rem",marginBottom:"1.75rem",fontFamily:"'DM Mono',monospace",fontSize:"0.72rem",color:G}}>
              <span style={{animation:"pv-pulse 2s infinite",width:5,height:5,borderRadius:"50%",background:G,flexShrink:0}}/>
              {"$ pathflo init --project new"}
            </div>
            <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(2.2rem,6vw,3.5rem)",fontWeight:700,lineHeight:1.06,letterSpacing:"-0.03em",marginBottom:"1.25rem"}}>
              Your next project<br/><em style={{color:G,fontStyle:"italic",fontWeight:300}}>deserves a plan that works.</em>
            </h2>
            <p style={{color:"#8A9E8A",fontSize:"1rem",lineHeight:1.8,marginBottom:"2.5rem",fontWeight:300}}>Set up in 5 minutes. No PM required. No credit card needed.</p>
            <a href="/app" className="pv-btn-p" style={{fontSize:"1.05rem",padding:"1.1rem 2.75rem"}}>Start my first project free →</a>
            <p style={{marginTop:"1.25rem",fontSize:"0.75rem",color:"#3E4E3E"}}>Free forever · No setup required</p>
          </div>
        </div>
      </RevealSection>

      {/* FOOTER */}
      <footer style={{borderTop:"1px solid #1C2128",padding:"2rem 2.5rem",position:"relative",zIndex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"1rem",maxWidth:1200,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
            <Logo color={G} size={15}/>
            <span style={{fontSize:"0.75rem",color:"#3E4E3E",fontWeight:300}}>© 2026 Pathflo. All rights reserved.</span>
          </div>
          <div style={{display:"flex",gap:"0.5rem",alignItems:"center"}}>
            <span style={{width:5,height:5,borderRadius:"50%",background:G,animation:"pv-pulse 2s infinite"}}/>
            <span style={{fontSize:"0.7rem",color:"#3E4E3E",fontFamily:"'DM Mono',monospace"}}>All systems operational</span>
          </div>
          <div style={{display:"flex",gap:"2rem"}}>
            {[{label:"Privacy",href:"#"},{label:"Terms",href:"#"},{label:"Contact",href:"mailto:mike.rerecich2@gmail.com"}].map(l=>(
              <a key={l.label} href={l.href} style={{fontSize:"0.75rem",color:"#3E4E3E",textDecoration:"none"}}>{l.label}</a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
