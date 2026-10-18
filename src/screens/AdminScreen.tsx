// 관리자 페이지: 팀을 고르면 팀원별 인수인계서 작성 수행 기록과 성과(완료율·응답률·충족률·소요 시간)를 보여 주고,
// 팀원을 누르면 단위업무별 진행과 최근 수행 기록을 펼친다. 관리자(users.is_admin)만 들어올 수 있다.
import { Fragment, useCallback, useEffect, useState } from "react";
import { api } from "../shared/api";
import { Brand } from "../shared/Brand";
import { ErrorNote } from "../shared/ErrorNote";
import { Icon } from "../shared/Icon";
import type { MemberReport, TeamInfo, TeamReport } from "../shared/types";

type Props = { onBack: () => void; onLogout: () => void };

const STAGE_LABEL: Record<string, string> = { preparing: "자료 준비", analyzing: "AI 분석", answering: "질의응답·작성", completed: "완성" };

const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);
const hours = (value: number | null) => (value === null ? "—" : value < 1 ? "1시간 미만" : value < 24 ? `${value}시간` : `${(value / 24).toFixed(1)}일`);

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function Bar({ value }: { value: number | null }) {
  return (
    <span className="admin-bar" title={pct(value)}>
      <span><i style={{ width: `${Math.round((value ?? 0) * 100)}%` }} /></span>
      <b>{pct(value)}</b>
    </span>
  );
}

