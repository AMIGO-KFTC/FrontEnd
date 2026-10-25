// 팀 담당 업무(관리자). 우리 팀에서 하는 업무를 정해 두면, 구성원이 인수인계 1단계(기본 정보)에서 이 목록을 보고 자기 담당 업무를 고른다.
// 목록은 BackEnd 에 소속(부서 + 팀) 단위로 저장되고(GET·POST /api/team-duties/me, PATCH·DELETE /api/team-duties/me/<id>), 고칠 때마다 바로 저장된다.
// 이미 시작한 인수인계에는 영향이 없다(시작할 때 고른 업무 이름이 작업에 따로 저장돼 있다).
import { useEffect, useState } from "react";
import { api, ApiError } from "@/shared/api";
import { ConfirmModal } from "@/shared/ConfirmModal";
import { Icon } from "@/shared/Icon";
import type { TeamDuties, TeamDuty } from "@/shared/types";

const MAX_DUTIES = 50;
const MAX_NAME = 100;
const MAX_DESCRIPTION = 500;

type Draft = { name: string; description: string };
const EMPTY_DRAFT: Draft = { name: "", description: "" };

export function AdminTeamDutiesPage() {
  const [data, setData] = useState<TeamDuties | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT); // 새 업무
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [deleting, setDeleting] = useState<TeamDuty | null>(null);
  const [pending, setPending] = useState(false); // 서버에 요청이 가 있는 동안(중복 요청 방지)
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .teamDuties()
      .then((result) => !cancelled && setData(result))
      .catch((e: Error) => {
        if (cancelled) return;
        setLoadError(e instanceof ApiError && e.status === 401 ? "로그인이 필요해요.\n일반 모드에서 로그인한 뒤 다시 열어 주세요." : e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const duties = data?.duties ?? [];
  const editable = data?.editable ?? false;

  // 요청 하나를 보내고 응답(바뀐 뒤의 전체 목록)으로 화면을 바꾼다. 성공하면 true.
  const run = async (call: () => Promise<TeamDuties>): Promise<boolean> => {
    if (pending) return false;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await call();
      setData(result);
      setNotice(result.message || "저장했어요.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setPending(false);
    }
  };

  const add = async () => {
    const name = draft.name.trim();
    if (!name) {
      setError("업무 이름을 적어 주세요.");
      return;
    }
    if (await run(() => api.addTeamDuty({ name, description: draft.description.trim() }))) setDraft(EMPTY_DRAFT);
  };

  const startEdit = (duty: TeamDuty) => {
    setEditingId(duty.id);
    setEditDraft({ name: duty.name, description: duty.description });
    setError(null);
  };
  const saveEdit = async (duty: TeamDuty) => {
    const name = editDraft.name.trim();
    if (!name) {
      setError("업무 이름은 비워 둘 수 없어요.");
      return;
    }
    if (await run(() => api.updateTeamDuty(duty.id, { name, description: editDraft.description.trim() }))) setEditingId(null);
  };

  // 바로 옆 업무와 순서를 바꾼다(두 업무의 sort_order 를 맞바꾼다).
  const move = (index: number, offset: -1 | 1) => {
    const a = duties[index];
    const b = duties[index + offset];
    if (!a || !b) return;
    void run(async () => {
      await api.updateTeamDuty(a.id, { sort_order: b.sort_order === a.sort_order ? b.sort_order + offset : b.sort_order });
      return api.updateTeamDuty(b.id, { sort_order: a.sort_order });
    });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    if (await run(() => api.deleteTeamDuty(target.id))) {
      if (editingId === target.id) setEditingId(null);
    }
    setDeleting(null);
  };

  const statusText = loadError ? "불러오지 못했어요" : !data ? "불러오는 중…" : `${duties.length}개 업무`;

  return (
    <div className="admin-ai-page team-items-page">
      <section className="members-page-title">
        <div>
          <h1>팀 담당 업무</h1>
          <p>우리 팀에서 하는 업무를 정해 두면, 팀원이 인수인계를 시작할 때 이 목록에서 자기 담당 업무를 골라요.{"\n"}목록에 없는 업무는 팀원이 직접 적을 수도 있어요.</p>
        </div>
        <div className="ai-settings-status"><i /><span>{data ? `${data.organization} · ${statusText}` : statusText}</span></div>
      </section>

      {loadError && <p className="team-items-alert" role="alert">{loadError}</p>}

      {data && (
        <div className="ai-settings-layout single">
          <div className="ai-settings-form">
            {!editable && (
              <p className="team-items-alert info" role="status"><Icon name="shield" size={12} /> 팀 업무 목록은 팀 관리자만 고칠 수 있어요. 내용은 볼 수 있어요.</p>
            )}

            <section className="ai-settings-card">
              <header>
                <span><Icon name="folder" size={16} /></span>
                <div><h2>우리 팀 업무 목록</h2><p>위에 있을수록 1단계 화면에서 먼저 보여요. 고친 내용은 바로 저장돼요.</p></div>
              </header>
              <div className="team-items-body">
                {duties.length === 0 && <p className="team-items-empty">아직 등록한 업무가 없어요.{"\n"}아래에서 첫 업무를 추가해 보세요.</p>}
                <ul className="team-items-list team-duties-list">
                  {duties.map((duty, index) => (
                    <li key={duty.id}>
                      {editingId === duty.id ? (
                        <>
                          <div className="team-item-top">
                            <span className="team-item-no">{index + 1}</span>
                            <input
                              value={editDraft.name}
                              maxLength={MAX_NAME}
                              autoFocus
                              onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.nativeEvent.isComposing) void saveEdit(duty);
                                if (event.key === "Escape") setEditingId(null);
                              }}
                              aria-label={`${index + 1}번 업무 이름`}
                            />
                            <span />
                          </div>
                          <textarea
                            value={editDraft.description}
                            maxLength={MAX_DESCRIPTION}
                            onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })}
                            placeholder="업무 설명 (선택)"
                            aria-label={`${index + 1}번 업무 설명`}
                            rows={2}
                          />
                          <div className="team-duty-edit-actions">
                            <button type="button" onClick={() => setEditingId(null)} disabled={pending}>취소</button>
                            <button type="button" className="primary" onClick={() => void saveEdit(duty)} disabled={pending}>{pending ? "저장하는 중…" : "저장"}</button>
                          </div>
                        </>
                      ) : (
                        <div className="team-duty-row">
                          <span className="team-item-no">{index + 1}</span>
                          <div>
                            <strong>{duty.name}</strong>
                            {duty.description && <small>{duty.description}</small>}
                          </div>
                          {editable && (
                            <div className="team-duty-tools">
                              <button type="button" onClick={() => move(index, -1)} disabled={pending || index === 0} aria-label={`${duty.name} 위로`}>↑</button>
                              <button type="button" onClick={() => move(index, 1)} disabled={pending || index === duties.length - 1} aria-label={`${duty.name} 아래로`}>↓</button>
                              <button type="button" onClick={() => startEdit(duty)} disabled={pending}>수정</button>
                              <button type="button" className="team-item-remove" onClick={() => setDeleting(duty)} disabled={pending} aria-label={`${duty.name} 삭제`}><Icon name="close" size={13} /></button>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                {editable && (
                  <div className="team-duty-add">
                    <input
                      value={draft.name}
                      maxLength={MAX_NAME}
                      disabled={duties.length >= MAX_DUTIES}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                          event.preventDefault();
                          void add();
                        }
                      }}
                      placeholder="업무 이름 (예: 홈페이지 운영)"
                      aria-label="새 업무 이름"
                    />
                    <input
                      value={draft.description}
                      maxLength={MAX_DESCRIPTION}
                      disabled={duties.length >= MAX_DUTIES}
                      onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                          event.preventDefault();
                          void add();
                        }
                      }}
                      placeholder="설명 (선택)"
                      aria-label="새 업무 설명"
                    />
                    <button type="button" className="team-items-add" disabled={pending || duties.length >= MAX_DUTIES} onClick={() => void add()}>+ 업무 추가</button>
                  </div>
                )}
                <div className="team-items-actions">
                  <span>{error ? <span className="team-items-error">{error}</span> : notice}</span>
                  <span>{duties.length} / {MAX_DUTIES}개</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {deleting && (
        <ConfirmModal
          icon="close"
          title={`'${deleting.name}' 업무를 삭제할까요?`}
          description="1단계 화면의 업무 목록에서 빠져요. 이미 시작한 인수인계에는 영향이 없어요."
          confirmLabel="삭제"
          busy={pending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}
