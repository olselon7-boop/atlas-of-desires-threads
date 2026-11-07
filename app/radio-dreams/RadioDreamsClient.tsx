"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Cluster = string;

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

const intimateClusterId = String.fromCharCode(115,101,120,95,105,110,116,105,109,97,99,121);
const intimateClusterLabel = String.fromCharCode(1057,1045,1050,1057);

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
  { id:intimateClusterId, label:intimateClusterLabel, icon:"●", hue:352, freq:246.94, wave:"sawtooth" },
];

function cleanText(text:string){
  return text.replace(/https?:\/\/\S+/g,"").replace(/\s+/g," ").trim();
}

function dedupeKey(text:string){
  return cleanText(text)
    .toLowerCase()
    .replace(/@[a-z0-9_]+/gi,"")
    .replace(/[^a-zа-яё0-9]+/giu," ")
    .replace(/\s+/g," ")
    .trim();
}

function formatTime(value:string|null){
  if(!value) return "";
  try{
    return new Intl.DateTimeFormat("ru-RU",{hour:"2-digit",minute:"2-digit"}).format(new Date(value));
  }catch{return ""}
}

function readingDurationMs(text:string){
  const words=cleanText(text).split(/\s+/).filter(Boolean).length;
  const wordsPerMinute=150;
  const estimated=(words/wordsPerMinute)*60_000;
  return Math.max(5_000,Math.min(18_000,estimated+1_800));
}

