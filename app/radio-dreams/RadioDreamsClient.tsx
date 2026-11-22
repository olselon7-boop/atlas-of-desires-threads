"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RADIO_TUNE_SRC } from "./radioTune";
import P5Infographic from "./P5Infographic";

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

function ClusterIcon({id,size=24}:{id:Cluster;size?:number}){
  const line={fill:"none",stroke:"currentColor",strokeWidth:1.35,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
  const dot=(cx:number,cy:number,r=.95)=><circle cx={cx} cy={cy} r={r} fill="currentColor"/>;
  const glyphs:Record<string,React.ReactNode>={
    love_relationships:<>
      <circle {...line} cx="9" cy="12" r="4.2"/><circle {...line} cx="15" cy="12" r="4.2"/>
      {dot(12,12,.8)}<path {...line} d="M4 18h16"/>
    </>,
    home_belonging:<>
      <path {...line} d="M4 17h16M6 14h12M8 11h8M10 8h4"/>
      {dot(12,5,1.15)}
    </>,
    travel_exploration:<>
      <path {...line} d="M4 17 9 12l4 2 7-8"/>
      {dot(4,17)}{dot(9,12)}{dot(13,14)}{dot(20,6)}
      <path {...line} d="M17.5 6H20v2.5"/>
    </>,
    money_material_security:<>
      <path {...line} d="M5 17h14M5 13h10M5 9h7M5 5h4"/>
      {dot(19,17)}{dot(15,13)}{dot(12,9)}{dot(9,5)}
    </>,
    career_self_realization:<>
      <circle {...line} cx="12" cy="12" r="6.8"/>
      <path {...line} d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3"/>
      {dot(12,12,1.35)}
    </>,
    family_children:<>
      <path {...line} d="M6 17 10 11l4 3 4-7"/>
      {dot(6,17,1.35)}{dot(10,11,1.35)}{dot(14,14,1.35)}{dot(18,7,1.35)}
    </>,
    creativity_expression:<>
      <path {...line} d="M4 16c3-8 6 4 9-4s5-3 7-6"/>
      <path {...line} d="M4 19h16"/>
      {dot(4,16)}{dot(13,12)}{dot(20,6)}
    </>,
    health_wellbeing:<>
      <circle {...line} cx="12" cy="12" r="7"/>
      <path {...line} d="M12 7v10M7 12h10"/>
      <path {...line} d="M4.5 6.5h3M16.5 17.5h3"/>
    </>,
    education_growth:<>
      <path {...line} d="M5 17h14M7 14h10M9 11h6M11 8h2"/>
      {dot(12,5,1.2)}
      <path {...line} d="M4 19.5h16"/>
    </>,
    freedom_independence:<>
      <path {...line} d="M18 7a7 7 0 1 0 1 8"/>
      <path {...line} d="M16 5h4v4"/>
      {dot(12,12,1)}
    </>,
    recognition_status:<>
      <circle {...line} cx="12" cy="12" r="3.2"/>
      <circle {...line} cx="12" cy="12" r="7"/>
      <path {...line} d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
    </>,
    community_justice:<>
      <path {...line} d="M4 12h16M12 4v16"/>
      <circle {...line} cx="12" cy="12" r="7"/>
      {dot(12,12,1.1)}
    </>,
    experience_pleasure:<>
      <circle {...line} cx="12" cy="12" r="2.6"/>
      <path {...line} d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8"/>
    </>,
    [intimateClusterId]:<>
      <circle {...line} cx="9" cy="12" r="4.5"/><circle {...line} cx="15" cy="12" r="4.5"/>
      <path {...line} d="M12 6v12"/>{dot(12,12,1)}
    </>,
    other:<>
      <circle {...line} cx="12" cy="12" r="6.5"/>
      {dot(8,12,1.1)}{dot(12,8,1.1)}{dot(16,12,1.1)}{dot(12,16,1.1)}
      <path {...line} d="M8 12h8M12 8v8"/>
    </>
  };
  return <svg className="clusterGlyph" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{glyphs[id]||glyphs.experience_pleasure}</svg>;
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
  { id:"other", label:"ДРУГОЕ", hue:210, freq:311.13, wave:"triangle" },
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
  const wordsPerMinute=220;
  const estimated=(words/wordsPerMinute)*60_000;
  return Math.max(3_200,Math.min(8_000,estimated+900));
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
  const hydratedRef=useRef(false);
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

      if(!hydratedRef.current){
        // Initial daily backlog: play chronologically.
        queueRef.current.push(...fresh);
        hydratedRef.current=true;
      }else{
        // True live arrivals should be heard next, not after the whole backlog.
        const newestFirst=[...fresh].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
        queueRef.current.unshift(...newestFirst);
      }

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
      <P5Infographic
        clusters={CLUSTERS.map(({id,label,hue})=>({id,label,hue}))}
        counts={counts}
        activeCluster={activeCluster}
        pulseTick={dropTick}
      />
    </section>

    <footer className="radioFooter">
      <span>REAL X POSTS · LIVE RECENT SEARCH</span>
      <span>ATLAS OF DESIRES / RADIO DREAMS</span>
    </footer>
  </main>;
}
