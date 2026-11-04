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

      const hit:Array<{x:number;y:number;r:number;d:Desire}>=[];
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

      const labelBoxes:Array<{x:number;y:number;w:number;h:number}>=[];
      const labelCandidates=(hit as any[])
        .filter(h=>h.isSel || h.z>.82)
        .sort((a,b)=>Number(b.isSel)-Number(a.isSel) || b.z-a.z)
        .slice(0,12);

      for(const h of labelCandidates){
        const clean=h.d.text.replace(/https?:\/\/\S+/g,"").replace(/\s+/g," ").trim();
        const maxChars=h.isSel?110:52;
        const text=clean.slice(0,maxChars)+(clean.length>maxChars?"…":"");
        const fontSize=h.isSel?18:Math.max(11,12*h.scale);
        ctx.font=`${fontSize}px Georgia,serif`;
        const metrics=ctx.measureText(text);
        const padX=10,padY=7;
        const bw=Math.min(metrics.width+padX*2,w*.42);
        const bh=fontSize+padY*2;
        let bx=h.x+h.r*2.6;
        let by=h.y-bh/2;

        if(bx+bw>w-18) bx=h.x-h.r*2.6-bw;
        by=Math.max(18,Math.min(h-bh-18,by));

        let guard=0;
        while(labelBoxes.some(b=>!(bx+bw<b.x || bx>b.x+b.w || by+bh<b.y || by>b.y+b.h)) && guard<12){
          by+=bh+6;
          if(by+bh>h-18){by=18+guard*5;bx=Math.max(18,bx-bw*.18)}
          guard++;
        }

        const overlaps=labelBoxes.some(b=>!(bx+bw<b.x || bx>b.x+b.w || by+bh<b.y || by>b.y+b.h));
        if(overlaps && !h.isSel) continue;

        ctx.fillStyle=h.isSel?"rgba(5,7,6,.94)":"rgba(5,7,6,.78)";
        ctx.fillRect(bx,by,bw,bh);
        ctx.strokeStyle=h.isSel?"rgba(203,216,165,.55)":"rgba(231,228,218,.12)";
        ctx.strokeRect(bx+.5,by+.5,bw-1,bh-1);
        ctx.fillStyle=h.isSel?"rgba(246,246,238,.97)":"rgba(231,228,218,.82)";
        ctx.textBaseline="middle";
        ctx.fillText(text,bx+padX,by+bh/2);
        ctx.textBaseline="alphabetic";
        labelBoxes.push({x:bx,y:by,w:bw,h:bh});
      }

      (canvas as any).__hits=hit;
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);

    const onClick=(e:MouseEvent)=>{
      const rect=canvas.getBoundingClientRect();
      const x=e.clientX-rect.left,y=e.clientY-rect.top;
      const hits=(canvas as any).__hits||[];
      let best:any=null,bestD=Infinity;
      for(const h of hits){
        const d=Math.hypot(x-h.x,y-h.y);
        if(d<h.r*2.1&&d<bestD){best=h;bestD=d}
      }
      if(best)setSelected(best.d);
    };
    canvas.addEventListener("click",onClick);
    return ()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);canvas.removeEventListener("click",onClick)};
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
      <div className="protoHint">CLICK A DESIRE · FOLLOW ITS PATH</div>

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
