// 팀 인수인계서 항목(관리자). 우리 팀 인수인계서에 꼭 들어가야 하는 항목과 팀의 특징·작성 지침을 적는다.
// 값은 BackEnd 에 소속(부서 + 팀) 단위로 저장되고(GET·PUT /api/team-guidelines/me), 그 소속의 인수인계 세션이 AI 분석을 시작할 때
// AI 프롬프트(장별 분석·질의응답)에 '우리 팀 인수인계서 지침' 으로 들어간다. 이미 분석을 마친 작업은 다시 분석할 때부터 반영된다.
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { Icon } from "@/shared/Icon";
import type { TeamGuidelines } from "@/shared/types";

type Row = { key: string; id: string; name: string; instruction: string };

const MAX_ITEMS = 30;
const MAX_NAME = 100;
const MAX_INSTRUCTION = 500;
const MAX_NOTES = 2000;

// 자주 쓰는 항목은 눌러서 바로 추가할 수 있게 예시를 둔다.
const SUGGESTIONS: { name: string; instruction: string }[] = [
  { name: "외주 관리", instruction: "업체명, 계약 기간, 월 금액, 담당자 연락처" },
  { name: "라이선스", instruction: "제품명, 만료일, 갱신 방법, 결제 부서" },
  { name: "보안 점검", instruction: "점검 주기, 점검 항목, 마지막 점검일, 후속 조치" },
  { name: "장애 대응", instruction: "장애 등급, 연락 체계, 대응 절차, 최근 장애 이력" },
  { name: "예산·정산", instruction: "예산 항목, 집행 시기, 정산 방법, 결재선" },
  { name: "개인정보 처리", instruction: "처리 업무, 보유 기간, 파기 절차, 접근 권한" },
];

let rowCounter = 0;
const newKey = () => `row-${(rowCounter += 1)}`;
const toRow = (item: { id: string; name: string; instruction: string }): Row => ({ key: newKey(), ...item });
const normalize = (rows: Row[], notes: string) => JSON.stringify({ items: rows.map(({ id, name, instruction }) => ({ id, name: name.trim(), instruction: instruction.trim() })), notes: notes.trim() });

