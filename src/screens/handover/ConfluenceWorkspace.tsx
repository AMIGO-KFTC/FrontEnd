import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/shared/api";
import { highlight } from "@/shared/highlight";
import type { Picked, PickItem } from "@/shared/pickBridge";
import type { ConfluencePage, ConfluenceSearchResult } from "@/shared/types";
import "./confluenceWorkspace.css";

// 새 탭 선택 창의 컨플루언스 화면. 실제 컨플루언스처럼 왼쪽에 스페이스별 페이지 트리, 가운데에 페이지 본문이 보이고,
// 화면이 열리면 '페이지 검색' 모달이 바로 떠서 인수인계에 쓸 페이지를 검색해 고른다. 고른 페이지는 'AMIGO 로 보내기' 로 원래 창에 넘긴다.
// (데이터는 BackEnd 의 가상 예시 데이터다.)

type Props = {
  picked: Picked;
  onSend: (items: PickItem[]) => Promise<string | undefined>; // 보낸 결과 안내(성공 시 문장, 실패 시 undefined)
  warning: string | null;
  onClose: () => void;
};

type TreeNode = { key: string; label: string; page?: ConfluencePage; children: TreeNode[] };

// 페이지의 상위 경로(ancestors)로 트리를 만든다. 페이지가 없는 상위 제목은 폴더로 보인다.
function buildTree(pages: ConfluencePage[]): TreeNode[] {
  const root: TreeNode = { key: "", label: "", children: [] };
  const child = (parent: TreeNode, label: string): TreeNode => {
    let node = parent.children.find((c) => c.label === label);
    if (!node) {
      node = { key: `${parent.key}/${label}`, label, children: [] };
      parent.children.push(node);
    }
    return node;
  };
  for (const page of pages) {
    let cursor = root;
    for (const ancestor of page.ancestors) cursor = child(cursor, ancestor);
    child(cursor, page.title).page = page;
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.label.localeCompare(b.label, "ko"));
    nodes.forEach((n) => sort(n.children));
  };
  sort(root.children);
  return root.children;
}

// "2026-10-16 17:50" → "2026년 10월 16일"
function longDate(value: string): string {
  const [y, m, d] = (value.split(" ")[0] ?? "").split("-").map(Number);
  return y ? `${y}년 ${m}월 ${d}일` : value;
}

const SPACE_HUES = (key: string) => Array.from(key).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) * 47 % 360;

function SpaceIcon({ spaceKey, size = 24 }: { spaceKey: string; size?: number }) {
  return (
    <span className="cfw-space-icon" style={{ width: size, height: size, background: `hsl(${SPACE_HUES(spaceKey)} 55% 45%)`, fontSize: size * 0.5 }} aria-hidden="true">
      {spaceKey.charAt(0)}
    </span>
  );
}

const svg = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const SearchIcon = () => <svg {...svg}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
const CheckIcon = () => <svg {...svg} width={13} height={13} strokeWidth={2.8}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
const CaretIcon = () => <svg {...svg} width={12} height={12} strokeWidth={2.6}><path d="m9 6 6 6-6 6" /></svg>;
const PageIcon = () => <span className="cfw-doc-icon" aria-hidden="true" />;
const FolderIcon = () => <svg {...svg} width={15} height={15}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>;
const LogoMark = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#0C66E4" /><path d="M6 15.5c3-2.4 6.6-2.4 12 0M6 9.5c3-2.4 6.6-2.4 12 0" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" /></svg>
);

