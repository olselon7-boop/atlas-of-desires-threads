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

export default function PrototypePage(){
  const [desires,setDesires]=useState<Desire[]>([]);
  const [selected,setSelected]=useState<Desire|null>(null);
  const [hovered,setHovered]=useState<Desire|null>(null);
  const [paused,setPaused]=useState(false);
  const [speed,setSpeed]=useState(1);
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
        const z=((k/9)+t*.035)%1;
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
        const x=cx+Math.sin(p*8+t*.55)*w*.035*(.2+p);
        ctx.lineTo(x,y);
      }
      ctx.stroke();

      const hit:Array<{x:number;y:number;r:number;d:Desire;z:number;scale:number;isSel:boolean}>=[];
      const sorted=[...nodes].sort((a,b)=>a.offset-b.offset);
      for(const n of sorted){
        let z=(n.offset+t*.055+n.drift)%1;
        if(z<0)z+=1;
        const depth=z*z;
        const scale=.22+depth*1.75;
        const x=cx+n.lane*w*.18*scale+Math.sin(t*.6+n.phase)*12*scale;
        const y=horizon+(z-.18)*h*.48;
        const r=n.size*scale;
        const isSel=selected?.id===n.d.id;
        ctx.beginPath();
        ctx.arc(x,y,isSel?r*2.4:r,0,Math.PI*2);
        ctx.fillStyle=isSel?"rgba(240,244,226,.96)":n.d.has_media?"rgba(203,216,165,.78)":"rgba(225,226,216,.58)";
        ctx.fill();

        hit.push({x,y,r:Math.max(8,r*2),d:n.d,z,scale,isSel});
      }

      const ambientLabels=(hit as any[])
        .filter(x=>!selected || x.d.id!==selected.id)
        .filter(x=>x.z>.76)
        .sort((a,b)=>b.z-a.z)
        .slice(0,7);

      const boxes:Array<{x:number;y:number;w:number;h:number}>=[];

      for(const lh of ambientLabels){
        const clean=lh.d.text.replace(/https?:\/\/\S+/g,"").replace(/\s+/g," ").trim();
        if(!clean) continue;
        const maxChars=lh.z>.9?58:42;
        const txt=clean.slice(0,maxChars)+(clean.length>maxChars?"…":"");
        const fs=lh.z>.9?18:14;
        ctx.font=`${fs}px Georgia,serif`;
        const m=ctx.measureText(txt);
        const bw=Math.min(m.width,w*.34);
        const bh=fs+6;
        let bx=lh.x+lh.r*2.3;
        let by=lh.y-bh/2;
        if(bx+bw>w-18) bx=lh.x-lh.r*2.3-bw;
        by=Math.max(18,Math.min(h-bh-18,by));

        let attempts=0;
        while(boxes.some(b=>!(bx+bw<b.x || bx>b.x+b.w || by+bh<b.y || by>b.y+b.h)) && attempts<10){
          by+=bh+8;
          if(by+bh>h-18) by=Math.max(18,lh.y-(attempts+1)*(bh+8));
          attempts++;
        }
        if(boxes.some(b=>!(bx+bw<b.x || bx>b.x+b.w || by+bh<b.y || by>b.y+b.h))) continue;

        const alpha=.28+lh.z*.52;
        ctx.fillStyle=`rgba(231,228,218,${alpha.toFixed(2)})`;
        ctx.textBaseline="middle";
        ctx.fillText(txt,bx,by+bh/2);
        ctx.textBaseline="alphabetic";
        boxes.push({x:bx,y:by,w:bw,h:bh});
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
      <div className="protoHint">HOVER TO READ · CLICK TO FOLLOW</div>

      {hovered && !selected && <div className="hoverDream">
        <span>{LABELS[hovered.deep_desire||"unknown"]||hovered.deep_desire||"UNKNOWN"}</span>
        <p>{hovered.text}</p>
      </div>}

      {selected && <aside className="dreamCard">
        <button onClick={()=>setSelected(null)} aria-label="close">×</button>
        <div className="dreamTag">{LABELS[selected.deep_desire||"unknown"]||selected.deep_desire||"UNKNOWN"}</div>
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
        <span><i className="dot textDot"></i>TEXT</span>
        <span><i className="dot mediaDot"></i>IMAGE ATTACHED</span>
        <span>SPACE = SEMANTIC PROXIMITY / PROTOTYPE</span>
      </div>
      <div className="protoButtons">
        <button onClick={()=>setPaused(v=>!v)}>{paused?"PLAY":"PAUSE"}</button>
        <button onClick={()=>setSpeed(v=>v>=2?.5:v+.5)}>SPEED {speed.toFixed(1)}×</button>
      </div>
    </footer>
  </main>;
}
