"use client";

import { useEffect, useRef, useState } from "react";
import {
  mergeCorpus,
  SEARCH_FORMULAS,
  type DesireRecord,
  type DesireState,
  type Platform,
  type Review,
} from "@/lib/desire";

const STORAGE = "atlas-research-corpus-v2";
type Status = { configured: boolean; hasAccessToken: boolean };

const stateLabels: Record<DesireState, string> = {
  dreaming: "мечтает",
  stalled: "мечта не движется",
  struggling: "пытается реализовать",
  fulfilled_passive: "мечта сбылась",
  fulfilled_active: "сам(а) реализовал(а)",
  abandoned: "отказался(ась)",
  transformed: "мечта изменилась",
  unknown: "стадия не определена",
};

export default function Research() {
  const [status, setStatus] = useState<Status | null>(null);
  const [source, setSource] = useState<Platform>("bluesky");
  const [query, setQuery] = useState(SEARCH_FORMULAS[0]);
  const [records, setRecords] = useState<DesireRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cursor, setCursor] = useState<{ source: Platform; query: string; value: string } | null>(null);
  const [filter, setFilter] = useState<Review | "all">("all");
  const [page, setPage] = useState(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE) || localStorage.getItem("atlas-research-corpus-v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed.records)) throw new Error("bad storage");
        setRecords(parsed.records);
      }
      setReady(true);
    } catch {
      setError("Не удалось прочитать сохранённый корпус. Экспортируйте данные из прежней сессии или очистите хранилище браузера.");
    }

    const abort = new AbortController();
    fetch("/api/threads/status", { cache: "no-store", signal: abort.signal })
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setStatus)
      .catch(e => {
        if (e.name !== "AbortError") setError("Не удалось проверить подключение Threads. Bluesky при этом остаётся доступен.");
      });
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ version: 2, records }));
    } catch {
      setError("Хранилище браузера переполнено или недоступно. Скачайте JSON, чтобы сохранить текущий корпус.");
    }
  }, [records, ready]);

  async function collect(next = false) {
    if (busy || !ready) return;
    setBusy(true);
    setError("");
    setNotice("");

    const abort = new AbortController();
    controller.current = abort;
    const q = next && cursor ? cursor.query : query.trim();
    const selectedSource = next && cursor ? cursor.source : source;

    try {
      const params = new URLSearchParams({ q });
      if (next && cursor) {
        params.set(selectedSource === "threads" ? "after" : "cursor", cursor.value);
      }
      const response = await fetch(`/api/${selectedSource}/corpus?${params}`, {
        cache: "no-store",
        signal: abort.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось получить посты.");
      if (!Array.isArray(data.records)) throw new Error("Источник вернул неожиданный ответ.");

      setRecords(previous => mergeCorpus(previous, data.records));
      setCursor(data.nextCursor ? { source: selectedSource, query: q, value: data.nextCursor } : null);
      setNotice(
        `${selectedSource === "bluesky" ? "Bluesky" : "Threads"}: получено ${data.records.length} постов. ` +
          (data.nextCursor ? "Есть следующая страница." : "Доступные страницы закончились."),
      );
      setPage(0);
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "Ошибка поиска.");
      }
    } finally {
      setBusy(false);
    }
  }

  function review(id: string, value: Review) {
    setRecords(previous => previous.map(r => (r.id === id ? { ...r, review: value } : r)));
  }

  function download() {
    const payload = {
      schema_version: 2,
      exported_at: new Date().toISOString(),
      target_size: [1000, 3000],
      research_questions: [
        "Меняются ли человеческие мечты или только язык и платформа?",
        "Какие мечты сбываются сами, а какие человек реализует?",
        "Какие мечты остаются без движения во времени?",
        "Сколько времени проходит от мечты до её реализации?",
      ],
      notes:
        "Research corpus. Original text and source links may identify individuals. Rule-based interpretation requires manual review. author_key is pseudonymous, not anonymous. No inferred location.",
      records,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-corpus-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const kept = records.filter(r => r.review === "keep").length;
  const pending = records.filter(r => r.review === "unreviewed").length;
  const visible = records.filter(r => filter === "all" || r.review === filter);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(visible.length / 20) - 1));

  const stateCounts = records.reduce<Record<string, number>>((acc, record) => {
    const state = record.interpretation?.dream_state || "unknown";
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, {});

  const threadsReady = Boolean(status?.hasAccessToken);
  const canCollect = source === "bluesky" || threadsReady;

  return (
    <main className="research">
      <header className="masthead">
        <a href="/">АТЛАС ЖЕЛАНИЙ</a>
        <span>ИССЛЕДОВАТЕЛЬСКИЙ КОНТУР · 02 / ЖИЗНЬ МЕЧТЫ</span>
      </header>

      <section className="intro">
        <p className="eyebrow">Архив ещё не случившегося</p>
        <h1>
          Мечта как
          <br />
          <em>траектория во времени.</em>
        </h1>
        <p className="lead">
          Собираем не только «я мечтаю», но и «ничего не происходит», «пытаюсь», «мечта сбылась» и «я сам её реализовал».
          Так появляется возможность исследовать жизнь мечты — от первого высказывания до реализации, изменения или отказа.
        </p>
      </section>

      <div className="connection">
        <span className="lamp on" />
        Bluesky · публичный live-поиск доступен без авторизации
        <span className={`lamp ${threadsReady ? "on" : ""}`} />
        {threadsReady ? "Threads подключён" : "Threads ждёт доступа / авторизации"}
        <a href="/api/threads/auth">Threads OAuth ↗</a>
      </div>

      <section className="workbench" aria-label="Поиск и сбор корпуса">
        <div>
          <p className="eyebrow">01 / Источник</p>
          <div className="presets">
            {(["bluesky", "threads"] as Platform[]).map(item => (
              <button
                key={item}
                disabled={busy}
                className={source === item ? "selected" : ""}
                onClick={() => {
                  setSource(item);
                  setCursor(null);
                }}
              >
                {item === "bluesky" ? "Bluesky · live" : "Threads · API"}
              </button>
            ))}
          </div>

          <p className="eyebrow">02 / Формула состояния мечты</p>
          <form
            onSubmit={e => {
              e.preventDefault();
              void collect();
            }}
          >
            <label htmlFor="query">Что искать в публичных постах</label>
            <div className="searchline">
              <input
                id="query"
                value={query}
                maxLength={200}
                required
                disabled={busy}
                onChange={e => {
                  setQuery(e.target.value);
                  setCursor(null);
                }}
              />
              <button disabled={busy || !ready || !canCollect}>{busy ? "Ищем…" : "Собрать страницу →"}</button>
            </div>
          </form>

          <div className="presets">
            {SEARCH_FORMULAS.map(formula => (
              <button
                key={formula}
                disabled={busy}
                className={query === formula ? "selected" : ""}
                onClick={() => {
                  setQuery(formula);
                  setCursor(null);
                }}
              >
                {formula}
              </button>
            ))}
          </div>

          <button className="quiet" disabled={busy || !cursor || !canCollect} onClick={() => void collect(true)}>
            Следующая страница
          </button>
          <p className="hint">
            Правила определяют только предварительную стадию и агентность. «Сбылась» ≠ «сам реализовал». Каждую запись нужно читать вручную.
          </p>
        </div>

        <aside>
          <p className="eyebrow">Первый корпус</p>
          <div className="count">
            {records.length}
            <small> / 1 000–3 000 постов</small>
          </div>
          <p>{kept} отобрано · {pending} ждут чтения</p>
          <p className="hint">
            Мечтают: {stateCounts.dreaming || 0} · Застряли: {stateCounts.stalled || 0} · Сбылась: {stateCounts.fulfilled_passive || 0} ·
            Реализовали сами: {stateCounts.fulfilled_active || 0}
          </p>
          <button disabled={!records.length} onClick={download}>
            Скачать корпус · JSON ↓
          </button>
          <p className="hint">
            author_key позволяет позже искать траектории одного автора во времени, но это псевдонимизация, а не полная анонимизация.
          </p>
          <button
            className="quiet danger"
            disabled={!records.length || busy}
            onClick={() => {
              if (window.confirm("Удалить корпус из этого браузера? Сначала скачайте JSON.")) {
                setRecords([]);
                setCursor(null);
              }
            }}
          >
            Очистить локальный корпус
          </button>
        </aside>
      </section>

      {error ? <p className="feedback error" role="alert">{error}</p> : null}
      {notice ? <p className="feedback" role="status">{notice}</p> : null}

      <section className="archive">
        <div className="archivehead">
          <div>
            <p className="eyebrow">03 / Чтение материала</p>
            <h2>Одна запись — одна точка на траектории.</h2>
          </div>
          <label>
            Показать
            <select
              value={filter}
              onChange={e => {
                setFilter(e.target.value as typeof filter);
                setPage(0);
              }}
            >
              <option value="all">Все записи</option>
              <option value="unreviewed">Без проверки</option>
              <option value="keep">Отобранные</option>
              <option value="exclude">Исключённые</option>
            </select>
          </label>
        </div>

        {!visible.length ? (
          <div className="empty">
            <span>∅</span>
            <p>{records.length ? "В этом отборе пока нет записей." : "Архив ждёт первого настоящего высказывания."}</p>
            <small>Выберите Bluesky и нажмите «Собрать страницу» — Meta для этого не нужна.</small>
          </div>
        ) : (
          visible.slice(currentPage * 20, (currentPage + 1) * 20).map(record => {
            const state = record.interpretation?.dream_state || "unknown";
            return (
              <article className="record" key={record.id}>
                <div className="recordmeta">
                  <span>
                    {record.source.platform.toUpperCase()} · {record.source.timestamp ? record.source.timestamp.slice(0, 10) : "Дата не передана"}
                  </span>
                  <span>
                    {stateLabels[state]} · агентность: {record.interpretation?.agency || "unknown"}
                    {record.interpretation?.duration_mentioned ? ` · упомянуто: ${record.interpretation.duration_mentioned}` : ""}
                  </span>
                </div>
                <p className="original">{record.source.original_text || "Пост без текста"}</p>
                <div className="recordfoot">
                  <div>
                    {record.source.permalink ? (
                      <a href={record.source.permalink} target="_blank" rel="noopener noreferrer">
                        Оригинал ↗
                      </a>
                    ) : null}
                    {record.media.url ? (
                      <a href={record.media.url} target="_blank" rel="noopener noreferrer">
                        Медиа ↗
                      </a>
                    ) : null}
                    <small>{record.source.queries.join(" · ")}</small>
                  </div>
                  <div className="review" aria-label="Ручной отбор">
                    {([
                      ["keep", "Оставить"],
                      ["exclude", "Исключить"],
                      ["unreviewed", "Вернуть к чтению"],
                    ] as const).map(([value, label]) => (
                      <button key={value} aria-pressed={record.review === value} onClick={() => review(record.id, value)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            );
          })
        )}

        {visible.length > 20 ? (
          <nav className="pagination" aria-label="Страницы корпуса">
            <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>← Назад</button>
            <span>{currentPage + 1} / {Math.ceil(visible.length / 20)}</span>
            <button disabled={(currentPage + 1) * 20 >= visible.length} onClick={() => setPage(currentPage + 1)}>Далее →</button>
          </nav>
        ) : null}
      </section>

      <footer>
        Исходный текст хранится отдельно от интерпретации. География не угадывается. Стадия мечты и агентность — гипотеза до ручной проверки.
      </footer>
    </main>
  );
}
