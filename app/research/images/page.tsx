"use client";
import { useMemo,useState } from "react";
import { useResearchCorpus } from "@/components/use-research-corpus";
import { CorpusImport, ResearchNav, ResearchImage, STATES, exportJson } from "@/components/research-tools";
import { enrichRecord, hasImage } from "@/lib/corpus";
import { mergeCorpus } from "@/lib/desire";
import { VISUAL_ROLES, type VisualAnalysis } from "@/lib/visual-schema";
export default function Images(){
  const c=useResearchCorpus();
  const [lang,setLang]=useState('all'),[state,setState]=useState('all'),[role,setRole]=useState('all'),[object,setObject]=useState('all'),[alignment,setAlignment]=useState('all');
  const [limit,setLimit]=useState(10),[credential,setCredential]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[page,setPage]=useState(0);
  const media=useMemo(()=>c.records.filter(r=>Boolean(r.media.url||r.media.thumbnail_url)),[c.records]);
  const objects=[...new Set(media.map(r=>r.dream_object?.canonical).filter((s):s is string=>Boolean(s)))].sort();
  const filtered=media.filter(r=>(lang==='all'||r.interpretation.language_hint===lang)&&(state==='all'||r.interpretation.dream_state===state)&&(role==='all'||r.visual_analysis?.visual_role===role)&&(object==='all'||r.dream_object?.canonical===object)&&(alignment==='all'||r.visual_analysis?.text_image_alignment===alignment));
  const eligible=filtered.filter(r=>hasImage(r)&&r.visual_analysis?.status!=='analyzed');
  const current=Math.min(page,Math.max(0,Math.ceil(filtered.length/24)-1));
  async function analyze(){
    setBusy(true);setNotice('');c.setError('');
    try{
      const response=await fetch('/api/research/images/analyze',{method:'POST',headers:{'Content-Type':'application/json',...(credential?{Authorization:`Bearer ${credential}`}:{})},body:JSON.stringify({records:eligible.slice(0,limit)})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Анализ не выполнен.');
      const results=new Map<string,VisualAnalysis>(data.results.map((r:{id:string;visual_analysis:VisualAnalysis})=>[r.id,r.visual_analysis]));
      if(c.saveRecords(c.records.map(r=>results.has(r.id)?enrichRecord({...r,visual_analysis:results.get(r.id)!}):r))){
        const counts:Record<string,number>={};for(const v of results.values())counts[v.status]=(counts[v.status]||0)+1;
        setNotice(data.status==='not_configured'?'not_configured — OPENAI_API_KEY отсутствует на сервере. Корпус и остальные функции доступны.':`Результат пакета: ${Object.entries(counts).map(([k,v])=>`${k}: ${v}`).join(', ')}. Сохранено в этом браузере.`);
      }
    }catch(e){c.setError(e instanceof Error?e.message:'Ошибка анализа.');}finally{setBusy(false);}
  }
  return <main className="research"><header className="masthead"><a href="/">АТЛАС ЖЕЛАНИЙ</a><span>03 / ИКОНОГРАФИЯ МЕЧТЫ</span></header><ResearchNav/>
    <section className="intro"><p className="eyebrow">Изображение — самостоятельное свидетельство</p><h1>Как выглядит<br/><em>мечта?</em></h1><p className="lead">Текст и образ читаются вместе. Визуальная роль и объект — гипотезы для исследователя, а не доказательство исполнения.</p></section>
    <div className="research-actions"><CorpusImport onImport={r=>c.saveRecords(mergeCorpus(c.records,r))} onError={c.setError}/><button disabled={!c.records.length} onClick={()=>exportJson({schema_version:3,records:c.records},'atlas-visual-corpus.json')}>Экспорт с анализом</button></div>
    <section className="filterbar" aria-label="Фильтры изображений">
      <label>Язык<select value={lang} onChange={e=>{setLang(e.target.value);setPage(0);}}><option value="all">Все</option><option value="ru">RU</option><option value="en">EN</option></select></label>
      <label>Стадия<select value={state} onChange={e=>{setState(e.target.value);setPage(0);}}><option value="all">Все</option>{STATES.map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Визуальная роль<select value={role} onChange={e=>{setRole(e.target.value);setPage(0);}}><option value="all">Все</option>{VISUAL_ROLES.map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Объект мечты<select value={object} onChange={e=>{setObject(e.target.value);setPage(0);}}><option value="all">Все</option>{objects.map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Текст / образ<select value={alignment} onChange={e=>{setAlignment(e.target.value);setPage(0);}}>{['all','high','medium','low','unknown'].map(s=><option key={s}>{s}</option>)}</select></label>
    </section>
    <section className="analysis-controls"><div><p className="eyebrow">Только явный запуск · без фоновых расходов</p><p className="hint">Повторно анализировать завершённые записи не будем. До 50 изображений за один пакет; первый пилот 50–100 можно выполнить двумя пакетами. Сначала проверьте результат на 10.</p></div>
      <label>Размер пакета<input aria-label="Размер пакета" type="number" min={1} max={50} value={limit} onChange={e=>setLimit(Math.max(1,Math.min(50,Number(e.target.value)||1)))}/></label>
      <label>Код доступа исследователя<input type="password" autoComplete="off" value={credential} onChange={e=>setCredential(e.target.value)} placeholder="RESEARCH_ANALYSIS_TOKEN"/></label>
      <button disabled={busy||!c.ready||!eligible.length} onClick={()=>void analyze()}>{busy?'Анализируем…':`Анализировать ${Math.min(limit,eligible.length)} →`}</button>
    </section>
    {c.error?<p className="feedback error" role="alert">{c.error}</p>:null}{notice?<p className="feedback" role="status">{notice}</p>:null}
    <p className="hint">С медиа: {filtered.length}. Корпус и результаты хранятся локально в этом браузере; экспортируйте их для переноса.</p>
    {!filtered.length?<div className="empty">{c.ready?'Нет изображений в этом отборе. Соберите реальный корпус в /research или загрузите его JSON.':'Читаем корпус…'}</div>:null}
    <div className="image-grid">{filtered.slice(current*24,(current+1)*24).map(r=><article className="image-record" key={r.id}><ResearchImage record={r}/><p className="eyebrow">{r.source.timestamp?.slice(0,10)||'Дата неизвестна'} · {r.interpretation.language_hint} · {r.interpretation.dream_state}</p><p className="original">{r.source.original_text}</p><dl><dt>Статус анализа</dt><dd>{r.visual_analysis?.status||'not_analyzed'}</dd><dt>Объект из текста</dt><dd>{r.dream_object?.text_evidence.join(' · ')||'Не определён'}</dd><dt>Общий объект</dt><dd>{r.dream_object?.canonical||'Не определён'}</dd><dt>Объект из изображения</dt><dd>{r.visual_analysis?.dream_object_visual||'Не определён'}</dd><dt>Мотивы</dt><dd>{r.visual_analysis?.visual_motifs.join(' · ')||'—'}</dd><dt>Роль / согласованность</dt><dd>{r.visual_analysis?.visual_role||'unknown'} / {r.visual_analysis?.text_image_alignment||'unknown'}</dd></dl><p className="hint">{r.visual_analysis?.description}</p></article>)}</div>
    {filtered.length>24?<nav className="pagination" aria-label="Страницы изображений"><button disabled={!current} onClick={()=>setPage(current-1)}>Назад</button><span>{current+1} / {Math.ceil(filtered.length/24)}</span><button disabled={(current+1)*24>=filtered.length} onClick={()=>setPage(current+1)}>Далее</button></nav>:null}
    <footer>Люди и непрочитанные изображения остаются в исследовательском контуре. API key доступен только серверу.</footer>
  </main>;
}
