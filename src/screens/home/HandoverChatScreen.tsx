// 인수인계 챗봇: 올린 자료(파일·메일·링크)·인계자 답변·인수인계서를 근거로 질문에 답한다. 인수인계서는 근거 중 하나다. 대화는 이 화면 안에서만 보관한다(서버에 저장하지 않는다).
// 물어볼 범위는 '보낸 인수인계'(내가 인계자로 쓴 것)와 '받은 인수인계'를 탭으로 나누고, 고르기 창에서 제목·업무·인계자·받는 사람으로 검색해 여러 건을 고른다.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/shared/api";
import { AppSidebar } from "@/shared/AppSidebar";
import { Icon } from "@/shared/Icon";
import type { ChatScope, ChatSource, ChatSourceKind } from "@/shared/types";
import type { HomeNav, SessionList } from "./types";

type Turn = { role: "user" | "assistant"; content: string; sources?: ChatSource[]; grounded?: boolean };

const KIND_LABEL: Record<ChatSourceKind, string> = { document: "인수인계서", answer: "인계자 답변", mail: "메일", link: "링크", file: "파일", note: "메모" };

const SUGGESTIONS = ["정기적으로 하는 업무와 주기를 알려 주세요.", "담당자와 연락처가 어떻게 되나요?", "가장 먼저 확인해야 할 일정은 무엇인가요?", "주의해야 할 점이나 후임자에게 바라는 것이 있나요?"];
const HISTORY_TURNS = 8; // 꼬리 질문을 이해하는 데 서버에 함께 보내는 앞선 대화 수

// 답변에 쓴 근거 자료를 참조한 업무별로 묶는다(업무가 처음 나온 순서대로).
function groupByScope(sources: ChatSource[]) {
  const groups: { scopeId: string; task: string; kind: "mine" | "received"; owner: string; sources: ChatSource[] }[] = [];
  for (const source of sources) {
    let group = groups.find((g) => g.scopeId === source.scope_id);
    if (!group) {
      group = { scopeId: source.scope_id, task: source.scope_task || source.scope_title, kind: source.scope_kind, owner: source.scope_owner, sources: [] };
      groups.push(group);
    }
    group.sources.push(source);
  }
  return groups;
}

type Props = HomeNav & { list: SessionList; initialDocId?: string; onOpenDocument: (sessionId: string) => void };

type ScopeTab = "all" | "mine" | "received";
const TAB_LABEL: Record<ScopeTab, string> = { all: "전체", mine: "보낸 인수인계", received: "받은 인수인계" };
const MAX_SCOPE_IDS = 50; // 서버가 한 번에 받는 질문 범위 수

// 고르기 창 한 줄의 보조 설명: 누구에게 보냈는지(또는 누가 보냈는지) · 근거(올린 자료 수, 인수인계서 버전)
const scopeMeta = (scope: ChatScope) =>
  [
    scope.kind === "mine" ? (scope.recipients?.length ? `받는 사람 ${scope.recipients.join(", ")}` : "아직 보내지 않음") : `인계자 ${scope.owner_name}`,
    scope.source_count ? `자료 ${scope.source_count}건` : "",
    scope.has_document ? `인수인계서 v${scope.version}` : "인수인계서 작성 전",
  ].filter(Boolean).join(" · ");

const scopeDuties = (scope: ChatScope) => (scope.duties?.length ? scope.duties : [scope.task_name || scope.title]);

function matches(scope: ChatScope, keyword: string): boolean {
  if (!keyword) return true;
  return [scope.title, scope.task_name, scope.owner_name, ...scopeDuties(scope), ...(scope.recipients ?? [])].some((text) => text?.toLowerCase().includes(keyword));
}