export default function RadioDreamsClient({initialFeed}:{initialFeed:Feed}){
  const initialCorpus=initialFeed.posts
    .filter(d=>CLUSTERS.some(c=>c.id===d.cluster))
    .filter((d,i,arr)=>{
      const key=dedupeKey(d.text);
      return !key || arr.findIndex(x=>dedupeKey(x.text)===key)===i;
    })
    .slice(-24);
  const [counts,setCounts]=useState<Record<string,number>>({});
  const [current,setCurrent]=useState<Dream|null>(initialCorpus[0]||null);
  const [connected,setConnected]=useState(false);
  const [audioOn,setAudioOn]=useState(false);
  const [status,setStatus]=useState("ПОДКЛЮЧАЕМСЯ К X…");
  const [played,setPlayed]=useState(0);
  const [activeCluster,setActiveCluster]=useState<Cluster|null>(initialCorpus[0]?.cluster||null);
  const [dropTick,setDropTick]=useState(0);
  const [queueSize,setQueueSize]=useState(initialCorpus.length);
  const [liveSeen,setLiveSeen]=useState(0);

  const audioCtx=useRef<AudioContext|null>(null);
  const audioOnRef=useRef(false);
  const playbackTimer=useRef<number|null>(null);
  const pollTimer=useRef<number|null>(null);
  const queueRef=useRef<Dream[]>([...initialCorpus]);
  const playingRef=useRef(false);
  const seenIdsRef=useRef<Set<string>>(new Set(initialCorpus.map(d=>d.id)));
  const seenTextRef=useRef<Set<string>>(new Set(initialCorpus.map(d=>dedupeKey(d.text)).filter(Boolean)));
  const cursorsRef=useRef<{ru:string|null;en:string|null}>({ru:null,en:null});
  const config=useMemo(()=>new Map(CLUSTERS.map(c=>[c.id,c])),[]);

  function playClusterSound(cluster:Cluster){
    if(!audioOnRef.current) return;
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
    audioOnRef.current=audioOn;
  },[audioOn]);

  useEffect(()=>{
    let stopped=false;

    const playNext=()=>{
      if(stopped || playingRef.current) return;
      const dream=queueRef.current.shift();
      setQueueSize(queueRef.current.length);
      if(!dream) return;

      playingRef.current=true;
      setCurrent(dream);
      setActiveCluster(dream.cluster);
      setDropTick(v=>v+1);
      setCounts(prev=>({
        ...prev,
        [dream.cluster]:(prev[dream.cluster]||0)+1
      }));
      setPlayed(v=>v+1);
      playClusterSound(dream.cluster);

      playbackTimer.current=window.setTimeout(()=>{
        playingRef.current=false;
        playNext();
      },readingDurationMs(dream.text));
    };

    const addDreams=(dreams:Dream[])=>{
      const fresh=dreams
        .filter(d=>CLUSTERS.some(c=>c.id===d.cluster))
        .filter(d=>{
          const key=dedupeKey(d.text);
          if(seenIdsRef.current.has(d.id)) return false;
          if(key && seenTextRef.current.has(key)) return false;
          seenIdsRef.current.add(d.id);
          if(key) seenTextRef.current.add(key);
          return true;
        })
        .sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));

      if(!fresh.length) return;
      queueRef.current.push(...fresh);
      setQueueSize(queueRef.current.length);
      setLiveSeen(v=>v+fresh.length);
      playNext();
    };

    const poll=async()=>{
      try{
        const q=new URLSearchParams();
        if(cursorsRef.current.ru) q.set("since_ru",cursorsRef.current.ru);
        if(cursorsRef.current.en) q.set("since_en",cursorsRef.current.en);
        const response=await fetch("/api/radio-dreams/live"+(q.toString()?"?"+q.toString():""),{
          cache:"no-store"
        });
        if(!response.ok) throw new Error("X "+response.status);
        const feed=await response.json();
        cursorsRef.current={
          ru:feed.cursors?.ru||cursorsRef.current.ru,
          en:feed.cursors?.en||cursorsRef.current.en
        };
        setConnected(true);
        setStatus("LIVE / X");
        addDreams(Array.isArray(feed.posts)?feed.posts:[]);
      }catch{
        setConnected(false);
        setStatus("X: ПЕРЕПОДКЛЮЧЕНИЕ…");
      }
    };

    playNext();
    void poll();
    pollTimer.current=window.setInterval(()=>void poll(),15000);

    return ()=>{
      stopped=true;
      if(playbackTimer.current) window.clearTimeout(playbackTimer.current);
      if(pollTimer.current) window.clearInterval(pollTimer.current);
    };
  },[]);

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
        <small>{liveSeen} НОВЫХ · {queueSize} В ОЧЕРЕДИ</small>
        <button onClick={()=>{
          const next=!audioOn;
          setAudioOn(next);
          audioOnRef.current=next;
          if(next){
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

      {current ? <a
        key={dropTick}
        className="radioMessage active radioMessageDrop radioMessageLink"
        style={{"--accent":`hsl(${currentCfg?.hue||190} 100% 62%)`} as React.CSSProperties}
        href={current.permalink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Открыть оригинальный пост в X"
      >
        {(currentMedia?.url || currentMedia?.preview_url) && <div className="radioMedia">
          <img src={currentMedia.url || currentMedia.preview_url || ""} alt={currentMedia.alt_text || ""} />
        </div>}
        <div className="radioMessageText">
          <div className="radioClusterTag">{currentCfg?.icon} {currentCfg?.label}</div>
          <p>{cleanText(current.text)}</p>
          <div className="radioMessageMeta">
            <span>{formatTime(current.created_at)} · X</span>
            {current.state?.startsWith("fulfilled") && <b>✦ МЕЧТА СБЫЛАСЬ</b>}
          </div>
        </div>
      </a> :
      <div className="radioIdle">{connected ? "в этом выпуске нет распознанных кластеров" : "загружаем мечты из X…"}</div>}
    </section>

    <section className="equalizerWrap">
      <div className="leaderNote">{played} В ЭФИРЕ · <b>{leader.icon} {leader.label}</b></div>
      <div className="dreamEqualizer">
        {CLUSTERS.map(cluster=>{
          const value=counts[cluster.id]||0;
          const isLeader=cluster.id===leader.id;
          const isActive=activeCluster===cluster.id;
          return <div className={"eqChannel"+(isLeader?" leader":"")+(isActive?" receiving":"")} key={cluster.id}>
            <div className="eqStack" title={cluster.label+" — "+value}>
              {Array.from({length:Math.max(1,value)},(_,i)=>{
                const newest=i===value-1;
                return <span
                  key={i}
                  className={"on"+(newest && isActive?" newest":"")}
                  style={{
                    background:`hsl(${cluster.hue} 100% ${58+Math.min(i,8)*1.3}%)`,
                    boxShadow:`0 0 10px hsl(${cluster.hue} 100% 58% / .5)`
                  }}
                />
              })}
            </div>
            <div className="eqIcon" style={{color:`hsl(${cluster.hue} 100% 70%)`}}>{cluster.icon}</div>
            <div className="eqLabel">{cluster.label}</div>
            <div className="eqCount">{value}</div>
          </div>;
        })}
      </div>
    </section>

    <footer className="radioFooter">
      <span>REAL X POSTS · LIVE RECENT SEARCH</span>
      <span>ATLAS OF DESIRES / RADIO DREAMS</span>
    </footer>
  </main>;
}
