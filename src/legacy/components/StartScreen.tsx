// 첫 화면: 인계자 기초 정보 등록 + 이전 작업 이어하기
import { ArrowRight, Clock, FileSearch, MessagesSquare, ScrollText, Trash2, Wand2 } from "lucide-react";
import { UsageSummary } from "./UsageBadge";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../shared/api";
import type { SessionCreate, SessionSummary, UsageTotal } from "../../shared/types";

const STAGE_LABEL: Record<string, string> = {
  setup: "자료 등록",
  analyzing: "분석 중",
  summary: "요약",
  qna: "질의응답",
  composing: "문서 작성 중",
  review: "문서 완성",
};

const EMPTY: SessionCreate = { owner_name: "", organization: "", position: "", duties: "", successor: "", handover_date: "" };
const DEMO: SessionCreate = {
  owner_name: "김민수",
  organization: "디지털전략부 웹서비스팀",
  position: "과장",
  duties: "기관 홈페이지 운영, 웹 접근성 관리, 유지보수 계약 관리",
  successor: "이서연 대리",
  handover_date: "2026-10-15",
};

interface Props {
  onOpen: (id: string) => void;
  onError: (message: string) => void;
}

export function StartScreen({ onOpen, onError }: Props) {
  const [form, setForm] = useState<SessionCreate>(EMPTY);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [usage, setUsage] = useState<UsageTotal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.listSessions().then(setSessions).catch((e: Error) => onError(e.message));
    api.usage().then(setUsage).catch(() => setUsage(null));
  }, [onError]);

  const update = (key: keyof SessionCreate) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.owner_name.trim()) return;
    setSubmitting(true);
    try {
      const created = await api.createSession(form);
      onOpen(created.id);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (session: SessionSummary) => {
    if (!window.confirm(`'${session.title}' 작업을 삭제할까요? 올린 자료와 대화 기록이 모두 지워집니다.`)) return;
    try {
      await api.deleteSession(session.id);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <main className="start">
      <section className="hero">
        <h1>
          업무 자료와 대화로
          <br />
          <em>인수인계서</em>를 완성하세요
        </h1>
        <p className="lead">
          AMIGO 가 업무정의서·회의자료·메일·소스코드를 분석해 인수인계서를 채우고, 비어 있는 부분은 한 번에 하나씩 여쭤봅니다.
        </p>
        <ol className="flow">
          <li>
            <FileSearch size={20} />
            <div>
              <strong>STAGE 1 · 자료 분석</strong>
              <span>PDF, 한글, Word, 메일, 컨플루언스·나누미 링크</span>
            </div>
          </li>
          <li>
            <ScrollText size={20} />
            <div>
              <strong>STAGE 2 · 분석 요약</strong>
              <span>항목별 정보 충족 수준과 부족한 부분</span>
            </div>
          </li>
          <li>
            <MessagesSquare size={20} />
            <div>
              <strong>STAGE 3 · 질의응답</strong>
              <span>AI 질문에 답하고 정리된 내용을 확인</span>
            </div>
          </li>
          <li>
            <Wand2 size={20} />
            <div>
              <strong>STAGE 4 · 문서 생성</strong>
              <span>근거가 표시된 인수인계서, PDF·Word 다운로드</span>
            </div>
          </li>
        </ol>
      </section>

      <section className="panel start-form">
        <header className="panel-head">
          <h2>인계자 기초 정보</h2>
          <button type="button" className="link-btn" onClick={() => setForm(DEMO)}>
            예시 채우기
          </button>
        </header>
        <form onSubmit={submit} className="form">
          <label>
            <span>
              성명 <b className="req">*</b>
            </span>
            <input value={form.owner_name} onChange={update("owner_name")} placeholder="홍길동" required maxLength={50} />
          </label>
          <div className="form-row">
            <label>
              <span>소속 조직</span>
              <input value={form.organization} onChange={update("organization")} placeholder="○○부 ○○팀" maxLength={100} />
            </label>
            <label>
              <span>직책</span>
              <input value={form.position} onChange={update("position")} placeholder="과장" maxLength={50} />
            </label>
          </div>
          <label>
            <span>담당 업무</span>
            <textarea value={form.duties} onChange={update("duties")} rows={3} placeholder="예) 홈페이지 운영, 웹 접근성 관리" maxLength={2000} />
          </label>
          <div className="form-row">
            <label>
              <span>인수자</span>
              <input value={form.successor} onChange={update("successor")} placeholder="인수자 성명·직책" maxLength={100} />
            </label>
            <label>
              <span>인계 예정일</span>
              <input type="date" value={form.handover_date} onChange={update("handover_date")} />
            </label>
          </div>
          <button className="btn primary block" disabled={submitting || !form.owner_name.trim()}>
            인수인계 시작 <ArrowRight size={16} />
          </button>
        </form>

        {usage && <UsageSummary total={usage} />}

        {sessions.length > 0 && (
          <div className="recent">
            <h3>최근 작업</h3>
            <ul>
              {sessions.map((s) => (
                <li key={s.id}>
                  <button className="recent-item" onClick={() => onOpen(s.id)}>
                    <span className="recent-title">{s.title}</span>
                    <span className="recent-meta">
                      <span className={`badge stage-${s.stage}`}>{STAGE_LABEL[s.stage] ?? s.stage}</span>
                      <Clock size={12} /> {new Date(s.updated_at.endsWith("Z") ? s.updated_at : `${s.updated_at}Z`).toLocaleString("ko-KR")}
                    </span>
                  </button>
                  <button className="icon-btn" onClick={() => remove(s)} aria-label={`${s.title} 삭제`}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
