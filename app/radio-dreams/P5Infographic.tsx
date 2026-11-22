"use client";

import { useEffect, useRef } from "react";

type P5Cluster = {
  id: string;
  hue: number;
  label: string;
};

declare global {
  interface Window {
    p5?: any;
    __radioDreamsP5Loading?: Promise<void>;
  }
}

function ensureP5(){
  if(typeof window==="undefined") return Promise.resolve();
  if(window.p5) return Promise.resolve();
  if(window.__radioDreamsP5Loading) return window.__radioDreamsP5Loading;

  window.__radioDreamsP5Loading=new Promise<void>((resolve,reject)=>{
    const existing=document.querySelector('script[data-radio-p5="1"]') as HTMLScriptElement|null;
    if(existing){
      existing.addEventListener("load",()=>resolve(),{once:true});
      existing.addEventListener("error",()=>reject(new Error("p5 load failed")),{once:true});
      return;
    }
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/p5@1.11.1/lib/p5.min.js";
    s.async=true;
    s.dataset.radioP5="1";
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error("p5 load failed"));
    document.head.appendChild(s);
  });

  return window.__radioDreamsP5Loading;
}

export default function P5Infographic({
  clusters,
  counts,
  activeCluster,
  pulseTick
}:{
  clusters:P5Cluster[];
  counts:Record<string,number>;
  activeCluster:string|null;
  pulseTick:number;
}){
  const hostRef=useRef<HTMLDivElement|null>(null);
  const stateRef=useRef({clusters,counts,activeCluster,pulseTick});
  const sketchRef=useRef<any>(null);

  stateRef.current={clusters,counts,activeCluster,pulseTick};

  useEffect(()=>{
    let cancelled=false;

    void ensureP5().then(()=>{
      if(cancelled || !hostRef.current || !window.p5) return;

      sketchRef.current=new window.p5((p:any)=>{
        let pulseStart=-9999;
        let lastTick=stateRef.current.pulseTick;

        const resize=()=>{
          const w=Math.max(320,hostRef.current?.clientWidth||960);
          const h=w<760?290:330;
          p.resizeCanvas(w,h);
        };

        p.setup=()=>{
          const w=Math.max(320,hostRef.current?.clientWidth||960);
          const h=w<760?290:330;
          const canvas=p.createCanvas(w,h);
          canvas.parent(hostRef.current);
          p.pixelDensity(Math.min(window.devicePixelRatio||1,2));
          p.colorMode(p.HSL,360,100,100,1);
          p.noFill();
        };

        p.windowResized=resize;

        p.draw=()=>{
          const st=stateRef.current;
          if(st.pulseTick!==lastTick){
            lastTick=st.pulseTick;
            pulseStart=p.millis();
          }

          p.clear();

          const w=p.width;
          const h=p.height;
          const left=w<760?10:18;
          const right=w<760?10:18;
          const top=18;
          const baseline=h-82;
          const laneW=(w-left-right)/st.clusters.length;

          // Horizontal technical grid.
          p.stroke(0,0,100,.09);
          p.strokeWeight(1);
          for(let y=top;y<=baseline;y+=18){
            p.line(left,y,w-right,y);
          }

          // Thin major guide lines.
          p.stroke(0,0,100,.16);
          for(let y=top;y<=baseline;y+=72){
            p.line(left,y,w-right,y);
          }

          // Deterministic auxiliary signal traces like the references.
          for(let r=0;r<5;r++){
            const yy=top+28+r*45;
            p.beginShape();
            p.stroke(190+r*32,78,62,.18);
            p.strokeWeight(.8);
            for(let x=left;x<=w-right;x+=10){
              const nx=x*.014+r*23;
              const y=yy+p.noise(nx)*10-5;
              p.vertex(x,y);
            }
            p.endShape();
          }

          st.clusters.forEach((cluster,i)=>{
            const cx=left+laneW*(i+.5);
            const value=Math.max(0,st.counts[cluster.id]||0);
            const active=cluster.id===st.activeCluster;

            p.stroke(cluster.hue,72,66,.20);
            p.strokeWeight(.75);
            p.line(cx,top,cx,baseline+8);

            // Single compact infographic row: glyph + label + count.
            const gy=baseline+20;
            p.stroke(cluster.hue,78,68,active?.92:.58);
            p.strokeWeight(active?1.25:1);
            p.circle(cx,gy,9);
            p.circle(cx,gy,2.6);
            if(i%3===0){
              p.arc(cx,gy,18,18,p.PI*.15,p.PI*1.35);
            }else if(i%3===1){
              p.line(cx-8,gy,cx+8,gy);
              p.circle(cx-8,gy,2.2);
              p.circle(cx+8,gy,2.2);
            }else{
              p.line(cx,gy-8,cx,gy+8);
              p.line(cx-5.5,gy+5,cx+5.5,gy-5);
            }

            p.noStroke();
            p.fill(0,0,100,active?.92:.62);
            p.textAlign(p.CENTER,p.CENTER);
            p.textSize(w<760?5.6:6.8);
            p.text(cluster.label,cx,baseline+42);
            p.fill(cluster.hue,78,72,active?1:.72);
            p.textSize(w<760?8:10);
            p.text(String(value),cx,baseline+59);
            p.noFill();

            // One literal dream = one signal strip.
            const step=7;
            const maxVisible=Math.floor((baseline-top-12)/step);
            const visible=Math.min(value,maxVisible);
            for(let n=0;n<visible;n++){
              const y=baseline-n*step;
              const len=Math.max(8,laneW*.55);
              const glow=n===visible-1 && active ? .9 : .45;
              p.stroke(cluster.hue,92,62,glow);
              p.strokeWeight(n===visible-1 && active?2:1);
              p.line(cx-len*.42,y,cx+len*.42,y);
              p.point(cx-len*.5,y);
              p.point(cx+len*.5,y);
            }

            // Small data tick even at zero so lane remains visible, without inventing count strips.
            p.stroke(cluster.hue,70,64,.28);
            p.strokeWeight(.75);
            p.line(cx-laneW*.16,baseline+8,cx+laneW*.16,baseline+8);

            // Arrival transient: tall spike, expanding rings, angled trace.
            if(active){
              const age=(p.millis()-pulseStart)/950;
              if(age>=0 && age<=1.25){
                const k=Math.max(0,1-age/1.25);
                const ease=1-Math.pow(Math.min(age,1),3);
                const spikeH=(110+Math.min(value,18)*4)*ease;
                const topY=baseline-spikeH;

                p.stroke(cluster.hue,100,64,.88*k);
                p.strokeWeight(1.6);
                p.line(cx,baseline, cx,topY);

                p.stroke(cluster.hue,100,72,.54*k);
                p.strokeWeight(.9);
                p.line(cx-9,baseline-10,cx+7,topY+10);
                p.line(cx+7,topY+10,cx+laneW*.28,topY+4);

                p.noFill();
                p.stroke(cluster.hue,100,68,.46*k);
                p.circle(cx,topY,18+42*age);
                p.circle(cx,topY,6+18*age);

                p.stroke(cluster.hue,100,76,.85*k);
                p.strokeWeight(2.4);
                p.point(cx,topY);
              }
            }
          });

          // Bottom ruler and end points.
          p.stroke(0,0,100,.24);
          p.strokeWeight(1);
          p.line(left,baseline+8,w-right,baseline+8);
          for(let x=left;x<=w-right;x+=22){
            p.stroke(0,0,100,.15);
            p.line(x,baseline+5,x,baseline+11);
          }
        };
      });
    }).catch(()=>{});

    return ()=>{
      cancelled=true;
      if(sketchRef.current){
        sketchRef.current.remove();
        sketchRef.current=null;
      }
    };
  },[]);

  return <div className="p5Infographic" ref={hostRef} aria-hidden="true"/>;
}