function savedAt(value: string | null): string {
  if (!value) return "";
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AdminTeamItemsPage() {
  const [loaded, setLoaded] = useState<TeamGuidelines | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const baseline = useRef("");

  const apply = (data: TeamGuidelines) => {
    const nextRows = data.items.map(toRow);
    setLoaded(data);
    setRows(nextRows);
    setNotes(data.notes);
    baseline.current = normalize(nextRows, data.notes);
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

  const dirty = loaded !== null && normalize(rows, notes) !== baseline.current;
  const editable = loaded?.editable ?? false;
  const blankNames = rows.some((row) => !row.name.trim());
  const used = useMemo(() => new Set(rows.map((row) => row.name.trim().toLowerCase())), [rows]);

  const touch = () => {
    setSavedNotice(null);
    setSaveError(null);
  };
  const update = (key: string, patch: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    touch();
  };
  const add = (name = "", instruction = "") => {
    if (rows.length >= MAX_ITEMS) return;
    setRows((current) => [...current, { key: newKey(), id: "", name, instruction }]);
    touch();
  };
  const remove = (key: string) => {
    setRows((current) => current.filter((row) => row.key !== key));
    touch();
  };

  const save = async () => {
    if (!dirty || saving || !editable) return;
    if (blankNames) {
      setSaveError("이름이 비어 있는 항목이 있어요.\n이름을 적거나 항목을 지워 주세요.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const data = await api.saveTeamGuidelines({
        items: rows.map((row) => ({ id: row.id, name: row.name.trim(), instruction: row.instruction.trim() })),
        notes: notes.trim(),
      });
      apply(data);
      setSavedNotice(data.message || "저장했어요.");
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const statusText = loadError ? "불러오지 못했어요" : !loaded ? "불러오는 중…" : dirty ? "저장하지 않은 변경이 있어요" : "서버에 저장됨";

  return (
    <div className="admin-ai-page team-items-page">
      <section className="members-page-title">
        <div>
          <h1>팀 인수인계서 항목</h1>
          <p>우리 팀 인수인계서에 담을 항목과 팀의 특징을 적어 두면, AI 가 자료를 분석하고 정리할 때 반영해요.{"\n"}적지 않은 내용은 AI 가 따로 챙기지 않아요.</p>
        </div>
        <div className="ai-settings-status"><i /><span>{loaded ? `${loaded.organization} · ${statusText}` : statusText}</span></div>
      </section>

      {loadError && <p className="team-items-alert" role="alert">{loadError}</p>}

      {loaded && (
        <div className="ai-settings-layout">
          <div className="ai-settings-form">
            {!editable && (
              <p className="team-items-alert info" role="status"><Icon name="shield" size={12} /> 이 계정은 팀 지침을 수정할 수 없어요.{"\n"}관리자에게 요청해 주세요. 내용은 볼 수 있어요.</p>
            )}

            <section className="ai-settings-card">
              <header>
                <span><Icon name="check" size={16} /></span>
                <div><h2>우리 팀 인수인계서 항목</h2><p>팀의 인수인계서에 담을 내용을 항목으로 적어 주세요.{"\n"}올린 자료에 있으면 AI 가 이 이름으로 정리하고, 자료에 없으면 비워 둬요.</p></div>
              </header>
              <div className="team-items-body">
                {rows.length === 0 && <p className="team-items-empty">아직 적은 항목이 없어요.{"\n"}아래 예시를 누르거나 '항목 추가'로 시작해 보세요.</p>}
                <ul className="team-items-list">
                  {rows.map((row, index) => (
                    <li key={row.key}>
                      <div className="team-item-top">
                        <span className="team-item-no">{index + 1}</span>
                        <input
                          value={row.name}
                          maxLength={MAX_NAME}
                          disabled={!editable}
                          onChange={(event) => update(row.key, { name: event.target.value })}
                          placeholder="항목 이름 (예: 외주 관리)"
                          aria-label={`${index + 1}번 항목 이름`}
                        />
                        <button type="button" className="team-item-remove" disabled={!editable} onClick={() => remove(row.key)} aria-label={`${row.name || `${index + 1}번`} 항목 삭제`}>
                          <Icon name="close" size={13} />
                        </button>
                      </div>
                      <textarea
                        value={row.instruction}
                        maxLength={MAX_INSTRUCTION}
                        disabled={!editable}
                        onChange={(event) => update(row.key, { instruction: event.target.value })}
                        placeholder="무엇을 적어야 하나요? (예: 업체명, 계약 기간, 월 금액)"
                        aria-label={`${index + 1}번 항목 작성 안내`}
                        rows={2}
                      />
                    </li>
                  ))}
                </ul>
                <div className="team-items-actions">
                  <button type="button" className="team-items-add" disabled={!editable || rows.length >= MAX_ITEMS} onClick={() => add()}>+ 항목 추가</button>
                  <span>{rows.length} / {MAX_ITEMS}개</span>
                </div>
                <div className="team-items-suggest">
                  <small>자주 쓰는 항목</small>
                  <div>
                    {SUGGESTIONS.filter((s) => !used.has(s.name.toLowerCase())).map((s) => (
                      <button key={s.name} type="button" disabled={!editable || rows.length >= MAX_ITEMS} onClick={() => add(s.name, s.instruction)} title={s.instruction}>+ {s.name}</button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="ai-settings-card prompt-card">
              <header>
                <span><Icon name="message" size={16} /></span>
                <div><h2>팀 특징·작성 지침</h2><p>우리 팀만의 업무 특성, 용어, 표기 방식, 특히 챙길 점을 자유롭게 적어 주세요.</p></div>
              </header>
              <div className="system-prompt-editor">
                <div><span>팀 특징</span><small>{notes.length} / {MAX_NOTES.toLocaleString("ko-KR")}</small></div>
                <textarea
                  value={notes}
                  maxLength={MAX_NOTES}
                  disabled={!editable}
                  onChange={(event) => {
                    setNotes(event.target.value);
                    touch();
                  }}
                  placeholder={"예)\n- 우리 팀은 매주 월요일에 보도자료를 낸다.\n- 외주 업체 이름은 계약서 상호 그대로 적는다.\n- 장애 대응 연락처는 반드시 담당자 직통 번호까지 적는다."}
                />
                <footer><span><Icon name="shield" size={12} /> 비밀번호·계정 같은 민감 정보는 적지 마세요.{"\n"}AI 는 자료에 근거가 있는 내용만 인수인계서에 넣어요.</span></footer>
              </div>
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
                  <span>아직 저장한 지침이 없어요.</span>
                )}
              </div>
              <button type="button" disabled={!dirty || saving || !editable} onClick={save}><Icon name="check" size={14} /> {saving ? "저장하는 중…" : "저장"}</button>
            </div>
          </div>

          <aside className="ai-preview-panel team-prompt-panel">
            <header><div><h2>AI 에 전달되는 내용</h2></div><em>{dirty ? "저장 전" : "저장됨"}</em></header>
            <div className="team-prompt-body">
              {loaded.prompt_preview ? (
                <pre>{loaded.prompt_preview}</pre>
              ) : (
                <p className="team-prompt-empty">저장된 지침이 없어서 AI 에는 아무것도 추가되지 않아요.</p>
              )}
            </div>
            <p className="ai-preview-note team-prompt-note">
              <Icon name="shield" size={12} />
              {dirty ? "저장하면 이 내용이 갱신돼요.\n" : ""}저장한 뒤 새로 시작하는 AI 분석부터 반영돼요.{"\n"}이미 분석한 작업은 다시 분석할 때 적용돼요.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
