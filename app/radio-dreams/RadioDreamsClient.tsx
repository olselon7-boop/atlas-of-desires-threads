"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RADIO_TUNE_SRC } from "./radioTune";

type Cluster = string;

type Media = {
  type: string | null;
  url: string | null;
  preview_url: string | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  duration_ms?: number | null;
  video_url?: string | null;
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

function ClusterIcon({id,size=20}:{id:Cluster;size?:number}){
  const common={fill:"none",stroke:"currentColor",strokeWidth:1.7,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
  const paths:Record<string,React.ReactNode>={
    love_relationships:<><path {...common} d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z"/></>,
    home_belonging:<><path {...common} d="M4 11 12 4l8 7"/><path {...common} d="M6.5 10.5V20h11v-9.5M10 20v-5h4v5"/></>,
    travel_exploration:<><path {...common} d="m3 13 18-7-6.5 15-2.3-6.2L6 12.5 3 13Z"/><path {...common} d="m12.2 14.8 3.6-3.6"/></>,
    money_material_security:<><rect {...common} x="4" y="6" width="16" height="12" rx="2"/><path {...common} d="M7 10h10M7 14h6"/><circle {...common} cx="16.5" cy="14" r="1.5"/></>,
    career_self_realization:<><path {...common} d="M12 3 14 8l5 .5-3.8 3.3 1.2 5.2L12 14.2 7.6 17l1.2-5.2L5 8.5 10 8l2-5Z"/></>,
    family_children:<><circle {...common} cx="9" cy="9" r="3"/><circle {...common} cx="16.5" cy="10" r="2.4"/><path {...common} d="M4 20c.5-4 2.2-6 5-6s4.5 2 5 6M14 15.3c2.8-.6 5 .7 6 3.7"/></>,
    creativity_expression:<><path {...common} d="m5 19 3.3-.7L18.5 8.1 15.9 5.5 5.7 15.7 5 19Z"/><path {...common} d="m14.8 6.6 2.6 2.6"/><path {...common} d="M5 5h4M7 3v4"/></>,
    health_wellbeing:<><path {...common} d="M12 4v16M4 12h16"/><path {...common} d="M7 6.5c1.3-1.6 3-2.5 5-2.5s3.7.9 5 2.5"/></>,
    education_growth:<><path {...common} d="m3 9 9-5 9 5-9 5-9-5Z"/><path {...common} d="M7 12v4.5c3 2 7 2 10 0V12M21 9v6"/></>,
    freedom_independence:<><path {...common} d="M4 15c3.5 0 5.5-2 8-6 2.5 4 4.5 6 8 6"/><path {...common} d="M6 18c2.3 0 4-.9 6-3 2 2.1 3.7 3 6 3"/><path {...common} d="M12 5v10"/></>,
    recognition_status:<><circle {...common} cx="12" cy="9" r="4"/><path {...common} d="m9.5 12.2-2 7 4.5-2 4.5 2-2-7"/><path {...common} d="m10.5 9 1 1 2-2"/></>,
    community_justice:<><circle {...common} cx="12" cy="12" r="8"/><path {...common} d="M12 4v16M4 12h16"/><path {...common} d="M7 7c2 1.5 3.5 3 5 5s3 3.5 5 5"/></>,
    experience_pleasure:<><circle {...common} cx="12" cy="12" r="3.5"/><path {...common} d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></>,
    [intimateClusterId]:<><circle {...common} cx="8.5" cy="12" r="4"/><circle {...common} cx="15.5" cy="12" r="4"/><path {...common} d="M12 8.5v7"/></>
  };
  return <svg className="clusterGlyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[id]||paths.experience_pleasure}</svg>;
}

const CLUSTERS: Array<{
  id: Cluster;
  label: string;
  hue: number;
  freq: number;
  wave: OscillatorType;
}> = [
  { id:"love_relationships", label:"ЛЮБОВЬ", hue:330, freq:392.00, wave:"sine" },
  { id:"home_belonging", label:"ДОМ", hue:24, freq:261.63, wave:"triangle" },
  { id:"travel_exploration", label:"ПУТЕШЕСТВИЯ", hue:192, freq:523.25, wave:"sine" },
  { id:"money_material_security", label:"ДЕНЬГИ", hue:135, freq:329.63, wave:"square" },
  { id:"career_self_realization", label:"УСПЕХ", hue:54, freq:440.00, wave:"triangle" },
  { id:"family_children", label:"СЕМЬЯ", hue:6, freq:349.23, wave:"sine" },
  { id:"creativity_expression", label:"ТВОРЧЕСТВО", hue:286, freq:587.33, wave:"triangle" },
  { id:"health_wellbeing", label:"ЗДОРОВЬЕ", hue:164, freq:293.66, wave:"sine" },
  { id:"education_growth", label:"ОБРАЗОВАНИЕ", hue:205, freq:659.25, wave:"triangle" },
  { id:"freedom_independence", label:"СВОБОДА", hue:248, freq:493.88, wave:"sine" },
  { id:"recognition_status", label:"ПРИЗНАНИЕ", hue:42, freq:698.46, wave:"triangle" },
  { id:"community_justice", label:"МИР", hue:110, freq:220.00, wave:"sine" },
  { id:"experience_pleasure", label:"ВПЕЧАТЛЕНИЯ", hue:310, freq:783.99, wave:"sine" },
  { id:intimateClusterId, label:intimateClusterLabel, hue:352, freq:246.94, wave:"sawtooth" },
];

function cleanText(text:string){
  return text.replace(/https?:\/\/\S+/g,"").replace(/\s+/g," ").trim();
}

function dedupeKey(text:string){
  return cleanText(text)
    .toLowerCase()
    .replace(/@[a-z0-9_]+/gi,"")
    .replace(/#[a-zа-яё0-9_]+/giu,"")
    .replace(/\b(?:rt|via)\b/gi,"")
    .replace(/[^a-zа-яё0-9]+/giu," ")
    .replace(/\s+/g," ")
    .trim();
}

function tokenSet(text:string){
  return new Set(dedupeKey(text).split(" ").filter(w=>w.length>2));
}

function nearDuplicate(a:string,b:string){
  const ka=dedupeKey(a), kb=dedupeKey(b);
  if(!ka || !kb) return false;
  if(ka===kb) return true;
  if((ka.length>24 && kb.includes(ka)) || (kb.length>24 && ka.includes(kb))) return true;

  const A=tokenSet(a), B=tokenSet(b);
  if(!A.size || !B.size) return false;
  let common=0;
  for(const t of A) if(B.has(t)) common++;
  const union=A.size+B.size-common;
  const jaccard=union?common/union:0;
  const containment=common/Math.min(A.size,B.size);
  return jaccard>=0.72 || (Math.min(A.size,B.size)>=5 && containment>=0.86);
}

function dedupeDreams(dreams:Dream[]){
  const kept:Dream[]=[];
  for(const dream of dreams){
    if(!kept.some(prev=>nearDuplicate(prev.text,dream.text))) kept.push(dream);
  }
  return kept;
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
  const initialCorpus=dedupeDreams(
    initialFeed.posts.filter(d=>CLUSTERS.some(c=>c.id===d.cluster))
  ).slice(-24);
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
  const radioTuneAudio=useRef<HTMLAudioElement|null>(null);
  const audioOnRef=useRef(false);
  const playbackTimer=useRef<number|null>(null);
  const pollTimer=useRef<number|null>(null);
  const queueRef=useRef<Dream[]>([...initialCorpus]);
  const playingRef=useRef(false);
  const seenIdsRef=useRef<Set<string>>(new Set(initialCorpus.map(d=>d.id)));
  const seenTextRef=useRef<Set<string>>(new Set(initialCorpus.map(d=>dedupeKey(d.text)).filter(Boolean)));
  const seenSamplesRef=useRef<string[]>(initialCorpus.map(d=>d.text));
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

    if(audioOn){
      const tune=radioTuneAudio.current || new Audio(RADIO_TUNE_SRC);
      radioTuneAudio.current=tune;
      tune.loop=true;
      tune.volume=.22;
      void tune.play().catch(()=>{});
    }else if(radioTuneAudio.current){
      radioTuneAudio.current.pause();
    }
  },[audioOn]);

  useEffect(()=>{
    let stopped=false;

    const playNext=()=>{
      if(stopped || playingRef.current) return;
      queueRef.current=dedupeDreams(queueRef.current);
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
          if(seenSamplesRef.current.some(text=>nearDuplicate(text,d.text))) return false;

          seenIdsRef.current.add(d.id);
          if(key) seenTextRef.current.add(key);
          seenSamplesRef.current.push(d.text);
          if(seenSamplesRef.current.length>500) seenSamplesRef.current.shift();
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
        <div className="radioKicker">ATLAS OF DESIRES / LIVE X</div>
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
      {current ? <a
        key={dropTick}
        className="radioMessage active radioMessageDrop radioMessageLink"
        style={{"--accent":`hsl(${currentCfg?.hue||190} 100% 62%)`} as React.CSSProperties}
        href={current.permalink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Открыть оригинальный пост в X"
      >
        {(currentMedia?.video_url || currentMedia?.url || currentMedia?.preview_url) && <div className="radioMedia">
          {currentMedia.video_url
            ? <video
                src={currentMedia.video_url}
                poster={currentMedia.preview_url || currentMedia.url || undefined}
                autoPlay
                muted
                loop
                playsInline
              />
            : <img src={currentMedia.url || currentMedia.preview_url || ""} alt={currentMedia.alt_text || ""} />}
        </div>}
        <div className="radioMessageText">
          <div className="radioClusterTag"><ClusterIcon id={current.cluster} size={15}/> {currentCfg?.label}</div>
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
      <div className="leaderNote">{played} В ЭФИРЕ · <b><ClusterIcon id={leader.id} size={14}/> {leader.label}</b></div>
      <div className="dreamEqualizer">
        {CLUSTERS.map(cluster=>{
          const value=counts[cluster.id]||0;
          const isLeader=cluster.id===leader.id;
          const isActive=activeCluster===cluster.id;
          return <div className={"eqChannel"+(isLeader?" leader":"")+(isActive?" receiving":"")} key={isActive ? cluster.id+"-"+dropTick : cluster.id}>
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
            <div className="eqIcon" style={{color:`hsl(${cluster.hue} 100% 70%)`}}><ClusterIcon id={cluster.id} size={20}/></div>
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
