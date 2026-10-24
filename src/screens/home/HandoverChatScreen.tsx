// 인수인계 챗봇: 올린 자료(파일·메일·링크)·인계자 답변·인수인계서를 근거로 질문에 답한다. 인수인계서는 근거 중 하나다. 대화는 이 화면 안에서만 보관한다(서버에 저장하지 않는다).
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

// 선택 상자에 보이는 이름: 업무 · 누구 것 · 근거(올린 자료 수, 인수인계서 버전)
const scopeLabel = (scope: ChatScope) =>
  [scope.title, scope.kind === "mine" ? "내 업무" : `${scope.owner_name} 전달`, scope.source_count ? `자료 ${scope.source_count}건` : "", scope.has_document ? `인수인계서 v${scope.version}` : "인수인계서 작성 전"].filter(Boolean).join(" · ");

export function HandoverChatScreen({ list, initialDocId, onOpenDocument, onHome, onHandover, onDocuments, onReceived, onChat, onLogout }: Props) {
  const [scopes, setScopes] = useState<ChatScope[] | null>(null);
  const [scopesError, setScopesError] = useState<string | null>(null);
  const [scope, setScope] = useState<string>(initialDocId ?? "all"); // "all" 이면 볼 수 있는 모든 업무
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
        setScope((current) => (current === "all" || result.scopes.some((s) => s.id === current) ? current : "all")); // 없어진 업무를 가리키면 전체로
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

  const scoped = scopes && scope !== "all" ? scopes.filter((s) => s.id === scope) : scopes;

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || sending || !scopes?.length) return;
    const history = turns.slice(-HISTORY_TURNS).map(({ role, content }) => ({ role, content }));
    setTurns((current) => [...current, { role: "user", content: question }]);
    setInput("");
    setError(null);
    setSending(true);
    try {
      const result = await api.askHandover(question, history, scope === "all" ? null : [scope]);
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
      <AppSidebar active="chat" sessions={list.sessions} onOpenSession={list.open} onLogout={onLogout} onHome={onHome} onHandover={onHandover} onDocuments={onDocuments} onReceived={onReceived} onChat={() => onChat()} />
      <main className="handover-chat-main">
        <header className="dashboard-header">
          <div><span>MY WORKSPACE</span><strong>인수인계 챗봇</strong></div>
        </header>
        <div className="handover-chat-body">
          <div className="chat-toolbar">
            <label>
              <small>물어볼 업무</small>
              <select value={scope} onChange={(event) => setScope(event.target.value)} disabled={sending || !scopes?.length}>
                <option value="all">모든 업무{scopes ? ` (${scopes.length}건)` : ""}</option>
                {scopes?.map((item) => <option key={item.id} value={item.id}>{scopeLabel(item)}</option>)}
              </select>
            </label>
            {turns.length > 0 && <button className="chat-clear" onClick={() => { setTurns([]); setError(null); }} disabled={sending}>대화 지우기</button>}
          </div>

          <div className="chat-scroll">
            {scopesError && <div className="list-notice error" role="alert">업무 목록을 불러오지 못했어요: {scopesError}<button onClick={loadScopes}>다시 시도</button></div>}
            {empty && <div className="list-notice">질문할 수 있는 자료가 아직 없어요. 자료를 올려 분석하거나 인수인계서를 완성하면, 또는 인계자에게 인수인계서를 전달받으면 여기서 물어볼 수 있어요.</div>}
            {scopes && scopes.length > 0 && turns.length === 0 && (
              <section className="chat-welcome">
                <span><Icon name="sparkle" size={22} /></span>
                <h1>인수인계에 궁금한 걸 물어보세요</h1>
                <p>{scoped?.length === 1 ? `‘${scoped[0].title}’` : `${scoped?.length}개 업무`}의 올린 파일·메일·링크, 인계자 답변, 인수인계서에 적힌 내용만 근거로 답해 드려요. 자료에 없는 내용은 없다고 말씀드릴게요.</p>
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
                            <small>{group.kind === "mine" ? "내 업무" : `${group.owner} 인계자가 전달`}</small>
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
                disabled={!scopes?.length}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
              />
              <button type="submit" disabled={sending || !input.trim() || !scopes?.length} aria-label="질문 보내기"><Icon name="send" size={16} /></button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