export function HandoverChatScreen({ list, initialDocId, onOpenDocument, onHome, onHandover, onDocuments, onReceived, onChat, onCalendar, onMaterials, onLogout }: Props) {
  const [scopes, setScopes] = useState<ChatScope[] | null>(null);
  const [scopesError, setScopesError] = useState<string | null>(null);
  const [tab, setTab] = useState<ScopeTab>("all");
  const [picked, setPicked] = useState<string[]>(initialDocId ? [initialDocId] : []); // 비어 있으면 지금 탭의 모든 인수인계
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadScopes = () => {
    setScopesError(null);
    api
      .chatScopes()
      .then((result) => {
        setScopes(result.scopes);
        setPicked((current) => current.filter((id) => result.scopes.some((s) => s.id === id))); // 없어진 업무는 고른 목록에서 뺀다
      })
      .catch((e: Error) => {
        setScopes(null);
        setScopesError(e.message);
      });
  };
  useEffect(() => {
    loadScopes();
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, sending]);

  // 고르기 창 바깥을 누르거나 Esc 를 누르면 닫는다
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (event: MouseEvent) => !pickerRef.current?.contains(event.target as Node) && setPickerOpen(false);
    const onKey = (event: globalThis.KeyboardEvent) => event.key === "Escape" && setPickerOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  const inTab = (item: ChatScope) => tab === "all" || item.kind === tab;
  const tabScopes = scopes?.filter(inTab) ?? [];
  const count = (kind: ScopeTab) => (scopes ? scopes.filter((item) => kind === "all" || item.kind === kind).length : 0);
  const keyword = query.trim().toLowerCase();
  const candidates = tabScopes.filter((item) => matches(item, keyword));
  const pickedScopes = scopes?.filter((item) => picked.includes(item.id)) ?? [];
  const scoped = pickedScopes.length ? pickedScopes : tabScopes;
  // 서버에 보낼 범위: 고른 것, 없으면 지금 탭 전체(전체 탭이면 null = 볼 수 있는 모든 업무)
  const scopeIds = pickedScopes.length ? pickedScopes.map((item) => item.id) : tab === "all" ? null : tabScopes.slice(0, MAX_SCOPE_IDS).map((item) => item.id);
  const switchTab = (next: ScopeTab) => {
    setTab(next);
    setPicked([]);
  };
  const togglePick = (id: string) => setPicked((current) => (current.includes(id) ? current.filter((x) => x !== id) : current.length >= MAX_SCOPE_IDS ? current : [...current, id]));
  const scopeSummary = pickedScopes.length
    ? pickedScopes.length === 1 ? pickedScopes[0].title : `${pickedScopes[0].title} 외 ${pickedScopes.length - 1}건`
    : `${TAB_LABEL[tab]} 모두 (${tabScopes.length}건)`;

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || sending || !scoped.length) return;
    const history = turns.slice(-HISTORY_TURNS).map(({ role, content }) => ({ role, content }));
    setTurns((current) => [...current, { role: "user", content: question }]);
    setInput("");
    setError(null);
    setSending(true);
    try {
      const result = await api.askHandover(question, history, scopeIds);
      setTurns((current) => [...current, { role: "assistant", content: result.answer, sources: result.sources, grounded: result.grounded }]);
    } catch (e) {
      setTurns((current) => current.slice(0, -1)); // 답을 못 받은 질문은 대화에서 빼고 입력창에 되돌려 다시 보낼 수 있게 한다
      setInput(question);
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(input);
    }
  };

  const empty = scopes !== null && scopes.length === 0;

  return (
    <div className="app-shell handover-chat-page">
      <AppSidebar active="chat" sessions={list.sessions} onOpenSession={list.open} onLogout={onLogout} onHome={onHome} onHandover={onHandover} onDocuments={onDocuments} onReceived={onReceived} onChat={() => onChat()} onCalendar={onCalendar} onMaterials={onMaterials} />
      <main className="handover-chat-main">
        <header className="dashboard-header">
          <div><strong>인수인계 챗봇</strong></div>
        </header>
        <div className="handover-chat-body">
          <div className="chat-toolbar">
            <div className="chat-scope-tabs" role="tablist" aria-label="물어볼 인수인계 구분">
              {(["all", "mine", "received"] as const).map((kind) => (
                <button key={kind} role="tab" aria-selected={tab === kind} className={tab === kind ? "active" : ""} onClick={() => switchTab(kind)} disabled={sending}>
                  {TAB_LABEL[kind]}<small>{scopes ? count(kind) : "—"}</small>
                </button>
              ))}
            </div>
            {turns.length > 0 && <button className="chat-clear" onClick={() => { setTurns([]); setError(null); }} disabled={sending}>대화 지우기</button>}
          </div>
          <div className="chat-scope-picker" ref={pickerRef}>
            <button type="button" className="chat-scope-trigger" onClick={() => setPickerOpen((open) => !open)} disabled={sending || !tabScopes.length} aria-expanded={pickerOpen}>
              <small>물어볼 인수인계</small>
              <strong>{scopes ? scopeSummary : "불러오는 중…"}</strong>
              <Icon name="search" size={14} />
            </button>
            {pickedScopes.length > 0 && (
              <div className="chat-scope-chips">
                {pickedScopes.map((item) => (
                  <span key={item.id}>{item.title}<button type="button" onClick={() => togglePick(item.id)} aria-label={`${item.title} 빼기`} disabled={sending}><Icon name="close" size={11} /></button></span>
                ))}
                <button type="button" className="chat-scope-reset" onClick={() => setPicked([])} disabled={sending}>모두 빼기</button>
              </div>
            )}
            {pickerOpen && (
              <div className="chat-scope-panel" role="dialog" aria-label="물어볼 인수인계 고르기">
                <label className="chat-scope-search">
                  <Icon name="search" size={14} />
                  <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "mine" ? "제목·업무·받는 사람으로 검색" : tab === "received" ? "제목·업무·인계자로 검색" : "제목·업무·인계자·받는 사람으로 검색"} aria-label="인수인계 검색" />
                  {query && <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기"><Icon name="close" size={12} /></button>}
                </label>
                <ul>
                  {candidates.length === 0 && <li className="chat-scope-none">조건에 맞는 인수인계가 없어요.</li>}
                  {candidates.map((item) => {
                    const on = picked.includes(item.id);
                    return (
                      <li key={item.id}>
                        <button type="button" className={on ? "picked" : ""} aria-pressed={on} onClick={() => togglePick(item.id)}>
                          <span className="chat-scope-check">{on && <Icon name="check" size={11} />}</span>
                          <span className="chat-scope-text">
                            <strong>{item.title}{tab === "all" && <em className={item.kind}>{item.kind === "mine" ? "보냄" : "받음"}</em>}</strong>
                            <small>{scopeMeta(item)}</small>
                            {scopeDuties(item).length > 1 && <span className="chat-scope-duties">{scopeDuties(item).map((duty) => <i key={duty}>{duty}</i>)}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <footer>
                  <span>{picked.length ? `${picked.length}건 고름` : `고르지 않으면 ${TAB_LABEL[tab]} 모두에게 물어봐요`}</span>
                  {candidates.length > 1 && <button type="button" onClick={() => setPicked((current) => [...new Set([...current, ...candidates.map((item) => item.id)])].slice(0, MAX_SCOPE_IDS))}>검색 결과 모두 고르기</button>}
                  <button type="button" className="primary" onClick={() => setPickerOpen(false)}>완료</button>
                </footer>
              </div>
            )}
          </div>

          <div className="chat-scroll">
            {scopesError && <div className="list-notice error" role="alert">업무 목록을 불러오지 못했어요: {scopesError}<button onClick={loadScopes}>다시 시도</button></div>}
            {empty && <div className="list-notice">질문할 수 있는 자료가 아직 없어요.{"\n"}자료를 올려 분석하거나 인수인계서를 완성하면, 또는 인계자에게 인수인계서를 전달받으면 여기서 물어볼 수 있어요.</div>}
            {scopes && scopes.length > 0 && tabScopes.length === 0 && turns.length === 0 && <div className="list-notice">{tab === "mine" ? "아직 내가 쓴 인수인계서가 없어요." : "아직 받은 인수인계서가 없어요."}</div>}
            {scopes && scoped.length > 0 && turns.length === 0 && (
              <section className="chat-welcome">
                <span><Icon name="sparkle" size={22} /></span>
                <h1>인수인계에 궁금한 걸 물어보세요</h1>
                <p>{scoped.length === 1 ? `‘${scoped[0].title}’` : `${scoped.length}개 인수인계서`}의 올린 파일·메일·링크, 인계자 답변, 인수인계서에 적힌 내용만 근거로 답해 드려요.{"\n"}자료에 없는 내용은 없다고 말씀드릴게요.</p>
                <div className="chat-suggestions">
                  {SUGGESTIONS.map((text) => <button key={text} onClick={() => void send(text)}>{text}</button>)}
                </div>
              </section>
            )}
            {turns.map((turn, index) => (
              <div className={`chat-turn ${turn.role}`} key={index}>
                {turn.role === "assistant" && <span className="chat-avatar"><Icon name="sparkle" size={14} /></span>}
                <div className="chat-bubble">
                  {turn.role === "user" ? <p>{turn.content}</p> : <div className="chat-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.content}</ReactMarkdown></div>}
                  {turn.role === "assistant" && turn.sources && turn.sources.length > 0 && (
                    <div className="chat-refs">
                      <p className="chat-refs-title"><Icon name="folder" size={13} /> 참조한 업무 {groupByScope(turn.sources).length}건</p>
                      {groupByScope(turn.sources).map((group) => (
                        <section className="chat-ref" key={group.scopeId}>
                          <header>
                            <strong>{group.task}</strong>
                            <small>{group.kind === "mine" ? "보낸 인수인계" : `받은 인수인계 · ${group.owner} 인계자`}</small>
                          </header>
                          <div className="chat-sources">
                            {group.sources.map((source) => {
                              // 인수인계서 칩은 문서를 열고, 올린 파일·메일 칩은 원본을 내려받는다(완성 문서 화면의 '출처'와 같은 API). 인계자 답변은 열 곳이 없다.
                              const doc = source.kind === "document" && source.session_id ? source.session_id : null;
                              const file = (source.kind === "file" || source.kind === "mail") && source.source_id && source.session_id ? api.sourceFileUrl(source.session_id, source.source_id) : null;
                              const text = source.kind === "document" || source.kind === "answer" ? source.label : `${KIND_LABEL[source.kind]} · ${source.label}`;
                              const hint = doc ? "인수인계서 열기" : file ? "원본 내려받기" : "";
                              return (
                                <button key={`${source.kind}|${source.label}`} disabled={!doc && !file} onClick={() => (doc ? onOpenDocument(doc) : file && (window.location.href = file))} title={`${KIND_LABEL[source.kind]} · ${source.label}${hint ? ` — ${hint}` : ""}`}>
                                  <Icon name={source.kind === "answer" ? "message" : file ? "download" : "file"} size={12} /> {text}
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="chat-turn assistant">
                <span className="chat-avatar"><Icon name="sparkle" size={14} /></span>
                <div className="chat-bubble chat-typing" role="status" aria-label="답변을 찾는 중"><i /><i /><i /></div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void send(input); }}>
            {error && <p className="chat-error" role="alert">{error}</p>}
            <div>
              <textarea
                value={input}
                rows={1}
                maxLength={2000}
                placeholder={empty ? "질문할 수 있는 자료가 없어요" : "인수인계에 대해 궁금한 점을 물어보세요  (Enter 전송 · Shift+Enter 줄바꿈)"}
                disabled={!scoped.length}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
              />
              <button type="submit" disabled={sending || !input.trim() || !scoped.length} aria-label="질문 보내기"><Icon name="send" size={16} /></button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
