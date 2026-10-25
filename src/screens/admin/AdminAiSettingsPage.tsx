// AI 팀 맞춤 설정(팀 관리자). AI가 우리 팀원들이 만드는 인수인계서를 쓸 때 참고할 내용을 4단계로 적는다.
//   STEP1 팀 소개(3줄 이내) · STEP2 업무 용어집 · STEP3 팀 업무 문서 업로드 · STEP4 기타 중요 포인트(선택)
// 값은 BackEnd 에 소속(부서 + 팀) 단위로 저장되고(PUT /api/team-guidelines/me 의 intro · glossary · notes, 자료는 POST …/documents),
// 그 소속 팀원들의 인수인계서 AI 분석·질의응답 프롬프트에 들어간다. 이미 분석을 마친 작업은 다시 분석할 때부터 반영된다.
// 직접 프롬프트를 쓰고 싶은 팀을 위해 '고급: 팀 전용 프롬프트'는 접어서 남겨 둔다.
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { Icon } from "@/shared/Icon";
import type { TeamDocument, TeamGlossaryTerm, TeamGuidelines } from "@/shared/types";

const MAX_INTRO = 300;
const MAX_INTRO_LINES = 3;
const MAX_NOTES = 2000;
const MAX_PROMPT = 2000;
const MAX_TERMS = 50;

const INTRO_PLACEHOLDER = "예) 운영기획팀은 결제망 운영계획 수립, 참가기관 관리, 운영 실적 보고를 담당합니다.";
const NOTES_PLACEHOLDER = "예) 우리 팀에서 관리하는 가맹점별 가입 일정 및 해지 일정이 인수인계서에 들어가는 것이 중요합니다.";
const PROMPT_PLACEHOLDER = `예)
당신은 우리 팀의 인수인계서 작성을 돕는 AI입니다.
담당자, 일정, 시스템 권한, 예외 대응 절차가 빠지지 않았는지 먼저 확인하세요.`;

