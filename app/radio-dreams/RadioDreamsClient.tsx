"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Cluster =
  | "love_relationships" | "home_belonging" | "travel_exploration"
  | "career_self_realization" | "money_material_security"
  | "freedom_independence" | "creativity_expression" | "education_growth"
  | "family_children" | "health_wellbeing" | "recognition_status"
  | "community_justice" | "experience_pleasure" | "other" | "unknown";

type Media = {
  type: string | null;
  url: string | null;
  preview_url: string | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
};

type Dream = {
  id: string;
  text: string;
  created_at: string | null;
  language: string | null;
  cluster: Cluster;
  state: string | null;
  agency: string | null;
  confidence: number;
  permalink: string;
  media?: Media[];
};

type Feed = {
  source: string;
  date: string;
  timezone: string;
  start: string;
  end: string;
  total: number;
  posts: Dream[];
  cluster_counts: Record<string, number>;
};

const CLUSTERS: Array<{
  id: Cluster;
  label: string;
  icon: string;
  hue: number;
  freq: number;
  wave: OscillatorType;
}> = [
  { id:"love_relationships", label:"ЛЮБОВЬ", icon:"♥", hue:330, freq:392.00, wave:"sine" },
  { id:"home_belonging", label:"ДОМ", icon:"⌂", hue:24, freq:261.63, wave:"triangle" },
  { id:"travel_exploration", label:"ПУТЕШЕСТВИЯ", icon:"✈", hue:192, freq:523.25, wave:"sine" },
  { id:"money_material_security", label:"ДЕНЬГИ", icon:"$", hue:135, freq:329.63, wave:"square" },
  { id:"career_self_realization", label:"УСПЕХ", icon:"★", hue:54, freq:440.00, wave:"triangle" },
  { id:"family_children", label:"СЕМЬЯ", icon:"◉", hue:6, freq:349.23, wave:"sine" },
  { id:"creativity_expression", label:"ТВОРЧЕСТВО", icon:"✎", hue:286, freq:587.33, wave:"triangle" },
  { id:"health_wellbeing", label:"ЗДОРОВЬЕ", icon:"✚", hue:164, freq:293.66, wave:"sine" },
  { id:"education_growth", label:"ОБРАЗОВАНИЕ", icon:"⌑", hue:205, freq:659.25, wave:"triangle" },
  { id:"freedom_independence", label:"СВОБОДА", icon:"◎", hue:248, freq:493.88, wave:"sine" },
  { id:"recognition_status", label:"ПРИЗНАНИЕ", icon:"✦", hue:42, freq:698.46, wave:"triangle" },
  { id:"community_justice", label:"МИР", icon:"☮", hue:110, freq:220.00, wave:"sine" },
  { id:"experience_pleasure", label:"ВПЕЧАТЛЕНИЯ", icon:"☼", hue:310, freq:783.99, wave:"sine" },
];

function cleanText(text:string){
  return text.replace(/https?:\/\/\S+/g,"").replace(/\s+/g," ").trim();
}

function formatTime(value:string|null){
  if(!value) return "";
  try{
    return new Intl.DateTimeFormat("ru-RU",{hour:"2-digit",minute:"2-digit"}).format(new Date(value));
  }catch{return ""}
}

