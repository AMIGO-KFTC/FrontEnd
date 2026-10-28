// STEP 01 기본 정보. 유형은 앞 화면(HandoverTypeScreen)에서 고른 값을 받는다. 성명·소속·직책은 로그인한 사용자 프로필 값을 그대로 쓰고,
// 인수자는 완성 문서 화면의 '인수자에게 전송하기'에서 고른다.
// 인사발령은 ① 단위 업무 고르기(직제규정 시행세칙의 우리 팀 업무분장 + 팀장이 관리자 화면에서 더한 업무) → ② 단위 업무별 세부업무(정기·비정기) 두 단계로 받는다.
// 장기휴가는 단위 업무를 고르지 않고, 부재 중 처리할 세부업무만 정기·비정기로 나눠 받는다.
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/shared/api";
import { Brand } from "@/shared/Brand";
import { ErrorNote } from "@/shared/ErrorNote";
import { HelpTip } from "@/shared/HelpTip";
import { dutiesText, type StartData } from "@/shared/handover";
import { Icon } from "@/shared/Icon";
import { LeaveSeasideBackground } from "@/shared/LeaveSeasideBackground";
import { useProfile } from "@/shared/profile";
import { StepUserMenu } from "@/shared/StepUserMenu";
import type { HandoverMode, HandoverUnit, OrgDuties } from "@/shared/types";

type Kind = "regular" | "irregular";
const KIND_LABEL: Record<Kind, string> = { regular: "정기 업무", irregular: "비정기 업무" };
// 정기·비정기 업무 옆 (?) 를 가리키면(hover) 뜨는 설명. 마지막 줄이 작성 가이드 문장이다.
const KIND_HELP: Record<Kind, { definition: string; example: string; guide: string }> = {
  regular: {
    definition: "일·월·분기 등 일정한 주기로 반복되거나, 일상적인 운영 및 관리를 위해 지속적으로 수행하는 업무",
    example: "월간 실적 보고, 정산, 데이터 관리, 정기 점검, 상시 문의 대응",
    guide: "일정한 주기를 두고 반복적으로 수행해야 하는 업무를 작성해 주세요.",
  },
  irregular: {
    definition: "특정 목표 달성을 위해 별도로 추진하거나, 수행 기간이나 완료 시점이 정해져 있는 업무",
    example: "신규 시스템 도입, 업무 프로세스 개선, 신규 정책 수립, 신규 서비스 기획",
    guide: "프로젝트, 수시성 업무 등 일정한 주기 없이 수행하는 업무를 작성해 주세요.",
  },
};
function KindHelp({ kind }: { kind: Kind }) {
  const help = KIND_HELP[kind];
  return (
    <HelpTip label={KIND_LABEL[kind]}>
      <strong>{KIND_LABEL[kind]}</strong>
      <p>{help.definition}<em>예: {help.example}</em></p>
      <p className="help-tip-guide">{help.guide}</p>
    </HelpTip>
  );
}

const emptyUnit = (name: string): HandoverUnit => ({ name, regular: [], irregular: [] });
const draftKey = (unitName: string, kind: Kind) => `${unitName}\u0000${kind}`;

// 세부업무 칩 입력칸. Enter(한글 조합 중 Enter 는 글자 확정이라 무시) 또는 '추가'로 칩을 붙이고 × 로 지운다.
function ChipField({ label, items, draft, placeholder, onDraft, onChange }: { label: ReactNode; items: string[]; draft: string; placeholder: string; onDraft: (value: string) => void; onChange: (items: string[]) => void }) {
  const add = () => {
    const next = draft.trim();
    if (!next) return;
    onChange([...items, next]);
    onDraft("");
  };
  return (
    <label className="task-field" onClick={(event) => { if ((event.target as HTMLElement).closest("button")) event.preventDefault(); }}>{label}
      <div className="task-editor">
        <div className="task-list">
          {items.map((item, index) => (
            <span className="task-chip" key={`${item}-${index}`}>{item}<button onClick={() => onChange(items.filter((_, i) => i !== index))} aria-label={`${item} 삭제`}><Icon name="close" size={12} /></button></span>
          ))}
        </div>
        <div className="task-input-row">
          <input
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
          />
          <button onClick={add}>추가</button>
        </div>
      </div>
    </label>
  );
}

type Props = { mode: HandoverMode; onStart: (data: StartData) => void; onLogout: () => void; onHome: () => void; busy?: boolean; error?: string | null };