export function AdminScreen({ onBack, onLogout }: Props) {
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [selected, setSelected] = useState<TeamInfo | null>(null);
  const [period, setPeriod] = useState({ from: "", to: "" });
  const [report, setReport] = useState<TeamReport | null>(null);
  const [openMember, setOpenMember] = useState<number | null>(null);
  const [detail, setDetail] = useState<MemberReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .adminTeams()
      .then(({ teams: list }) => {
        setTeams(list);
        setSelected(list.find((t) => t.task_count > 0) ?? list[0] ?? null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const loadReport = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setOpenMember(null);
    setDetail(null);
    try {
      setReport(await api.adminTeamReport(selected.department, selected.team, period.from, period.to));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selected, period]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const toggleMember = async (userId: number) => {
    if (openMember === userId) {
      setOpenMember(null);
      return;
    }
    setOpenMember(userId);
    setDetail(null);
    try {
      setDetail(await api.adminMemberReport(userId, period.from, period.to));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const s = report?.summary;

  return (
    <div className="onboarding-page admin-page">
      <header className="onboarding-header">
        <Brand />
        <div className="mypage-actions">
          <button onClick={onBack}><Icon name="arrow" size={14} /> 마이페이지로</button>
          <button onClick={onLogout}>로그아웃</button>
        </div>
      </header>
      <main className="admin-main">
        <div className="mypage-title">
          <span>ADMIN</span>
          <h1>팀 인수인계 현황 <em className="admin-badge">관리자</em></h1>
          <p>팀원별 인수인계서 작성 수행 기록과 성과를 확인합니다.</p>
        </div>

        <section className="admin-filters">
          <label>팀
            <select
              value={selected ? `${selected.department}|${selected.team}` : ""}
              onChange={(e) => setSelected(teams.find((t) => `${t.department}|${t.team}` === e.target.value) ?? null)}
            >
              {teams.map((t) => (
                <option key={`${t.department}|${t.team}`} value={`${t.department}|${t.team}`}>
                  {t.label || "(소속 없음)"} · {t.member_count}명 · 업무 {t.task_count}
                </option>
              ))}
            </select>
          </label>
          <label>등록 기간(시작)<input type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} /></label>
          <label>등록 기간(끝)<input type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} /></label>
          {(period.from || period.to) && <button onClick={() => setPeriod({ from: "", to: "" })}>기간 지우기</button>}
        </section>
        <ErrorNote message={error} />

        {s && (
          <section className="admin-summary">
            <div><small>팀원</small><strong>{s.active_member_count}<em> / {s.member_count}명</em></strong><span>단위업무를 등록한 팀원</span></div>
            <div><small>인수인계서</small><strong>{s.document_count}<em> / {s.task_count}건</em></strong><Bar value={s.completion_rate} /></div>
            <div><small>질문 응답률</small><strong>{pct(s.answer_rate)}</strong><span>답함 / (답함 + 건너뜀)</span></div>
            <div><small>항목 충족률</small><strong>{pct(s.coverage_rate)}</strong><span>장별 충족도 평균</span></div>
            <div><small>첫 문서까지</small><strong>{hours(s.avg_hours_to_first_document)}</strong><span>직접 수정 {s.user_versions}회</span></div>
          </section>
        )}

        <section className="mypage-card admin-table-card">
          <h2><Icon name="user" size={16} /> 팀원별 작성 현황 {loading && <small>불러오는 중…</small>}</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>팀원</th>
                  <th>단위업무</th>
                  <th>진행 단계</th>
                  <th>작성 완료율</th>
                  <th>질문(답함/건너뜀/남음)</th>
                  <th>충족률</th>
                  <th>첫 문서까지</th>
                  <th>자료·수정</th>
                  <th>마지막 작업</th>
                </tr>
              </thead>
              <tbody>
                {report?.members.map((m) => (
                  <Fragment key={m.user_id}>
                    <tr className={`admin-member ${openMember === m.user_id ? "open" : ""}`} onClick={() => void toggleMember(m.user_id)}>
                      <td><strong>{m.name}</strong><small>{m.position} · {m.login_id}</small></td>
                      <td>{m.document_count} / {m.task_count}</td>
                      <td>
                        <span className="stage-chips">
                          {(["completed", "answering", "analyzing", "preparing"] as const).map((k) =>
                            m.stages[k] ? <em key={k} className={`stage-chip ${k}`}>{STAGE_LABEL[k]} {m.stages[k]}</em> : null,
                          )}
                          {m.task_count === 0 && <small>등록한 업무 없음</small>}
                        </span>
                      </td>
                      <td><Bar value={m.completion_rate} /></td>
                      <td>{m.questions_answered} / {m.questions_skipped} / {m.questions_open}<small>응답률 {pct(m.answer_rate)}</small></td>
                      <td>{pct(m.coverage_rate)}</td>
                      <td>{hours(m.avg_hours_to_first_document)}</td>
                      <td>자료 {m.source_count}<small>AI {m.ai_versions} · 직접 {m.user_versions}</small></td>
                      <td>{formatDate(m.last_activity_at)}<Icon name="chevron" size={12} /></td>
                    </tr>
                    {openMember === m.user_id && (
                      <tr className="admin-detail-row">
                        <td colSpan={9}>
                          {!detail ? (
                            <p className="mypage-empty">불러오는 중…</p>
                          ) : (
                            <div className="admin-detail">
                              <div>
                                <h3>단위업무별 진행</h3>
                                {detail.tasks.length === 0 && <p className="mypage-empty">등록한 단위업무가 없어요.</p>}
                                {detail.tasks.map((t) => (
                                  <div className="admin-task" key={t.task_id}>
                                    <div>
                                      <strong>{t.name}</strong>
                                      <small>
                                        <em className={`stage-chip ${t.stage_group}`}>{STAGE_LABEL[t.stage_group]}</em>
                                        {t.has_document ? ` 문서 v${t.document_version}` : " 문서 없음"} · 자료 {t.source_count} · 질문 {t.questions_answered}/{t.questions_skipped}/{t.questions_open} · 충족률 {pct(t.coverage_rate)}
                                      </small>
                                    </div>
                                    <span>{formatDate(t.last_activity_at)}</span>
                                  </div>
                                ))}
                              </div>
                              <div>
                                <h3>최근 수행 기록</h3>
                                {detail.activity.length === 0 && <p className="mypage-empty">기록이 없어요.</p>}
                                <ul className="admin-activity">
                                  {detail.activity.slice(0, 15).map((a, i) => (
                                    <li key={`${a.kind}-${a.at}-${i}`}>
                                      <span>{formatDate(a.at)}</span>
                                      <strong>{a.label}</strong>
                                      <small>{a.task_name}{a.detail ? ` · ${a.detail}` : ""}</small>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {report && report.members.length === 0 && <p className="mypage-empty">이 팀에 팀원이 없어요.</p>}
        </section>
      </main>
    </div>
  );
}
