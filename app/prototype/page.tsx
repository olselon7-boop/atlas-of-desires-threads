"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Desire = {
  id: string;
  text: string;
  deep_desire: string | null;
  dream_state: string | null;
  agency: string | null;
  language: string | null;
  year: number | null;
  has_media: boolean;
};

const LABELS: Record<string,string> = {
  love_relationships: "LOVE",
  home_belonging: "HOME",
  travel_exploration: "TRAVEL",
  career_self_realization: "WORK",
  money_material_security: "MATERIAL",
  freedom_independence: "FREEDOM",
  creativity_expression: "CREATE",
  education_growth: "LEARN",
  family_children: "FAMILY",
  health_wellbeing: "BODY",
  recognition_status: "RECOGNITION",
  community_justice: "COLLECTIVE",
  experience_pleasure: "EXPERIENCE",
  other: "OTHER",
  unknown: "UNKNOWN",
};

function hash01(s:string){
  let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return ((h>>>0)%100000)/100000;
}



type Gesture =
  | "rise" | "fall" | "wave" | "loop" | "return" | "open"
  | "tighten" | "burst" | "zigzag" | "drift" | "climb" | "pulse"
  | "circle" | "bridge" | "spiral" | "straight";

function tokenizeDream(text:string){
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g," ")
    .replace(/[^a-zа-яё0-9\s-]/gi," ")
    .split(/\s+/)
    .filter(Boolean);
}