export function StartScreen({ mode, onStart, onLogout, onHome, busy = false, error = null }: Props) {
  const [profile] = useProfile();
  const [data, setData] = useState<StartData>({ mode, name: profile.name, division: profile.division, team: profile.team, role: profile.role, task: "", date: "", successor: "", successorLoginId: "", leaveStart: "", leaveEnd: "", units: mode === "leave" ? [emptyUnit("")] : [] });
  const [step, setStep] = useState<1 | 2>(1);
  const [drafts, setDrafts] = useState<Record<string, string>>({}); // 세부업무 입력칸에 적어 두고 아직 추가하지 않은 글
  const [customUnits, setCustomUnits] = useState<string[]>([]); // '+ 추가하기'로 직접 넣은 단위 업무
  const [customDraft, setCustomDraft] = useState<string | null>(null); // null 이면 직접 추가 입력칸을 닫아 둔다
  const [unitQuery, setUnitQuery] = useState(""); // 단위 업무가 많을 때 목록 검색어
  const [missing, setMissing] = useState<string[]>([]);
  const [leaveError, setLeaveError] = useState("");
  // 직제규정 시행세칙(본부·부 → 팀 → 단위업무). 못 불러오면 null 로 두고 예전 보기 목록을 쓴다.
  const [org, setOrg] = useState<OrgDuties["divisions"] | null>(null); // null = 불러오는 중이거나 못 불러옴
  useEffect(() => {
    api
      .orgDuties()
      .then((result) => setOrg(result.divisions.length ? result.divisions : null))
      .catch(() => setOrg(null));
  }, []);
  // 팀장이 관리자 화면(팀 담당 업무)에서 더한 우리 팀 업무. 시행세칙 업무분장 뒤에 덧붙인다(못 불러오면 시행세칙만 쓴다).
  const [managerDuties, setManagerDuties] = useState<string[]>([]);
  useEffect(() => {
    api
      .teamDuties()
      .then((result) => setManagerDuties(result.duties.map((duty) => duty.name.trim()).filter(Boolean)))
      .catch(() => setManagerDuties([]));
  }, []);
  const update = (key: "leaveStart" | "leaveEnd", value: string) => setData({ ...data, [key]: value });

  // 우리 팀(프로필의 본부·팀) 단위 업무: 1차로 직제규정 시행세칙 업무분장(본부 이름이 다르면 팀 이름으로만 찾는다), 그다음 팀장이 관리자 화면에서 더한 업무.
  const division = org?.find((d) => d.name === profile.division);
  const orgDuties = org ? ((division ? [division] : org).flatMap((d) => d.teams).find((t) => t.name === profile.team)?.duties ?? []) : [];
  const teamDuties = [...new Set([...orgDuties, ...managerDuties])];
  const unitOptions = [...teamDuties, ...customUnits.filter((name) => !teamDuties.includes(name))];
  const selected = new Set(data.units.map((unit) => unit.name));
  const unitKeyword = unitQuery.trim().toLowerCase();
  const shownUnits = unitOptions.filter((name) => !unitKeyword || name.toLowerCase().includes(unitKeyword) || selected.has(name)); // 고른 업무는 검색어와 상관없이 보인다

  const toggleUnit = (name: string) =>
    setData({ ...data, units: selected.has(name) ? data.units.filter((unit) => unit.name !== name) : [...data.units, emptyUnit(name)] });
  const addCustomUnit = (): HandoverUnit[] => {
    const name = (customDraft ?? "").trim();
    if (!name) return data.units;
    if (!unitOptions.includes(name)) setCustomUnits([...customUnits, name]);
    const units = selected.has(name) ? data.units : [...data.units, emptyUnit(name)];
    setData({ ...data, units });
    setCustomDraft(null);
    return units;
  };

  const setItems = (unitName: string, kind: Kind, items: string[]) =>
    setData({ ...data, units: data.units.map((unit) => (unit.name === unitName ? { ...unit, [kind]: items } : unit)) });
  const chipField = (unit: HandoverUnit, kind: Kind, placeholder: string) => (
    <ChipField
      key={kind}
      label={<>{KIND_LABEL[kind]}<KindHelp kind={kind} /></>}
      items={unit[kind]}
      draft={drafts[draftKey(unit.name, kind)] ?? ""}
      placeholder={placeholder}
      onDraft={(value) => setDrafts({ ...drafts, [draftKey(unit.name, kind)]: value })}
      onChange={(items) => setItems(unit.name, kind, items)}
    />
  );
  // 입력칸에 적어 두고 Enter 를 안 누른 세부업무도 포함한다.
  const withDrafts = (units: HandoverUnit[]): HandoverUnit[] =>
    units.map((unit) => {
      const pending = (kind: Kind) => (drafts[draftKey(unit.name, kind)] ?? "").trim();
      return { ...unit, regular: pending("regular") ? [...unit.regular, pending("regular")] : unit.regular, irregular: pending("irregular") ? [...unit.irregular, pending("irregular")] : unit.irregular };
    });

  const check = (fields: [boolean, string][]) => {
    const empty = fields.filter(([isEmpty]) => isEmpty).map(([, label]) => label);
    setMissing(empty);
    return empty.length === 0;
  };

  // 인사발령 1단계 → 2단계: 단위 업무 1개 이상(입력칸에 적어 두고 '추가'를 안 누른 단위 업무도 포함)
  const next = () => {
    const units = customDraft?.trim() ? addCustomUnit() : data.units;
    if (!check([[!units.length, "단위 업무"]])) return;
    setStep(2);
  };

  const submit = () => {
    if (busy) return;
    const units = withDrafts(data.units);
    const form = { ...data, name: profile.name, division: profile.division, team: profile.team, role: profile.role, units, task: dutiesText(units) };
    if (mode === "leave") {
      const detailCount = units.reduce((sum, unit) => sum + unit.regular.length + unit.irregular.length, 0);
      if (!check([[!detailCount, "세부업무"], [!form.leaveStart || !form.leaveEnd, "휴가 기간"]])) return;
      if (form.leaveEnd < form.leaveStart) {
        setLeaveError("휴가 종료일은 시작일보다 빠를 수 없어요.");
        return;
      }
      setLeaveError("");
    }
    setData(form);
    setDrafts({});
    onStart(form);
  };

  // 인사발령 1단계: 직제규정 시행세칙의 우리 팀 단위 업무를 고른다(여러 개). 목록에 없으면 직접 추가한다.
  const unitPicker = (
    <div className="wide-field unit-field">
      <span className="unit-field-label">단위 업무 <i>*</i></span>
      <p className="unit-field-help">
        {org === null && !managerDuties.length
          ? "직제규정 시행세칙의 업무분장을 불러오고 있어요."
          : teamDuties.length
            ? `직제규정 시행세칙의 ${profile.team || "우리 팀"} 업무분장${managerDuties.some((name) => !orgDuties.includes(name)) ? "과 팀장이 추가한 업무" : ""}예요. 인계할 업무를 모두 골라 주세요.`
            : `${profile.team || "우리 팀"}의 업무분장을 찾지 못했어요. 아래 '+ 추가하기'로 단위 업무를 직접 넣어 주세요.`}
      </p>
      {unitOptions.length > 6 && (
        <label className="team-duty-search unit-search">
          <Icon name="search" size={13} />
          <input value={unitQuery} onChange={(event) => setUnitQuery(event.target.value)} placeholder={`단위 업무 ${unitOptions.length}개에서 검색`} aria-label="단위 업무 검색" />
          {unitQuery && <button type="button" onClick={() => setUnitQuery("")} aria-label="검색어 지우기"><Icon name="close" size={11} /></button>}
        </label>
      )}
      {unitOptions.length > 0 && shownUnits.length === 0 && <p className="team-duty-picker-none">‘{unitQuery.trim()}’에 맞는 단위 업무가 없어요. 아래 '+ 추가하기'로 직접 넣어 주세요.</p>}
      {shownUnits.length > 0 && (
        <div className="unit-options">
          {shownUnits.map((name) => (
            <label className={`unit-option ${selected.has(name) ? "checked" : ""}`} key={name}>
              <input type="checkbox" checked={selected.has(name)} onChange={() => toggleUnit(name)} />
              <span>{name}</span>
            </label>
          ))}
        </div>
      )}
      {customDraft === null ? (
        <button type="button" className="unit-add-button" onClick={() => setCustomDraft("")}>+ 추가하기</button>
      ) : (
        <div className="task-editor unit-add-editor">
          <div className="task-input-row">
            <input
              autoFocus
              value={customDraft}
              onChange={(event) => setCustomDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  addCustomUnit();
                } else if (event.key === "Escape") setCustomDraft(null);
              }}
              placeholder="단위 업무명을 입력하고 Enter를 눌러 추가하세요"
              aria-label="직접 추가할 단위 업무명"
            />
            <button type="button" onClick={addCustomUnit}>추가</button>
            <button type="button" className="unit-add-cancel" onClick={() => setCustomDraft(null)}>취소</button>
          </div>
        </div>
      )}
    </div>
  );

  const leaveUnit = data.units[0] ?? emptyUnit("");
  const leaveFields = (
    <>
      <div className="wide-field unit-field">
        <span className="unit-field-label">담당 업무 <i>*</i></span>
        <p className="unit-field-help">부재 중 처리해야 할 세부업무를 입력하고 Enter를 눌러 추가해 주세요.</p>
        <div className="unit-detail-grid">
          {chipField(leaveUnit, "regular", "예: 월말 정산 보고")}
          {chipField(leaveUnit, "irregular", "예: 시스템 개선 프로젝트")}
        </div>
      </div>
      <div className="wide-field leave-period-field">
        <label>휴가 시작일 <i>*</i><input type="date" value={data.leaveStart} max={data.leaveEnd || undefined} onChange={(e) => update("leaveStart", e.target.value)} /></label>
        <label>휴가 종료일 <i>*</i><input type="date" value={data.leaveEnd} min={data.leaveStart || undefined} onChange={(e) => update("leaveEnd", e.target.value)} /></label>
      </div>
    </>
  );
  // 인사발령 2단계: 고른 단위 업무마다 정기·비정기 세부업무(비워 둬도 된다)
  const detailStep = (
    <div className="unit-detail-list">
      {data.units.map((unit, index) => (
        <section className="unit-detail-card" key={unit.name}>
          <h3>
            <b>{index + 1}.</b> {unit.name}
            <HelpTip label="세부업무">
              <strong>세부업무</strong>
              <p>업무분장표에 명시된 단위업무를 수행하기 위해 필요한 주요 활동을 구분한 것으로, 인수인계 시 개별적으로 수행 방법과 절차를 설명할 수 있는 업무 단위</p>
            </HelpTip>
          </h3>
          <div className="unit-detail-grid">
            {chipField(unit, "regular", "예: 월간 실적 보고")}
            {chipField(unit, "irregular", "예: 홈페이지 리뉴얼")}
          </div>
        </section>
      ))}
    </div>
  );

  const detailMode = mode === "reassignment" && step === 2;
  const errorMessage = error ?? (leaveError || null) ?? (missing.length ? `필수 항목을 입력해 주세요: ${missing.join(", ")}` : null);
  return (
    <div className={`onboarding-page ${mode === "leave" ? "leave-theme" : ""}`}>
      {mode === "leave" && <LeaveSeasideBackground />}
      <header className="onboarding-header">
        <Brand onClick={onHome} />
        <div className="onboarding-progress">
          <span className="active" />
          <span />
          <span />
          <span />
          <small>1 / 4</small>
        </div>
        <StepUserMenu onLogout={onLogout} onHome={onHome} />
      </header>
      <main className="onboarding-main start-form-main">
        <section className="onboarding-card">
          <div className="onboarding-card-title">
            {detailMode ? (
              <div>
                <span>1단계 · 세부업무 · 정기인사 발령</span>
                <h2>세부업무를 작성해 주세요</h2>
                <p>없으면 비워 두셔도 됩니다. Enter를 누르면 하나씩 추가돼요.</p>
              </div>
            ) : (
              <div>
                <span>1단계 · 기본 정보 · {mode === "leave" ? "장기휴가" : "정기인사 발령"}</span>
                <h2>인계 정보를 알려주세요</h2>
                <p>AMIGO가 업무의 맥락을 이해하는 데 필요한 정보예요.</p>
              </div>
            )}
            {!detailMode && <span className="required-note"><i /> 필수 입력</span>}
          </div>
          <div className="field-grid">
            {detailMode ? detailStep : (
              mode === "leave" ? leaveFields : unitPicker
            )}
          </div>
          <ErrorNote message={errorMessage} />
          <div className="onboarding-actions start-form-actions">
            {mode === "reassignment" && step === 1 ? (
              <button className="primary-button onboarding-next" onClick={next}>다음 단계 <Icon name="arrow" size={18} /></button>
            ) : (
              <>
                {detailMode && <button type="button" className="start-form-back" disabled={busy} onClick={() => { setMissing([]); setStep(1); }}>이전</button>}
                <button className="primary-button onboarding-next" disabled={busy} onClick={submit}>{busy ? "작업을 만들고 있어요…" : "다음 단계로 이동"} <Icon name="arrow" size={18} /></button>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