function savedAt(value: string | null): string {
  if (!value) return "";
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

// 비교용: 빈 용어는 저장되지 않으므로 뺀다
const cleanTerms = (terms: TeamGlossaryTerm[]) => terms.map((t) => ({ term: t.term.trim(), meaning: t.meaning.trim() })).filter((t) => t.term);

type Draft = { intro: string; glossary: TeamGlossaryTerm[]; notes: string; prompt: string };
const toDraft = (data: TeamGuidelines): Draft => ({ intro: data.intro, glossary: data.glossary.map((t) => ({ ...t })), notes: data.notes, prompt: data.prompt });

function StepHead({ step, title, hint, optional = false }: { step: number; title: string; hint: string; optional?: boolean }) {
  return (
    <header>
      <span className="ai-step-badge">{step}</span>
      <div><small>STEP {step}{optional ? " · 선택" : ""}</small><h2>{title}</h2><p>{hint}</p></div>
    </header>
  );
}

export function AdminAiSettingsPage() {
  const [loaded, setLoaded] = useState<TeamGuidelines | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ intro: "", glossary: [], notes: "", prompt: "" });
  const [documents, setDocuments] = useState<TeamDocument[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const baseline = useRef<Draft>({ intro: "", glossary: [], notes: "", prompt: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const apply = (data: TeamGuidelines) => {
    setLoaded(data);
    setDraft(toDraft(data));
    setDocuments(data.documents);
    baseline.current = toDraft(data);
    if (data.prompt) setPromptOpen(true);
  };

  useEffect(() => {
    let cancelled = false;
    api
      .teamGuidelines()
      .then((data) => !cancelled && apply(data))
      .catch((e: Error) => {
        if (cancelled) return;
        setLoadError(e instanceof ApiError && e.status === 401 ? "로그인이 필요해요.\n일반 모드에서 로그인한 뒤 다시 열어 주세요." : e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const editable = loaded?.editable ?? false;
  const dirty =
    loaded !== null &&
    (draft.intro.trim() !== baseline.current.intro.trim() ||
      draft.notes.trim() !== baseline.current.notes.trim() ||
      draft.prompt.trim() !== baseline.current.prompt.trim() ||
      JSON.stringify(cleanTerms(draft.glossary)) !== JSON.stringify(cleanTerms(baseline.current.glossary)));

  const change = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setSavedNotice(null);
    setSaveError(null);
  };
  const setTerm = (index: number, patch: Partial<TeamGlossaryTerm>) => change({ glossary: draft.glossary.map((t, i) => (i === index ? { ...t, ...patch } : t)) });

  const save = async () => {
    if (!dirty || saving || !editable) return;
    setSaving(true);
    setSaveError(null);
    try {
      const data = await api.saveTeamGuidelines({ intro: draft.intro.trim(), glossary: cleanTerms(draft.glossary), notes: draft.notes.trim(), prompt: draft.prompt.trim() });
      setLoaded(data);
      setDraft(toDraft(data));
      baseline.current = toDraft(data);
      setSavedNotice(data.message || "저장했어요.");
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const upload = async (files: File[]) => {
    if (!files.length || uploading || !editable) return;
    setUploading(true);
    setDocError(null);
    try {
      await api.uploadTeamDocuments(files);
      setDocuments((await api.teamGuidelines()).documents); // 서버의 최신순 목록으로 다시 맞춘다(저장하지 않은 글은 건드리지 않는다)
    } catch (e) {
      setDocError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };
  const removeDocument = async (doc: TeamDocument) => {
    if (!editable) return;
    setDocError(null);
    try {
      await api.deleteTeamDocument(doc.id);
      setDocuments((current) => current.filter((d) => d.id !== doc.id));
    } catch (e) {
      setDocError((e as Error).message);
    }
  };

  const statusText = loadError ? "불러오지 못했어요" : !loaded ? "불러오는 중…" : dirty ? "저장하지 않은 변경이 있어요" : "서버에 저장됨";

  return (
    <div className="admin-ai-page">
      <section className="members-page-title">
        <div>
          <h1>AI 팀 맞춤 설정</h1>
          <p>AI가 우리 팀원들이 만드는 인수인계서를 만들 때 참고할 수 있는 내용을 작성해 주세요.</p>
        </div>
        <div className="ai-settings-status"><i /><span>{loaded ? `${loaded.organization} · ${statusText}` : statusText}</span></div>
      </section>

      {loadError && <p className="team-items-alert" role="alert">{loadError}</p>}

      {loaded && (
        <div className="ai-settings-layout single">
          <div className="ai-settings-form">
            {!editable && (
              <p className="team-items-alert info" role="status"><Icon name="shield" size={12} /> 이 계정은 팀 맞춤 설정을 수정할 수 없어요.{"\n"}관리자에게 요청해 주세요. 내용은 볼 수 있어요.</p>
            )}

            <section className="ai-settings-card">
              <StepHead step={1} title="팀 소개" hint="우리 팀이 어떤 일을 하는지 3줄 이내로 적어주세요." />
              <div className="system-prompt-editor">
                <div><span>팀 소개</span><small>{draft.intro.length} / {MAX_INTRO}</small></div>
                <textarea
                  rows={3}
                  value={draft.intro}
                  maxLength={MAX_INTRO}
                  disabled={!editable}
                  onChange={(event) => change({ intro: event.target.value.split("\n").slice(0, MAX_INTRO_LINES).join("\n") })}
                  placeholder={INTRO_PLACEHOLDER}
                />
              </div>
            </section>

            <section className="ai-settings-card">
              <StepHead step={2} title="업무 용어집" hint="우리 팀에서 자주 쓰는 용어 및 의미를 등록해 주세요. AI가 인수인계 자료와 질의에 대한 답변을 보다 잘 이해할 수 있어요." />
              <div className="team-items-body">
                {draft.glossary.length === 0 && <p className="team-items-empty">아직 등록한 용어가 없어요.{"\n"}예) 개설기관 : ㅇㅇㅇㅇㅇ한 기관, 대표앱 : ㅇㅇㅇㅇ 앱</p>}
                {draft.glossary.length > 0 && (
                  <ul className="ai-glossary-list">
                    {draft.glossary.map((entry, index) => (
                      <li key={index}>
                        <input value={entry.term} maxLength={60} disabled={!editable} onChange={(event) => setTerm(index, { term: event.target.value })} placeholder="용어 (예: 개설기관)" aria-label={`용어 ${index + 1}`} />
                        <input value={entry.meaning} maxLength={300} disabled={!editable} onChange={(event) => setTerm(index, { meaning: event.target.value })} placeholder="의미 (예: ㅇㅇㅇㅇㅇ한 기관)" aria-label={`용어 ${index + 1}의 의미`} />
                        <button type="button" disabled={!editable} onClick={() => change({ glossary: draft.glossary.filter((_, i) => i !== index) })} aria-label={`${entry.term || "용어"} 삭제`}><Icon name="close" size={13} /></button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="team-items-actions">
                  <button type="button" className="team-items-add" disabled={!editable || draft.glossary.length >= MAX_TERMS} onClick={() => change({ glossary: [...draft.glossary, { term: "", meaning: "" }] })}>+ 용어 추가</button>
                  <span>{draft.glossary.length} / {MAX_TERMS}</span>
                </div>
              </div>
            </section>

            <section className="ai-settings-card">
              <StepHead step={3} title="팀 업무 문서 업로드" hint="팀 공통 업무 자료를 올려주세요. 다만, 수시로 업데이트되는 자료는 가장 최신 자료를 업로드해 주세요. 예) 업무정의서, 업무 설계서, 팀원 업무분장표, 업무 규약 및 시행세칙" />
              <div className="team-items-body">
                <input ref={fileRef} type="file" multiple hidden onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void upload(files); }} />
                {documents.length === 0 && <p className="team-items-empty">아직 올린 문서가 없어요.</p>}
                {documents.length > 0 && (
                  <ul className="ai-doc-list">
                    {documents.map((doc) => (
                      <li key={doc.id}>
                        <span><Icon name="file" size={15} /></span>
                        <div><strong>{doc.name}</strong><small>{fileSize(doc.size)}{doc.uploaded_by ? ` · ${doc.uploaded_by}` : ""}{doc.uploaded_at ? ` · ${savedAt(doc.uploaded_at)}` : ""}</small></div>
                        <button type="button" disabled={!editable} onClick={() => void removeDocument(doc)} aria-label={`${doc.name} 삭제`}><Icon name="close" size={13} /></button>
                      </li>
                    ))}
                  </ul>
                )}
                {docError && <p className="team-items-error">{docError}</p>}
                <div className="team-items-actions">
                  <button type="button" className="team-items-add" disabled={!editable || uploading} onClick={() => fileRef.current?.click()}>{uploading ? "올리는 중…" : "+ 문서 올리기"}</button>
                  <span>올리면 바로 저장돼요 · {documents.length}개</span>
                </div>
              </div>
            </section>

            <section className="ai-settings-card">
              <StepHead step={4} title="기타 중요 포인트" optional hint="AI가 인수인계서를 만들 때 알면 좋은 우리 팀 특이사항이 있다면 적어 주세요. AMIGO가 꼭 확인해야 하는 사항이나 판단 기준을 적으셔도 돼요." />
              <div className="system-prompt-editor">
                <div><span>중요 포인트</span><small>{draft.notes.length} / {MAX_NOTES.toLocaleString("ko-KR")}</small></div>
                <textarea value={draft.notes} maxLength={MAX_NOTES} disabled={!editable} onChange={(event) => change({ notes: event.target.value })} placeholder={NOTES_PLACEHOLDER} />
                <footer><span><Icon name="shield" size={12} /> 인수인계서에는 근거 자료에 있는 내용만 들어가요.{"\n"}비밀번호·계정 같은 민감 정보는 적지 마세요.</span></footer>
              </div>
            </section>

            <section className="ai-settings-card prompt-card">
              <button type="button" className="ai-advanced-toggle" aria-expanded={promptOpen} onClick={() => setPromptOpen(!promptOpen)}>
                <Icon name="message" size={14} /> 고급: 팀 전용 프롬프트 직접 쓰기 <span>{promptOpen ? "접기" : "펼치기"}</span>
              </button>
              {promptOpen && (
                <div className="system-prompt-editor">
                  <div><span>시스템 지침</span><small>{draft.prompt.length} / {MAX_PROMPT.toLocaleString("ko-KR")}</small></div>
                  <textarea value={draft.prompt} maxLength={MAX_PROMPT} disabled={!editable} onChange={(event) => change({ prompt: event.target.value })} placeholder={PROMPT_PLACEHOLDER} />
                </div>
              )}
              <p className="team-prompt-scope">
                같은 소속({loaded.organization})의 모든 팀원이 만드는 인수인계서의 AI 분석과 질의응답에 반영돼요.{"\n"}저장한 뒤 새로 시작하는 분석부터 적용되고, 이미 분석한 작업은 다시 분석할 때 적용돼요.
              </p>
            </section>

            <div className="ai-settings-save">
              <div>
                {saveError ? (
                  <span className="team-items-error">{saveError}</span>
                ) : savedNotice ? (
                  <><Icon name="check" size={14} /><span>{savedNotice}</span></>
                ) : loaded.updated_at ? (
                  <span>마지막 저장 {savedAt(loaded.updated_at)}{loaded.updated_by ? ` · ${loaded.updated_by}` : ""}</span>
                ) : (
                  <span>아직 저장한 내용이 없어요.</span>
                )}
              </div>
              <button type="button" disabled={!dirty || saving || !editable} onClick={save}><Icon name="check" size={14} /> {saving ? "저장하는 중…" : "저장"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