function tokenGesture(token:string):Gesture{
  if(/(море|океан|волна|sea|ocean|beach|water)/i.test(token)) return "wave";
  if(/(дом|квартир|жиль|home|house|apartment)/i.test(token)) return "return";
  if(/(уехать|переех|лететь|поехать|travel|move|fly|trip|journey)/i.test(token)) return "rise";
  if(/(машин|авто|car|tesla|bmw|nissan|motor)/i.test(token)) return "bridge";
  if(/(люб|отнош|свад|love|marry|relationship|wedding)/i.test(token)) return "loop";
  if(/(реб[её]н|дет|сын|доч|child|baby|son|daughter)/i.test(token)) return "circle";
  if(/(гора|вершин|climb|mountain|peak|summit)/i.test(token)) return "climb";
  if(/(город|city|moscow|paris|london|york)/i.test(token)) return "zigzag";
  if(/(сцен|концерт|театр|stage|concert|perform)/i.test(token)) return "open";
  if(/(деньг|миллион|богат|money|million|rich|income)/i.test(token)) return "pulse";
  if(/(твор|рисов|писат|музык|create|art|paint|write|music)/i.test(token)) return "spiral";
  if(/(учит|книг|универ|study|learn|book|university)/i.test(token)) return "climb";
  if(/(спорт|здоров|бег|fitness|health|run|body)/i.test(token)) return "pulse";
  if(/(страх|бою|неполуч|невозмож|stuck|afraid|fail|cannot|can't)/i.test(token)) return "tighten";
  if(/(сбыл|исполнил|осуществил|реализовал|achieved|fulfilled|came|reality)/i.test(token)) return "burst";
  if(/(вернут|назад|return|back)/i.test(token)) return "return";
  if(/(свобод|freedom|free)/i.test(token)) return "open";
  if(/(хочу|мечта|dream|wish|want)/i.test(token)) return "drift";
  return "straight";
}

function buildGestureSequence(text:string, id:string):Gesture[]{
  const tokens=tokenizeDream(text);
  const seq:Gesture[]=[];
  for(const token of tokens){
    const g=tokenGesture(token);
    if(g!=="straight" || hash01(token+id)>.72) seq.push(g);
    if(seq.length>=9) break;
  }
  if(seq.length<3){
    const fallback:Gesture[]=["drift","wave","open","loop","rise","pulse","zigzag"];
    for(let i=seq.length;i<4;i++) seq.push(fallback[Math.floor(hash01(id+"f"+i)*fallback.length)]);
  }
  return seq;
}

function applyGesture(g:Gesture,u:number,seed:number){
  const s=u*2-1;
  switch(g){
    case "rise": return {x:s,y:.48-.72*u+.08*Math.sin(u*Math.PI*3+seed)};
    case "fall": return {x:s,y:-.35+.65*u};
    case "wave": return {x:s,y:.22*Math.sin(u*Math.PI*2.5+seed)};
    case "loop": {
      const a=u*Math.PI*2;
      return {x:.72*Math.sin(a),y:-.5*Math.cos(a)+.18*Math.cos(a*2)};
    }
    case "return": {
      const a=u*Math.PI*2;
      return {x:.68*Math.cos(a)*(1-u*.15)+s*.25,y:.48*Math.sin(a)-.18*s};
    }
    case "open": return {x:s+.18*Math.sin(u*Math.PI),y:-.42*Math.sin(u*Math.PI)};
    case "tighten": {
      const a=u*Math.PI*5;
      const r=.52*(1-u)+.07;
      return {x:r*Math.cos(a)+s*.45,y:r*Math.sin(a)};
    }
    case "burst": {
      const a=u*Math.PI*2;
      const r=.12+.82*u;
      return {x:r*Math.cos(a)+s*.28,y:r*Math.sin(a)*.65};
    }
    case "zigzag": return {x:s,y:.34*(Math.floor(u*8)%2?1:-1)*(1-u*.2)};
    case "drift": return {x:s,y:.2*Math.sin(u*Math.PI*1.5+seed*3)};
    case "climb": return {x:s,y:.52-.88*u+.1*Math.sin(u*Math.PI*5)};
    case "pulse": return {x:s,y:.18*Math.sin(u*Math.PI*6)+.08*Math.sin(u*Math.PI*13+seed)};
    case "circle": {
      const a=u*Math.PI*2;
      return {x:.55*Math.cos(a)+s*.38,y:.42*Math.sin(a)};
    }
    case "bridge": return {x:s,y:-.28*Math.sin(u*Math.PI)+.08*Math.sin(u*Math.PI*5)};
    case "spiral": {
      const a=u*Math.PI*4.5;
      const r=.08+.72*u;
      return {x:r*Math.cos(a)+s*.24,y:r*Math.sin(a)*.7};
    }
    default: return {x:s,y:0};
  }
}

function drawDreamStroke(
  ctx: CanvasRenderingContext2D,
  d: Desire,
  x: number,
  y: number,
  size: number,
  alpha: number,
  selected: boolean
){
  const seed=hash01(d.id+"stroke");
  const gestures=buildGestureSequence(d.text,d.id);
  const segs=gestures.length;
  const pts:Array<{x:number;y:number}>=[];
  let cursorX=-1;
  let cursorY=0;

  for(let gi=0;gi<segs;gi++){
    const g=gestures[gi];
    const localSteps=10;
    const amp=.72 + hash01(d.id+"amp"+gi)*.5;
    const tilt=(hash01(d.text+"tilt"+gi)-.5)*.34;

    for(let j=0;j<=localSteps;j++){
      const u=j/localSteps;
      const p=applyGesture(g,u,seed+gi*.73);
      const span=2/segs;
      const targetX=-1 + (gi+u)*span;
      const blend=.55;
      const px=targetX*(1-blend)+(cursorX+p.x*span*.55)*blend;
      const py=cursorY + p.y*amp + tilt*(u-.5);

      pts.push({x:x+px*size*1.18,y:y+py*size});
    }

    const last=pts[pts.length-1];
    cursorX=(last.x-x)/(size*1.18);
    cursorY=(last.y-y)/size*.38;
  }

  ctx.beginPath();
  ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length-1;i++){
    const mx=(pts[i].x+pts[i+1].x)/2;
    const my=(pts[i].y+pts[i+1].y)/2;
    ctx.quadraticCurveTo(pts[i].x,pts[i].y,mx,my);
  }
  const last=pts[pts.length-1];
  ctx.lineTo(last.x,last.y);
  ctx.strokeStyle=selected
    ? "rgba(239,242,226,.98)"
    : `rgba(203,216,165,${alpha.toFixed(3)})`;
  ctx.lineWidth=selected?2.15:1.1;
  ctx.lineCap="round";
  ctx.lineJoin="round";
  ctx.stroke();

  return { radius:size*1.12, gestures };
}

export default function PrototypePage(){
  const [desires,setDesires]=useState<Desire[]>([]);
  const [selected,setSelected]=useState<Desire|null>(null);
  const [hovered,setHovered]=useState<Desire|null>(null);
  const [paused,setPaused]=useState(false);
  const [speed,setSpeed]=useState(.7);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);

  useEffect(()=>{
    fetch("/api/art/prototype-feed",{cache:"no-store"})
      .then(r=>r.json())
      .then(d=>setDesires(d.desires||[]))
      .catch(()=>setDesires([]));
  },[]);

  const clusterCount=useMemo(()=>new Set(desires.map(d=>d.deep_desire||"unknown")).size,[desires]);

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas||!desires.length) return;
    const ctx=canvas.getContext("2d");
    if(!ctx) return;

    let raf=0;
    let last=performance.now();
    let t=0;
    const nodes=desires.map((d,i)=>({
      d,
      lane:(hash01(d.id+"lane")-.5)*1.7,
      offset:hash01(d.id+"off")*1.15,
      phase:hash01(d.id+"phase")*Math.PI*2,
      size:1.2+hash01(d.id+"size")*2.7,
      drift:(hash01(d.id+"drift")-.5)*.18
    }));

    const resize=()=>{
      const dpr=Math.min(window.devicePixelRatio||1,2);
      canvas.width=Math.floor(canvas.clientWidth*dpr);
      canvas.height=Math.floor(canvas.clientHeight*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
    };
    resize();
    window.addEventListener("resize",resize);

    const draw=(now:number)=>{
      const dt=Math.min(.05,(now-last)/1000); last=now;
      if(!paused)t+=dt*speed;
      const w=canvas.clientWidth,h=canvas.clientHeight;
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle="#050706";
      ctx.fillRect(0,0,w,h);

      const cx=w*.5, horizon=h*.48;

      ctx.strokeStyle="rgba(220,228,210,.12)";
      ctx.lineWidth=1;
      for(let k=0;k<9;k++){
        const z=((k/9)+t*.012)%1;
        const scale=.12+z*z*1.4;
        const rw=w*.08*scale;
        const rh=h*.18*scale;
        ctx.beginPath();
        ctx.ellipse(cx,horizon+(z-.22)*h*.34,rw,rh,0,0,Math.PI*2);
        ctx.stroke();
      }

      ctx.strokeStyle="rgba(203,216,165,.22)";
      ctx.beginPath();
      ctx.moveTo(cx,h*.12);
      for(let y=0;y<=h;y+=8){
        const p=y/h;
        const x=cx+Math.sin(p*8+t*.18)*w*.035*(.2+p);
        ctx.lineTo(x,y);
      }
      ctx.stroke();

      const hit:Array<{x:number;y:number;r:number;d:Desire;z:number;scale:number;isSel:boolean}>=[];
      const sorted=[...nodes].sort((a,b)=>a.offset-b.offset);
      for(const n of sorted){
        let z=(n.offset+t*.015+n.drift)%1;
        if(z<0)z+=1;
        let visualZ=z;
        if(z>.805 && z<.875){
          const p=(z-.805)/.07;
          visualZ=.805+p*.018;
        } else if(z>=.875){
          visualZ=.823+(z-.875)*1.42;
        }
        const depth=visualZ*visualZ;
        const scale=.22+depth*1.75;
        const x=cx+n.lane*w*.18*scale+Math.sin(t*.6+n.phase)*12*scale;
        const y=horizon+(visualZ-.18)*h*.48;
        const isSel=selected?.id===n.d.id;
        const strokeSize=(16+visualZ*46)*(isSel?1.32:1);
        const alpha=.12+visualZ*.56+(n.d.has_media?.08:0);
        const shape=drawDreamStroke(ctx,n.d,x,y,strokeSize,Math.min(.82,alpha),isSel);

        hit.push({x,y,r:Math.max(12,shape.radius),d:n.d,z:visualZ,scale,isSel});
      }

      const focusCandidates=(hit as any[])
        .filter(x=>!selected || x.d.id!==selected.id)
        .filter(x=>x.z>.79)
        .sort((a,b)=>Math.abs(.825-a.z)-Math.abs(.825-b.z));

      const primary=focusCandidates[0] || null;
      const secondary=focusCandidates.slice(1,4);

      if(primary){
        const clean=primary.d.text.replace(/https?:\/\/\S+/g,"").replace(/\s+/g," ").trim();
        const txt=clean.slice(0,82)+(clean.length>82?"…":"");
        const fs=22;
        ctx.font=`${fs}px Georgia,serif`;
        const m=ctx.measureText(txt);
        const maxW=w*.58;
        const bw=Math.min(m.width,maxW);
        let bx=primary.x+primary.r*2.7;
        if(bx+bw>w-24) bx=Math.max(24,primary.x-primary.r*2.7-bw);
        let by=Math.max(36,Math.min(h-90,primary.y-10));

        ctx.fillStyle="rgba(5,7,6,.78)";
        ctx.fillRect(bx-10,by-fs,bw+20,fs+18);
        ctx.fillStyle="rgba(244,244,234,.96)";
        ctx.textBaseline="middle";
        ctx.fillText(txt,bx,by-fs*.2);

        ctx.textBaseline="alphabetic";
      }

      for(const lh of secondary){
        const clean=lh.d.text.replace(/https?:\/\/\S+/g,"").replace(/\s+/g," ").trim();
        const txt=clean.slice(0,34)+(clean.length>34?"…":"");
        ctx.font="12px Georgia,serif";
        ctx.fillStyle="rgba(231,228,218,.18)";
        let bx=lh.x+lh.r*2.2;
        if(bx>w*.82) bx=lh.x-lh.r*2.2-ctx.measureText(txt).width;
        ctx.fillText(txt,bx,lh.y);
      }

      if(selected){
        const sh=(hit as any[]).find(x=>x.d.id===selected.id);
        if(sh){
          const clean=selected.text.replace(/https?:\/\/\S+/g,"").replace(/\s+/g," ").trim();
          const maxChars=88;
          const text=clean.slice(0,maxChars)+(clean.length>maxChars?"…":"");
          const fontSize=16;
          ctx.font=`${fontSize}px Georgia,serif`;
          const metrics=ctx.measureText(text);
          const padX=11,padY=8;
          const bw=Math.min(metrics.width+padX*2,w*.38);
          const bh=fontSize+padY*2;
          let bx=sh.x+sh.r*2.8;
          let by=sh.y-bh/2;
          if(bx+bw>w-20) bx=sh.x-sh.r*2.8-bw;
          by=Math.max(20,Math.min(canvas.clientHeight-bh-20,by));
          ctx.fillStyle="rgba(5,7,6,.94)";
          ctx.fillRect(bx,by,bw,bh);
          ctx.strokeStyle="rgba(203,216,165,.55)";
          ctx.strokeRect(bx+.5,by+.5,bw-1,bh-1);
          ctx.fillStyle="rgba(246,246,238,.97)";
          ctx.textBaseline="middle";
          ctx.fillText(text,bx+padX,by+bh/2);
          ctx.textBaseline="alphabetic";
        }
      }

      (canvas as any).__hits=hit;
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);

    const pick=(e:MouseEvent)=>{
      const rect=canvas.getBoundingClientRect();
      const x=e.clientX-rect.left,y=e.clientY-rect.top;
      const hits=(canvas as any).__hits||[];
      let best:any=null,bestD=Infinity;
      for(const h of hits){
        const d=Math.hypot(x-h.x,y-h.y);
        if(d<h.r*2.4&&d<bestD){best=h;bestD=d}
      }
      return best;
    };
    const onClick=(e:MouseEvent)=>{const best=pick(e);if(best)setSelected(best.d)};
    const onMove=(e:MouseEvent)=>{const best=pick(e);setHovered(best?.d||null);canvas.style.cursor=best?"pointer":"crosshair"};
    const onLeave=()=>setHovered(null);
    canvas.addEventListener("click",onClick);
    canvas.addEventListener("mousemove",onMove);
    canvas.addEventListener("mouseleave",onLeave);
    return ()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);canvas.removeEventListener("click",onClick);canvas.removeEventListener("mousemove",onMove);canvas.removeEventListener("mouseleave",onLeave)};
  },[desires,paused,speed,selected]);

  return <main className="atlasProto">
    <header className="protoTop">
      <div><span>ATLAS OF DESIRES</span><b>PROTOTYPE 01</b></div>
      <div className="protoMeta">{desires.length} DESIRES · {clusterCount} SEMANTIC FIELDS · X / 2026</div>
    </header>

    <section className="protoStage">
      <canvas ref={canvasRef} />
      <div className="protoYears">
        <span>2010</span><span>2012</span><span>2014</span><span>2016</span><span>2018</span><span>2020</span><span>2022</span><span>2024</span><span>2026</span>
      </div>
      <div className="protoHint">READ THE FOCUS · HOVER / CLICK TO FOLLOW</div>

      {hovered && !selected && <div className="hoverDream">
        <span>{LABELS[hovered.deep_desire||"unknown"]||hovered.deep_desire||"UNKNOWN"}</span>
        <p>{hovered.text}</p>
      </div>}

      {selected && <aside className="dreamCard">
        <button onClick={()=>setSelected(null)} aria-label="close">×</button>
        <div className="dreamTag">{LABELS[selected.deep_desire||"unknown"]||selected.deep_desire||"UNKNOWN"} · {buildGestureSequence(selected.text,selected.id).slice(0,4).join(" → ").toUpperCase()}</div>
        <blockquote>{selected.text}</blockquote>
        <div className="dreamGrid">
          <span>STATE<b>{selected.dream_state||"unknown"}</b></span>
          <span>AGENCY<b>{selected.agency||"unknown"}</b></span>
          <span>YEAR<b>{selected.year||"—"}</b></span>
          <span>IMAGE<b>{selected.has_media?"yes":"no"}</b></span>
        </div>
        <div className="followLine"><i></i><em>FOLLOW THIS DREAM</em></div>
      </aside>}
    </section>

    <footer className="protoControls">
      <div className="protoLegend">
        <span>ONE LINE = ONE DESIRE</span>
        <span>BRIGHTER = IMAGE ATTACHED</span>
        <span>SPACE = SEMANTIC PROXIMITY / PROTOTYPE</span>
      </div>
      <div className="protoButtons">
        <button onClick={()=>setPaused(v=>!v)}>{paused?"PLAY":"PAUSE"}</button>
        <button onClick={()=>setSpeed(v=>v>=2?.5:v+.5)}>SPEED {speed.toFixed(1)}×</button>
      </div>
    </footer>
  </main>;
}
