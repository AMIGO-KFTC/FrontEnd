import { useMemo, useState } from "react";
import { api } from "../shared/api";
import { Icon } from "../shared/Icon";
import { highlight, shortDate } from "../shared/highlight";
import type { ConfluencePage, ConfluenceSearchResult, IntegrationImportResult, Source } from "../shared/types";

type Props = {
  sources: Source[]; // 이미 등록된 자료(등록된 페이지는 체크 해제 불가)
  busy: boolean;
  onImport: (pageIds: string[]) => Promise<IntegrationImportResult | undefined>;
};

export function ConfluencePanel({ sources, busy, onImport }: Props) {
  const [query, setQuery] = useState("");
  const [space, setSpace] = useState("");
  const [result, setResult] = useState<ConfluenceSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const registered = useMemo(() => new Set(sources.filter((s) => s.link_type === "confluence").map((s) => s.url)), [sources]);
  const terms = result?.terms ?? [];
  const pages: ConfluencePage[] = result?.results ?? [];
  const selectable = pages.filter((page) => !registered.has(page.url));
  const allChecked = selectable.length > 0 && selectable.every((page) => selected.has(page.id));

  const search = async (nextSpace = space) => {
    const q = query.trim();
    if (!q) {
      setResult(null);
      return;
    }
    setSearching(true);
    setLoadError(null);
    setNotice(null);
    try {
      setResult(await api.confluenceSearch(q, nextSpace));
      setOpened(null);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) selectable.forEach((page) => next.delete(page.id));
      else selectable.forEach((page) => next.add(page.id));
      return next;
    });
  };
  const open = (id: string) => {
    if (opened === id) {
      setOpened(null);
      return;
    }
    setOpened(id);
    if (!bodies[id]) {
      api
        .confluencePage(id)
        .then((page) => setBodies((prev) => ({ ...prev, [id]: page.body })))
        .catch((e: Error) => setLoadError(e.message));
    }
  };
  const submit = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setImporting(true);
    setNotice(null);
    const imported = await onImport(ids);
    setImporting(false);
    if (imported) {
      setSelected(new Set());
      setNotice(imported.message);
    }
  };

  return (
    <section className="integration-panel">
      <div className="integration-head">
        <span><Icon name="folder" size={15} /></span>
        <div>
          <strong>컨플루언스 페이지 검색</strong>
          <p>가상 위키예요. 단어를 검색하면 제목·본문·라벨에 그 단어가 들어간 페이지를 찾아요.</p>
        </div>
      </div>
      <form
        className="integration-search"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 인증서, 유지보수 검수, 계정" aria-label="컨플루언스 검색어" />
        {result && result.spaces.length > 0 && (
          <select
            value={space}
            aria-label="스페이스"
            onChange={(event) => {
              setSpace(event.target.value);
              void search(event.target.value);
            }}
          >
            <option value="">모든 스페이스</option>
            {result.spaces.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
        )}
        <button type="submit" disabled={searching || !query.trim()}>{searching ? "찾는 중…" : "검색"}</button>
      </form>
      {loadError && <p className="integration-error" role="alert">{loadError}</p>}
      {!result && !loadError && <p className="integration-empty">검색어를 입력하고 Enter 를 누르면 결과가 여기에 나와요.</p>}
      {result && (
        <>
          <div className="integration-list-head">
            <label><input type="checkbox" checked={allChecked} disabled={!selectable.length} onChange={toggleAll} /> 전체 선택</label>
            <span>'{result.query}' 검색 결과 {result.total}건</span>
          </div>
          <ul className="integration-list">
            {pages.map((page) => {
              const done = registered.has(page.url);
              const checked = done || selected.has(page.id);
              const isOpen = opened === page.id;
              return (
                <li key={page.id} className={`integration-row${checked ? " checked" : ""}${done ? " registered" : ""}`}>
                  <input type="checkbox" checked={checked} disabled={done} onChange={() => toggle(page.id)} aria-label={`${page.title} 선택`} />
                  <div className="integration-row-body">
                    <div className="integration-row-title">
                      <span className="cf-space">{page.space_name}</span>
                      <strong>{highlight(page.title, terms)}</strong>
                      <time>{shortDate(page.updated_at)}</time>
                    </div>
                    <small className="integration-row-meta">
                      {[page.space_name, ...page.ancestors].join(" › ")} · {page.author}
                      {done && <em className="registered-tag">등록됨</em>}
                    </small>
                    <p className="integration-row-preview">{highlight(page.excerpt, terms)}</p>
                    {page.labels.length > 0 && (
                      <div className="cf-labels">
                        {page.labels.map((label) => (
                          <span key={label}>{highlight(label, terms)}</span>
                        ))}
                      </div>
                    )}
                    <button type="button" className="integration-more" onClick={() => open(page.id)}>
                      {isOpen ? "접기" : "본문 보기"} <Icon name="chevron" size={11} />
                    </button>
                    <a className="integration-more" href={page.url} target="_blank" rel="noreferrer">
                      컨플루언스에서 열기
                    </a>
                    {isOpen && (
                      <div className="cf-body">
                        {bodies[page.id] ? <pre>{highlight(bodies[page.id], terms)}</pre> : <p className="integration-empty">불러오는 중…</p>}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            {!pages.length && <li className="integration-empty">'{result.query}' 이(가) 들어간 페이지가 없어요. 다른 단어로 찾아보세요.</li>}
          </ul>
          <div className="integration-foot">
            <span>{selected.size ? `${selected.size}개 선택됨` : "페이지를 선택해 주세요"}</span>
            {notice && <em className="integration-notice">{notice}</em>}
            <button type="button" className="integration-submit" disabled={!selected.size || busy || importing} onClick={submit}>
              <Icon name="check" size={13} /> 선택한 페이지 자료로 등록
            </button>
          </div>
        </>
      )}
    </section>
  );
}
