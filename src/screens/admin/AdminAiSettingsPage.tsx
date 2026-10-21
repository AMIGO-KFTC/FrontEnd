// AI 맞춤 설정(관리자). 팀 전용 프롬프트 하나만 둔다.
// 여기에 적은 글은 BackEnd 에 소속(부서 + 팀) 단위로 저장되고(PUT /api/team-guidelines/me 의 prompt),
// 그 소속 팀원들이 만드는 인수인계서의 AI 분석·질의응답 프롬프트에 '팀 전용 프롬프트' 로 들어간다.
// 이미 분석을 마친 작업은 다시 분석할 때부터 반영된다.
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { Icon } from "@/shared/Icon";
import type { TeamGuidelines } from "@/shared/types";

const MAX_PROMPT = 2000;

const PLACEHOLDER = `예)
당신은 우리 팀의 인수인계서 작성을 돕는 AI입니다.
팀에서 쓰는 업무 용어와 운영 절차를 기준으로 정리하고, 모든 안내는 실행할 수 있는 단계로 적으세요.
담당자, 일정, 시스템 권한, 예외 대응 절차가 빠지지 않았는지 먼저 확인하세요.`;

function savedAt(value: string | null): string {
  if (!value) return "";
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AdminAiSettingsPage() {
  const [loaded, setLoaded] = useState<TeamGuidelines | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const baseline = useRef("");

  useEffect(() => {
    let cancelled = false;
    api
      .teamGuidelines()
      .then((data) => {
        if (cancelled) return;
        setLoaded(data);
        setPrompt(data.prompt);
        baseline.current = data.prompt.trim();
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setLoadError(e instanceof ApiError && e.status === 401 ? "로그인이 필요해요. 일반 모드에서 로그인한 뒤 다시 열어 주세요." : e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const editable = loaded?.editable ?? false;
  const dirty = loaded !== null && prompt.trim() !== baseline.current;

  const save = async () => {
    if (!dirty || saving || !editable) return;
    setSaving(true);
    setSaveError(null);
    try {
      // 프롬프트만 보낸다. 서버는 보낸 필드만 바꾸므로 팀 인수인계 항목과 팀 특징은 그대로 남는다.
      const data = await api.saveTeamGuidelines({ prompt: prompt.trim() });
      setLoaded(data);
      setPrompt(data.prompt);
      baseline.current = data.prompt.trim();
      setSavedNotice(data.message || "저장했어요.");
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const statusText = loadError ? "불러오지 못했어요" : !loaded ? "불러오는 중…" : dirty ? "저장하지 않은 변경이 있어요" : "서버에 저장됨";

  return (
    <div className="admin-ai-page">
      <section className="members-page-title">
        <div>
          <span><Icon name="sparkle" size={13} /> TEAM AI CONFIGURATION</span>
          <h1>AI 맞춤 설정</h1>
          <p>팀 전용 프롬프트를 적어 두면, 우리 팀원들이 만드는 인수인계서에 반영돼요.</p>
        </div>
        <div className="ai-settings-status"><i /><span>{loaded ? `${loaded.organization} · ${statusText}` : statusText}</span></div>
      </section>

      {loadError && <p className="team-items-alert" role="alert">{loadError}</p>}

      {loaded && (
        <div className="ai-settings-layout single">
          <div className="ai-settings-form">
            {!editable && (
              <p className="team-items-alert info" role="status"><Icon name="shield" size={12} /> 이 계정은 팀 전용 프롬프트를 수정할 수 없어요. 관리자에게 요청해 주세요. 내용은 볼 수 있어요.</p>
            )}

            <section className="ai-settings-card prompt-card">
              <header>
                <span><Icon name="message" size={16} /></span>
                <div><small>SYSTEM PROMPT</small><h2>팀 전용 프롬프트</h2><p>AI가 우리 팀의 인수인계서를 만들 때 항상 따라야 하는 역할과 판단 기준을 적어 주세요.</p></div>
              </header>
              <div className="system-prompt-editor">
                <div><span>시스템 지침</span><small>{prompt.length} / {MAX_PROMPT.toLocaleString("ko-KR")}</small></div>
                <textarea
                  value={prompt}
                  maxLength={MAX_PROMPT}
                  disabled={!editable}
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    setSavedNotice(null);
                    setSaveError(null);
                  }}
                  placeholder={PLACEHOLDER}
                />
                <footer><span><Icon name="shield" size={12} /> 인수인계서에는 근거 자료에 있는 내용만 들어가요. 비밀번호·계정 같은 민감 정보는 적지 마세요.</span></footer>
              </div>
              <p className="team-prompt-scope">
                같은 소속({loaded.organization})의 모든 팀원이 만드는 인수인계서의 AI 분석과 질의응답에 반영돼요. 저장한 뒤 새로 시작하는 분석부터 적용되고, 이미 분석한 작업은 다시 분석할 때 적용돼요.
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
                  <span>아직 저장한 프롬프트가 없어요.</span>
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
