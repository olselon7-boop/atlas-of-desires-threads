"use client";
import dynamic from "next/dynamic";
import { useEffect,useMemo,useState } from "react";
import { useResearchCorpus } from "@/components/use-research-corpus";
import { CorpusImport } from "@/components/research-tools";
import { mergeCorpus } from "@/lib/desire";
import { CorpusDataSource,type DesireObject,type AtlasTrajectory } from "@/lib/atlas/data-source";
const Scene=dynamic(()=>import('@/components/atlas-scene'),{ssr:false});
export default function Atlas(){
  const c=useResearchCorpus();const [desires,setDesires]=useState<DesireObject[]>([]),[trajectories,setTrajectories]=useState<AtlasTrajectory[]>([]),[mode,setMode]=useState<'universe'|'time'>('universe'),[selected,setSelected]=useState<DesireObject|null>(null),[zoom,setZoom]=useState(1),[failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false);
  useEffect(()=>{if(!c.ready)return;let active=true;
    async function load(){try{let data:{desires:DesireObject[];trajectories:AtlasTrajectory[]};
      if(c.records.length){const source=new CorpusDataSource(c.records,c.reviews);data={desires:await source.getDesires(),trajectories:await source.getTrajectories()};}
      else {const response=await fetch('/api/atlas/data');if(!response.ok)throw new Error('Не удалось прочитать источник Атласа.');data=await response.json();}
      if(active){setDesires(data.desires);setTrajectories(data.trajectories);setLoaded(true);setSelected(null);}
    }catch(e){if(active){c.setError(e instanceof Error?e.message:'Источник недоступен.');setLoaded(true);}}}
    void load();return()=>{active=false;};
  },[c.ready,c.records,c.reviews,c.setError]);
  const visible=useMemo(()=>mode==='time'?desires.filter(d=>trajectories.some(t=>t.points.some(p=>p.id===d.id))):desires,[mode,desires,trajectories]);
  return <main className="atlas"><header className="atlas-header"><a href="/">АТЛАС ЖЕЛАНИЙ</a><p>ПАМЯТЬ О БУДУЩЕМ <span> / {mode==='time'?'ВРЕМЯ МЕЧТЫ':'ВСЕЛЕННАЯ ЖЕЛАНИЙ'}</span></p><a href="/research">Исследование ↗</a></header>
    <div className="atlas-mode" role="group" aria-label="Художественный режим"><button aria-pressed={mode==='universe'} onClick={()=>{setMode('universe');setSelected(null);}}>UNIVERSE</button><button aria-pressed={mode==='time'} onClick={()=>{setMode('time');setSelected(null);}}>TIME <span>experiment</span></button></div>
    {visible.length&&!failed?<Scene desires={visible} trajectories={trajectories} mode={mode} onSelect={setSelected} onZoom={setZoom} onFailure={()=>setFailed(true)}/>:null}
    {(!visible.length||failed)?<section className="atlas-empty"><p className="eyebrow">{mode==='time'?'Время — не обещание':'Архив ещё не случившегося'}</p><h1>{!loaded?'Прислушиваемся…':failed?'У каждой мечты есть голос.':mode==='time'?'Некоторые связи\nнужно подтвердить.':'Мир начинается\nс одного желания.'}</h1><p>{!loaded?'Читаем реальные записи.':failed?'WebGL недоступен. Выберите отдельное желание ниже.':mode==='time'?'В этом корпусе ещё нет вручную подтверждённых траекторий. Отметьте «Это одна мечта» в исследовательском контуре.':'Здесь появится живой организм из реальных высказываний. Соберите корпус или загрузите его JSON — вымышленных мечтаний здесь нет.'}</p>{mode==='time'?<a href="/research/trajectories">Проверить траектории ↗</a>:<a href="/research">Собрать первые желания ↗</a>}<CorpusImport onImport={r=>c.saveRecords(mergeCorpus(c.records,r))} onError={c.setError}/></section>:null}
    {c.error?<p className="atlas-error" role="alert">{c.error}</p>:null}
    {selected?<aside className="desire-whisper" aria-label="Одно желание"><button className="whisper-close" aria-label="Закрыть желание" onClick={()=>setSelected(null)}>×</button><p className="eyebrow">Одно человеческое высказывание</p><blockquote>{selected.text||'Образ без слов'}</blockquote><p>{selected.date||'Дата неизвестна'} · {selected.language.toUpperCase()}</p><p>{selected.state} · {selected.dream_object||'Объект ещё не определён'}</p>{selected.visual_withheld?<small>Изображение остаётся в исследовательском архиве.</small>:null}</aside>:null}
    <footer className="atlas-footer"><div><p className="eyebrow">{mode==='time'?'Наблюдаемые связи · проверены человеком':'Миллионы желаний заканчиваются одним человеком'}</p><p>{mode==='time'?`${trajectories.length} подтверждённых пар · не полная история мечты`:`${desires.length} реальных высказываний${desires.length>5000?' · первые 5000 в WebGL':''}`}</p></div><div className="atlas-navigation"><span>{['','I / коллективное тело','II / созвездия','III / одно желание'][zoom]}</span><label className="sr-only" htmlFor="desire-choice">Выбрать желание без мыши</label><select id="desire-choice" value={selected?.id||''} onChange={e=>setSelected(visible.find(d=>d.id===e.target.value)||null)}><option value="">Найти один голос…</option>{visible.map((d,i)=><option value={d.id} key={d.id}>{i+1} · {d.text.slice(0,65)}</option>)}</select><small>Прокрутка — приблизиться · движение — вращать · ← → — читать</small></div></footer>
  </main>;
}