// ---------------------------------------------------------------- 페이지 검색 모달
function SearchModal({ picked, sending, onSubmit, onClose }: { picked: Picked; sending: boolean; onSubmit: () => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [space, setSpace] = useState("");
  const [result, setResult] = useState<ConfluenceSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  // 검색어가 비어 있으면 모든 페이지를 최근 수정 순으로 보여 준다. 입력이 멈추면 250ms 뒤에 검색한다.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        api
          .confluenceSearch(query.trim(), space)
          .then((data) => {
            if (cancelled) return;
            setResult(data);
            setError(null);
          })
          .catch((e: Error) => !cancelled && setError(e.message));
      },
      loadedOnce.current ? 250 : 0,
    );
    loadedOnce.current = true;
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, space]);

  const terms = result?.terms ?? [];
  const pages = result?.results ?? [];
  const toItem = (page: ConfluencePage): PickItem => ({ id: page.id, title: page.title, url: page.url });
  const allChecked = pages.length > 0 && pages.every((page) => picked.has(page.id));
  const toggleAll = () => {
    if (allChecked) picked.removeMany(pages.map((page) => page.id));
    else picked.addMany(pages.map(toItem));
  };

  return (
    <div className="cfw-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="cfw-modal" role="dialog" aria-modal="true" aria-labelledby="cfw-modal-title" onKeyDown={(event) => event.key === "Escape" && onClose()}>
        <div className="cfw-modal-head">
          <div>
            <h2 id="cfw-modal-title">인수인계에 쓸 페이지 검색</h2>
            <p>자료로 등록할 페이지를 검색해서 골라 주세요.{"\n"}제목·본문·라벨에 검색어가 들어간 페이지를 찾아요.</p>
          </div>
          <button type="button" className="cfw-x" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div className="cfw-modal-search">
          <label className="cfw-input">
            <SearchIcon />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 인증서, 유지보수 검수, 계정" aria-label="컨플루언스 검색어" />
          </label>
          <select value={space} onChange={(event) => setSpace(event.target.value)} aria-label="스페이스">
            <option value="">모든 스페이스</option>
            {(result?.spaces ?? []).map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="cfw-modal-listhead">
          <label>
            <input type="checkbox" checked={allChecked} disabled={!pages.length} onChange={toggleAll} /> 전체 선택
          </label>
          <span>{result ? (result.query ? `'${result.query}' 검색 결과 ${result.total}건` : `최근 수정한 페이지 ${result.total}건`) : ""}</span>
        </div>
        <ul className="cfw-modal-list">
          {error && <li className="cfw-note error" role="alert">{error}</li>}
          {!result && !error && <li className="cfw-note">페이지를 불러오는 중…</li>}
          {result && !pages.length && <li className="cfw-note">'{result.query}' 이(가) 들어간 페이지가 없어요.{"\n"}다른 단어로 찾아보세요.</li>}
          {pages.map((page) => (
            <li key={page.id}>
              <label className={`cfw-row${picked.has(page.id) ? " checked" : ""}`}>
                <input type="checkbox" checked={picked.has(page.id)} onChange={() => picked.toggle(toItem(page))} />
                <PageIcon />
                <span className="cfw-row-main">
                  <span className="cfw-row-title">
                    <strong>{highlight(page.title, terms)}</strong>
                    <time>{longDate(page.updated_at)}</time>
                  </span>
                  <span className="cfw-row-meta">{[page.space_name, ...page.ancestors].join(" › ")} · {page.author}</span>
                  <span className="cfw-row-excerpt">{highlight(page.excerpt, terms)}</span>
                  {page.labels.length > 0 && (
                    <span className="cfw-labels">
                      {page.labels.map((label) => (
                        <span key={label} className="cfw-label">{highlight(label, terms)}</span>
                      ))}
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="cfw-modal-foot">
          <span>{picked.items.length ? `${picked.items.length}개 선택됨` : "페이지를 선택해 주세요"}</span>
          <button type="button" className="cfw-btn subtle" onClick={onClose}>취소</button>
          <button type="button" className="cfw-btn primary" disabled={!picked.items.length || sending} onClick={onSubmit}>
            {sending ? "보내는 중…" : "선택한 페이지 AMIGO 로 보내기"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 화면 전체
export function ConfluenceWorkspace({ picked, onSend, warning, onClose }: Props) {
  const [all, setAll] = useState<ConfluenceSearchResult | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [modalOpen, setModalOpen] = useState(true); // 이 화면이 열리면 페이지 검색 모달이 바로 뜬다

  useEffect(() => {
    api
      .confluenceSearch("", "")
      .then((data) => {
        setAll(data);
        setOpenId((current) => current ?? data.results[0]?.id ?? null); // 처음에는 가장 최근에 고친 페이지를 연다
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    if (!openId || bodies[openId] !== undefined) return;
    let cancelled = false;
    api
      .confluencePage(openId)
      .then((page) => !cancelled && setBodies((prev) => ({ ...prev, [openId]: page.body })))
      .catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [openId, bodies]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const pages = all?.results ?? [];
  const current = pages.find((page) => page.id === openId);
  const spaces = useMemo(() => (all?.spaces ?? []).filter((s) => pages.some((p) => p.space_key === s.key)), [all, pages]);
  const toItem = (page: ConfluencePage): PickItem => ({ id: page.id, title: page.title, url: page.url });

  const send = async () => {
    if (!picked.items.length || sending) return;
    setSending(true);
    const message = await onSend(picked.items);
    setSending(false);
    if (message) {
      picked.clear();
      setToast(message);
      setModalOpen(false);
      window.setTimeout(onClose, 1800); // 보냈으면 이 탭은 닫는다(스크립트로 연 탭만 닫히고, 아니면 이 화면이 그대로 남는다)
    }
  };

  const renderNode = (spaceKey: string, node: TreeNode, depth: number) => {
    const id = `${spaceKey}${node.key}`;
    const isFolded = folded[id];
    const page = node.page;
    return (
      <li key={id}>
        <div className={`cfw-node${page && page.id === openId ? " current" : ""}`} style={{ paddingLeft: 8 + depth * 16 }}>
          <button
            type="button"
            className={`cfw-caret${node.children.length ? "" : " empty"}${isFolded ? "" : " open"}`}
            onClick={() => setFolded((prev) => ({ ...prev, [id]: !prev[id] }))}
            aria-label={isFolded ? "펼치기" : "접기"}
            tabIndex={node.children.length ? 0 : -1}
          >
            <CaretIcon />
          </button>
          <button type="button" className="cfw-node-label" onClick={() => (page ? setOpenId(page.id) : setFolded((prev) => ({ ...prev, [id]: !prev[id] })))}>
            {page ? <PageIcon /> : <FolderIcon />}
            <span>{node.label}</span>
          </button>
          {page && picked.has(page.id) && <span className="cfw-picked-mark" title="자료로 선택됨"><CheckIcon /></span>}
        </div>
        {node.children.length > 0 && !isFolded && <ul>{node.children.map((c) => renderNode(spaceKey, c, depth + 1))}</ul>}
      </li>
    );
  };

  const body = openId ? bodies[openId] : undefined;

  return (
    <div className="cfw">
      <header className="cfw-topbar">
        <div className="cfw-logo"><LogoMark /> <strong>컨플루언스</strong></div>
        <nav className="cfw-topnav" aria-label="메뉴">
          <span>스페이스</span>
          <span>최근 항목</span>
          <span className="cfw-create">만들기</span>
        </nav>
        <button type="button" className="cfw-search-trigger" onClick={() => setModalOpen(true)}>
          <SearchIcon /> 페이지 검색
        </button>
        <div className="cfw-topbar-right">
          <button type="button" className="cfw-btn outline" onClick={() => setModalOpen(true)}>페이지 고르기</button>
          <button type="button" className="cfw-btn primary small" disabled={!picked.items.length || sending} onClick={send}>
            {sending ? "보내는 중…" : `AMIGO 로 보내기${picked.items.length ? ` (${picked.items.length})` : ""}`}
          </button>
          <button type="button" className="cfw-close" onClick={onClose}>이 탭 닫기</button>
          <span className="cfw-avatar" aria-hidden="true">김</span>
        </div>
      </header>
      <div className="cfw-mockbar">가상 컨플루언스예요. 실제 컨플루언스가 아니라 예시 데이터로 보여 줘요.</div>

      <div className="cfw-body">
        <aside className="cfw-sidebar">
          <div className="cfw-side-title">스페이스</div>
          {!all && !loadError && <p className="cfw-side-note">불러오는 중…</p>}
          {spaces.map((space) => {
            const tree = buildTree(pages.filter((p) => p.space_key === space.key));
            return (
              <section key={space.key} className="cfw-space">
                <div className="cfw-space-head"><SpaceIcon spaceKey={space.key} /> <strong>{space.name}</strong></div>
                <ul className="cfw-tree">{tree.map((node) => renderNode(space.key, node, 0))}</ul>
              </section>
            );
          })}
        </aside>

        <main className="cfw-main">
          {loadError && <p className="cfw-alert" role="alert">{loadError}</p>}
          {warning && <p className="cfw-alert" role="alert">{warning}</p>}
          {current ? (
            <article className="cfw-article">
              <div className="cfw-article-bar">
                <nav className="cfw-crumbs" aria-label="경로">
                  {[current.space_name, ...current.ancestors].map((part, index) => (
                    <span key={`${part}-${index}`}>{part}<i>/</i></span>
                  ))}
                </nav>
                <button type="button" className={`cfw-pick${picked.has(current.id) ? " on" : ""}`} onClick={() => picked.toggle(toItem(current))} aria-pressed={picked.has(current.id)}>
                  {picked.has(current.id) ? <><CheckIcon /> 선택됨</> : "자료로 선택"}
                </button>
              </div>
              <h1>{current.title}</h1>
              <div className="cfw-byline">
                <span className="cfw-avatar small" aria-hidden="true">{current.author.charAt(0)}</span>
                <span>{current.author}</span>
                <span>·</span>
                <span>{longDate(current.updated_at)}에 수정</span>
                <span>·</span>
                <span>버전 {current.version}</span>
              </div>
              <div className="cfw-content">
                {body === undefined ? <p className="cfw-note">본문을 불러오는 중…</p> : <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>}
              </div>
              {current.labels.length > 0 && (
                <div className="cfw-article-labels">
                  <span>라벨</span>
                  {current.labels.map((label) => (
                    <span key={label} className="cfw-label">{label}</span>
                  ))}
                </div>
              )}
            </article>
          ) : (
            <p className="cfw-note">{all ? "왼쪽에서 페이지를 선택해 주세요." : "불러오는 중…"}</p>
          )}
        </main>
      </div>

      {modalOpen && <SearchModal picked={picked} sending={sending} onSubmit={send} onClose={() => setModalOpen(false)} />}

      {toast && (
        <div className="cfw-toast" role="status">
          <CheckIcon /> {toast}
        </div>
      )}
    </div>
  );
}
