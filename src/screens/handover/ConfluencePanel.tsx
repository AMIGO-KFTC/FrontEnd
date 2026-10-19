import { useMemo, useState } from "react";
import { api } from "@/shared/api";
import { Icon } from "@/shared/Icon";
import { highlight, shortDate } from "@/shared/highlight";
import type { Picked, PickItem } from "@/shared/pickBridge";
import type { ConfluencePage, ConfluenceSearchResult, IntegrationImportResult, Source } from "@/shared/types";
import { PickedChips } from "./PickedChips";

type Props = {
  sources: Source[]; // 이미 등록된 자료(등록된 페이지는 체크 해제 불가)
  busy: boolean;
  picked: Picked; // 고른 페이지(다른 탭에서 보내 온 것 포함). 화면이 들고 있어 패널을 닫아도 남는다.
  onImport?: (pageIds: string[]) => Promise<IntegrationImportResult | undefined>; // 자료 등록(원래 창)
  onSend?: (items: PickItem[]) => Promise<string | undefined>; // 원래 창으로 보내기(새 탭 선택 창). 있으면 onImport 대신 쓴다.
  onPopOut?: () => void; // 새 탭에서 열기(원래 창에서만)
};

export function ConfluencePanel({ sources, busy, picked, onImport, onSend, onPopOut }: Props) {
  const [query, setQuery] = useState("");
  const [space, setSpace] = useState("");
  const [result, setResult] = useState<ConfluenceSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const registered = useMemo(() => new Set(sources.filter((s) => s.link_type === "confluence").map((s) => s.url)), [sources]);
  const terms = result?.terms ?? [];
  const pages: ConfluencePage[] = result?.results ?? [];
  const selectable = pages.filter((page) => !registered.has(page.url));
  const allChecked = selectable.length > 0 && selectable.every((page) => picked.has(page.id));

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
  const toItem = (page: ConfluencePage): PickItem => ({ id: page.id, title: page.title, url: page.url });
  const toggle = (page: ConfluencePage) => picked.toggle(toItem(page));
  const toggleAll = () => {
    if (allChecked) picked.removeMany(selectable.map((page) => page.id));
    else picked.addMany(selectable.map(toItem));
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
    if (!picked.items.length) return;
    setImporting(true);
    setNotice(null);
    if (onSend) {
      const message = await onSend(picked.items);
      if (message) {
        picked.clear();
        setNotice(message);
      }
    } else if (onImport) {
      const imported = await onImport(picked.items.map((item) => item.id));
      if (imported) {
        picked.clear();
        setNotice(imported.message);
      }
    }
    setImporting(false);
  };

  return (
    <section className="integration-panel">
      <div className="integration-head">
        <span><Icon name="folder" size={15} /></span>
        <div>
          <strong>컨플루언스 페이지 검색</strong>
          <p>가상 위키예요. 단어를 검색하면 제목·본문·라벨에 그 단어가 들어간 페이지를 찾아요.</p>
        </div>
        {onPopOut && (
          <button type="button" className="integration-popout" onClick={onPopOut} title="이 검색을 새 탭에서 열어요. 거기서 고른 페이지는 이 창으로 넘어와요.">
            <Icon name="chevron" size={11} /> 새 탭에서 열기
          </button>
        )}
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
              const checked = done || picked.has(page.id);
              const isOpen = opened === page.id;
              return (
                <li key={page.id} className={`integration-row${checked ? " checked" : ""}${done ? " registered" : ""}`}>
                  <input type="checkbox" checked={checked} disabled={done} onChange={() => toggle(page)} aria-label={`${page.title} 선택`} />
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
        </>
      )}
      <PickedChips picked={picked} />
      <div className="integration-foot">
        <span>{picked.items.length ? `${picked.items.length}개 선택됨` : "페이지를 선택해 주세요"}</span>
        {notice && <em className="integration-notice">{notice}</em>}
        <button type="button" className="integration-submit" disabled={!picked.items.length || busy || importing} onClick={submit}>
          <Icon name="check" size={13} /> {onSend ? "선택한 페이지 원래 창으로 보내기" : "선택한 페이지 자료로 등록"}
        </button>
      </div>
    </section>
  );
}