export default function RadioDreamsClient({initialFeed}:{initialFeed:Feed}){
  const initialCorpus=initialFeed.posts.filter(d=>CLUSTERS.some(c=>c.id===d.cluster));
  const [counts,setCounts]=useState<Record<string,number>>({});
  const [current,setCurrent]=useState<Dream|null>(initialCorpus[0]||null);
  const [connected,setConnected]=useState(initialCorpus.length>0);
  const [audioOn,setAudioOn]=useState(false);
  const [status,setStatus]=useState(initialCorpus.length ? `СУТОЧНЫЙ ЭФИР / X · ${initialCorpus.length} МЕЧТ` : "НЕТ ДАННЫХ");
  const [dayLabel,setDayLabel]=useState<string|null>(initialFeed.date||null);
  const [corpus,setCorpus]=useState<Dream[]>(initialCorpus);
  const [played,setPlayed]=useState(initialCorpus.length?1:0);

  const audioCtx=useRef<AudioContext|null>(null);
  const playbackTimer=useRef<number|null>(null);
  const config=useMemo(()=>new Map(CLUSTERS.map(c=>[c.id,c])),[]);

  function playClusterSound(cluster:Cluster){
    if(!audioOn) return;
    const cfg=config.get(cluster);
    if(!cfg) return;
    const AC=window.AudioContext || (window as any).webkitAudioContext;
    const ctx=audioCtx.current || new AC();
    audioCtx.current=ctx;
    if(ctx.state==="suspended") void ctx.resume();

    const now=ctx.currentTime;
    const out=ctx.createGain();
    const filter=ctx.createBiquadFilter();
    out.gain.setValueAtTime(.0001,now);
    out.gain.exponentialRampToValueAtTime(.075,now+.018);
    out.gain.exponentialRampToValueAtTime(.0001,now+.42);
    filter.type="lowpass";
    filter.frequency.setValueAtTime(2400,now);

    const o1=ctx.createOscillator();
    const o2=ctx.createOscillator();
    o1.type=cfg.wave;
    o2.type="sine";
    o1.frequency.setValueAtTime(cfg.freq,now);
    o2.frequency.setValueAtTime(cfg.freq*1.5,now);
    o2.detune.setValueAtTime(4,now);

    const g2=ctx.createGain();
    g2.gain.setValueAtTime(.18,now);

    o1.connect(filter);
    o2.connect(g2).connect(filter);
    filter.connect(out).connect(ctx.destination);

    o1.start(now); o2.start(now);
    o1.stop(now+.44); o2.stop(now+.44);
  }

  useEffect(()=>{
    if(!corpus.length) return;

    let index=0;
    setCounts({});
    setPlayed(0);

    const emit=()=>{
      const dream=corpus[index];
      setCurrent(dream);
      setCounts(prev=>({
        ...prev,
        [dream.cluster]:(prev[dream.cluster]||0)+1
      }));
      setPlayed(index+1);
      playClusterSound(dream.cluster);

      index+=1;
      if(index>=corpus.length){
        if(playbackTimer.current) window.clearInterval(playbackTimer.current);
        playbackTimer.current=null;
      }
    };

    emit();
    playbackTimer.current=window.setInterval(emit,6200);

    return ()=>{
      if(playbackTimer.current) window.clearInterval(playbackTimer.current);
    };
  },[corpus,audioOn]);

  const maxCount=Math.max(1,...CLUSTERS.map(c=>counts[c.id]||0));
  const leader=CLUSTERS.reduce((best,c)=>(counts[c.id]||0)>(counts[best.id]||0)?c:best,CLUSTERS[0]);
  const currentCfg=current?config.get(current.cluster):null;
  const currentMedia=current?.media?.find(m=>m.type==="photo"||m.type==="image") || current?.media?.[0];

  return <main className="radioDreams">
    <header className="radioHeader">
      <div>
        <div className="radioKicker">ATLAS OF DESIRES / DAILY BROADCAST</div>
        <h1>РАДИО МЕЧТЫ</h1>
      </div>
      <div className="radioStatus">
        <span className={connected?"liveDot on":"liveDot"} />
        <b>{status}</b>
        {dayLabel && <small>{dayLabel} · {played}/{corpus.length}</small>}
        <button onClick={()=>{
          setAudioOn(v=>!v);
          if(!audioOn){
            const AC=window.AudioContext || (window as any).webkitAudioContext;
            audioCtx.current=audioCtx.current || new AC();
            void audioCtx.current.resume();
          }
        }}>{audioOn?"ЗВУК ON":"ВКЛЮЧИТЬ ЗВУК"}</button>
      </div>
    </header>

    <section className="radioNow">
      <div className="radioWave" aria-hidden="true">
        {Array.from({length:54},(_,i)=><i key={i} style={{height:(8+Math.abs(Math.sin(i*.53))*42)+"px"}} />)}
      </div>

      {current ? <article
        className="radioMessage active"
        style={{"--accent":`hsl(${currentCfg?.hue||190} 100% 62%)`} as React.CSSProperties}
      >
        {currentMedia?.url && <div className="radioMedia">
          <img src={currentMedia.url} alt={currentMedia.alt_text || ""} />
        </div>}
        <div className="radioMessageText">
          <div className="radioClusterTag">{currentCfg?.icon} {currentCfg?.label}</div>
          <p>{cleanText(current.text)}</p>
          <div className="radioMessageMeta">
            <span>{formatTime(current.created_at)} · X</span>
            {current.state?.startsWith("fulfilled") && <b>✦ МЕЧТА СБЫЛАСЬ</b>}
          </div>
        </div>
      </article> :
      <div className="radioIdle">{connected ? "в этом выпуске нет распознанных кластеров" : "загружаем мечты из X…"}</div>}
    </section>

    <section className="equalizerWrap">
      <div className="leaderNote">{played}/{corpus.length} В ЭФИРЕ · СЕЙЧАС ЛИДИРУЕТ: <b>{leader.icon} {leader.label}</b></div>
      <div className="dreamEqualizer">
        {CLUSTERS.map(cluster=>{
          const value=counts[cluster.id]||0;
          const level=Math.max(2,Math.round((value/maxCount)*18));
          const isLeader=cluster.id===leader.id;
          return <div className={"eqChannel"+(isLeader?" leader":"")} key={cluster.id}>
            <div className="eqStack" title={cluster.label+" — "+value}>
              {Array.from({length:18},(_,i)=>{
                const on=i<level;
                return <span
                  key={i}
                  className={on?"on":""}
                  style={on?{
                    background:`hsl(${cluster.hue} 100% ${58+Math.min(i,8)*1.6}%)`,
                    boxShadow:`0 0 12px hsl(${cluster.hue} 100% 58% / .55)`
                  }:undefined}
                />
              }).reverse()}
            </div>
            <div className="eqIcon" style={{color:`hsl(${cluster.hue} 100% 70%)`}}>{cluster.icon}</div>
            <div className="eqLabel">{cluster.label}</div>
            <div className="eqCount">{value}</div>
          </div>;
        })}
      </div>
    </section>

    <footer className="radioFooter">
      <span>REAL X POSTS · LAST 24 HOURS · EUROPE/LONDON</span>
      <span>сообщение появляется → попадает в кластер → столбик растёт → звучит его нота</span>
    </footer>
  </main>;
}
