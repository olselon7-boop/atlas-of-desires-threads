"use client";

import { useEffect, useRef, useState } from "react";
import { mergeCorpus, SEARCH_FORMULAS, type DesireRecord, type Review } from "@/lib/desire";

const STORAGE = "atlas-research-corpus-v1";
type Status = { configured: boolean; hasAccessToken: boolean };
export default function Research() {
  const [status, setStatus] = useState<Status | null>(null);
  const [query, setQuery] = useState(SEARCH_FORMULAS[0]);
  const [records, setRecords] = useState<DesireRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cursor, setCursor] = useState<{ query: string; after: string } | null>(null);
  const [filter, setFilter] = useState<Review | "all">("all");
  const [page, setPage] = useState(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.version !== 1 || !Array.isArray(parsed.records) || !parsed.records.every((r: DesireRecord) => typeof r.id === "string" && typeof r.source?.original_text === "string" && Array.isArray(r.source?.queries) && ["unreviewed", "keep", "exclude"].includes(r.review))) throw new Error("bad storage");
        setRecords(parsed.records);
      }
      setReady(true);
    } catch { setError("Не удалось прочитать сохранённый корпус. Экспортируйте данные из прежней сессии или очистите хранилище браузера."); }
    const abort = new AbortController();
    fetch("/api/threads/status", { cache: "no-store", signal: abort.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(setStatus).catch(e => { if (e.name !== "AbortError") setError("Не удалось проверить подключение Threads. Обновите страницу."); });
    return () => { abort.abort(); controller.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE, JSON.stringify({ version: 1, records })); }
    catch { setError("Хранилище браузера переполнено или недоступно. Скачайте JSON, чтобы сохранить текущий корпус."); }
  }, [records, ready]);
  async function collect(next = false) {
    if (busy || !ready) return;
    setBusy(true); setError(""); setNotice("");
    const abort = new AbortController(); controller.current = abort;
    const q = next && cursor ? cursor.query : query.trim();
    try {
      const params = new URLSearchParams({ q });
      if (next && cursor) params.set("after", cursor.after);
      const response = await fetch(`/api/threads/corpus?${params}`, { cache: "no-store", signal: abort.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось получить посты.");
      if (!Array.isArray(data.records)) throw new Error("Threads вернул неожиданный ответ.");
      setRecords(previous => mergeCorpus(previous, data.records));
      setCursor(data.nextCursor ? { query: q, after: data.nextCursor } : null);
      setNotice(`Получено постов: ${data.records.length}. Повторные записи объединены. ${data.nextCursor ? "Есть следующая страница." : "Доступные страницы закончились."}`);
      setPage(0);
    } catch (e) { if (!(e instanceof Error && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Ошибка поиска."); }
    finally { setBusy(false); }
  }
  function review(id: string, value: Review) { setRecords(previous => previous.map(r => r.id === id ? { ...r, review: value } : r)); }
  function download() {
    const payload = { schema_version: 1, exported_at: new Date().toISOString(), target_size: [1000, 3000], notes: "Research corpus. Original text and source links may identify individuals. Rule-based interpretation requires manual review. No inferred location. Media links may expire.", records };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `atlas-corpus-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const kept = records.filter(r => r.review === "keep").length;
  const pending = records.filter(r => r.review === "unreviewed").length;
  const visible = records.filter(r => filter === "all" || r.review === filter);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visible.length / 20) - 1));
  return <main className="research">
    <header className="masthead"><a href="/">АТЛАС ЖЕЛАНИЙ</a><span>ИССЛЕДОВАТЕЛЬСКИЙ КОНТУР · 01</span></header>
    <section className="intro"><p className="eyebrow">Архив ещё не случившегося</p><h1>Сначала —<br /><em>человеческий голос.</em></h1><p className="lead">Собираем публичные высказывания о будущем. Сохраняем каждую фразу, проверяем её смысл, ищем первые связи.</p></section>
    <div className="connection"><span className={`lamp ${status?.hasAccessToken ? "on" : ""}`} />{!status ? "Проверяем подключение…" : status.hasAccessToken ? "Threads подключён в этой сессии" : status.configured ? "Приложение настроено · нужна авторизация Threads" : "Приложение Threads ещё не настроено"}<a href="/api/threads/auth">{status?.hasAccessToken ? "Подключить заново ↗" : "Подключить Threads ↗"}</a></div>
    <section className="workbench" aria-label="Поиск и сбор корпуса"><div><p className="eyebrow">01 / Формула желания</p><form onSubmit={e => { e.preventDefault(); void collect(); }}><label htmlFor="query">Что искать в публичных постах</label><div className="searchline"><input id="query" value={query} maxLength={200} required disabled={busy} onChange={e => { setQuery(e.target.value); setCursor(null); }} /><button disabled={busy || !ready || !status?.hasAccessToken}>{busy ? "Ищем…" : "Собрать страницу →"}</button></div></form><div className="presets">{SEARCH_FORMULAS.map(formula => <button key={formula} disabled={busy} className={query === formula ? "selected" : ""} onClick={() => { setQuery(formula); setCursor(null); }}>{formula}</button>)}</div><button className="quiet" disabled={busy || !cursor || !status?.hasAccessToken} onClick={() => void collect(true)}>Следующая страница</button><p className="hint">Каждая формула проверяется отдельно. Совпадение слов — повод прочитать пост, а не доказательство желания.</p></div><aside><p className="eyebrow">Первый корпус</p><div className="count">{records.length}<small> / 1 000–3 000 постов</small></div><p>{kept} отобрано · {pending} ждут чтения</p><button disabled={!records.length} onClick={download}>Скачать корпус · JSON ↓</button><p className="hint">Корпус хранится только в этом браузере. Скачивайте его после каждой сессии. Тексты и ссылки на источники могут раскрывать автора; экспорт предназначен для исследования.</p><button className="quiet danger" disabled={!records.length || busy} onClick={() => { if (window.confirm("Удалить корпус из этого браузера? Сначала скачайте JSON.")) { setRecords([]); setCursor(null); } }}>Очистить локальный корпус</button></aside></section>
    {error ? <p className="feedback error" role="alert">{error}</p> : null}{notice ? <p className="feedback" role="status">{notice}</p> : null}
    <section className="archive"><div className="archivehead"><div><p className="eyebrow">02 / Чтение материала</p><h2>Одна запись — один человек.</h2></div><label>Показать<select value={filter} onChange={e => { setFilter(e.target.value as typeof filter); setPage(0); }}><option value="all">Все записи</option><option value="unreviewed">Без проверки</option><option value="keep">Отобранные</option><option value="exclude">Исключённые</option></select></label></div>
    {!visible.length ? <div className="empty"><span>∅</span><p>{records.length ? "В этом отборе пока нет записей." : "Архив ждёт первого настоящего высказывания."}</p><small>Подключите Threads и выберите формулу поиска.</small></div> : visible.slice(currentPage * 20, (currentPage + 1) * 20).map(record => <article className="record" key={record.id}><div className="recordmeta"><span>{record.source.timestamp ? record.source.timestamp.slice(0, 10) : "Дата не передана"}</span><span>{record.interpretation.candidate ? `Формула: ${record.interpretation.matched_formula}` : "Формула не обнаружена"} · требует чтения</span></div><p className="original">{record.source.original_text || "Пост без текста"}</p><div className="recordfoot"><div>{record.source.permalink ? <a href={record.source.permalink} target="_blank" rel="noopener noreferrer">Оригинал ↗</a> : null}{record.media.url ? <a href={record.media.url} target="_blank" rel="noopener noreferrer">Медиа ↗</a> : null}<small>{record.source.queries.join(" · ")}</small></div><div className="review" aria-label="Ручной отбор">{([["keep", "Это желание"], ["exclude", "Исключить"], ["unreviewed", "Вернуть к чтению"]] as const).map(([value, label]) => <button key={value} aria-pressed={record.review === value} onClick={() => review(record.id, value)}>{label}</button>)}</div></div></article>)}
    {visible.length > 20 ? <nav className="pagination" aria-label="Страницы корпуса"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>← Назад</button><span>{currentPage + 1} / {Math.ceil(visible.length / 20)}</span><button disabled={(currentPage + 1) * 20 >= visible.length} onClick={() => setPage(currentPage + 1)}>Далее →</button></nav> : null}</section>
    <footer>Исходный текст сохраняется отдельно от интерпретации. География не угадывается. Искусственные желания не добавляются.</footer>
  </main>;
}
