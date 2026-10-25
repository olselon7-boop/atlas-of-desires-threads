"use client";
import type { DesireRecord } from "@/lib/desire";
import { parseCorpus } from "@/lib/corpus";
export function ResearchNav(){return <nav className="research-nav" aria-label="Исследовательские режимы"><a href="/research">Корпус</a><a href="/research/images">Изображения</a><a href="/research/trajectories">Траектории</a><a href="/atlas">Войти в Атлас ↗</a></nav>;}
export function CorpusImport({onImport,onError}:{onImport:(records:DesireRecord[])=>void;onError:(error:string)=>void}){
  return <label className="import-control">Загрузить корпус JSON<input type="file" accept=".json,application/json" onChange={async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{if(file.size>10_000_000)throw new Error('Файл больше 10 МБ.');const records=parseCorpus(JSON.parse(await file.text()));onImport(records);}
    catch(e){onError(e instanceof Error?e.message:'Не удалось загрузить JSON.');}finally{e.target.value='';}
  }}/></label>;
}
export function exportJson(value:unknown,name:string){const u=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
export function ResearchImage({record}:{record:DesireRecord}){
  const src=record.media.thumbnail_url||record.media.url;
  return src&&['IMAGE','CAROUSEL_ALBUM','VIDEO'].includes(record.media.type||'')?<img className="research-image" src={src} alt="Исходное изображение поста; доступно только в исследовательском интерфейсе" loading="lazy" referrerPolicy="no-referrer"/>:<div className="media-empty">Изображение не передано</div>;
}
export const STATES=['dreaming','stalled','struggling','fulfilled_passive','fulfilled_active','abandoned','transformed','unknown'] as const;
