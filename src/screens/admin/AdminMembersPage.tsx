// 구성원 관리(팀장). 우리 팀(관리자와 같은 소속) 구성원과 각자의 인수인계 건수를 서버(GET /api/admin/members)에서 가져온다.
import { useState } from "react";
import { Icon } from "@/shared/Icon";
import { formatDate, formatRelativeTime, hasDocument } from "@/shared/sessions";
import type { AdminHandover, AdminMember } from "@/shared/types";

type Props = { members: AdminMember[]; handovers: AdminHandover[]; meId: string; onDelete: (member: AdminMember) => Promise<string | null>; onOpenDocument: (id: string) => void };

const authority = (member: AdminMember) => (member.is_admin ? "팀 관리자" : "일반 구성원");

export function AdminMembersPage({ members, handovers, meId, onDelete, onOpenDocument }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const filteredMembers = members.filter((member) => `${member.name} ${member.team} ${member.department} ${member.position}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = members.find((member) => member.id === selectedId) ?? members[0];
  if (!selected) {
    return <div className="admin-members-page"><div className="members-page-empty"><Icon name="user" size={28} /><h2>등록된 구성원이 없습니다.</h2><p>같은 소속(부서·팀)으로 프로필을 입력한 계정이 여기에 나타납니다.</p></div></div>;
  }
  const completedDocuments = handovers.filter((handover) => handover.owner_login_id === selected.login_id && hasDocument(handover));
  const isMe = selected.login_id === meId;

  const confirmDelete = async () => {
    setDeleteBusy(true);
    const error = await onDelete(selected);
    setDeleteBusy(false);
    setDeleteConfirmOpen(false);
    setDeleteError(error);
    if (!error) setSelectedId(null);
  };

  return (
    <div className="admin-members-page">
      <section className="members-page-title">
        <div><span><Icon name="user" size={13} /> MEMBER MANAGEMENT</span><h1>구성원 관리</h1><p>팀 구성원과 관리자 권한, 인수인계 활동을 관리합니다.</p></div>
      </section>
      {deleteError && <div className="list-notice error" role="alert">삭제하지 못했어요: {deleteError}<button onClick={() => setDeleteError(null)}>닫기</button></div>}
      <div className="members-layout">
        <section className="members-list-panel">
          <header>
            <div><h2>구성원 목록</h2><span>총 {members.length}명</span></div>
            <label><Icon name="search" size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 팀, 직책 검색" /></label>
          </header>
          <div className="members-table">
            <div className="members-table-head"><span>구성원</span><span>소속</span><span>권한</span><span>인수인계</span></div>
            {filteredMembers.map((member) => (
              <button className={selected.id === member.id ? "selected" : ""} key={member.id} onClick={() => setSelectedId(member.id)}>
                <span className="members-person"><i>{member.name.slice(0, 1)}</i><span><strong>{member.name}</strong><small>{member.position}</small></span></span>
                <span><strong>{member.team || member.department}</strong><small>{member.team ? member.department : ""}</small></span>
                <em className={member.is_admin ? "admin" : ""}>{authority(member)}</em>
                <strong className="member-handover-count">{member.handover_count}건</strong>
              </button>
            ))}
            {!filteredMembers.length && <div className="members-empty"><Icon name="search" size={20} /><strong>검색 결과가 없습니다.</strong><span>다른 검색어나 필터를 선택해 주세요.</span></div>}
          </div>
        </section>
        <aside className="member-detail-panel">
          <header>
            <span>MEMBER PROFILE</span>
            {!isMe && (
              <div className="member-profile-menu">
                <button aria-label="구성원 메뉴" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((current) => !current)}><Icon name="more" size={17} /></button>
                {profileMenuOpen && <div><button onClick={() => { setProfileMenuOpen(false); setDeleteConfirmOpen(true); }}><Icon name="close" size={13} /> 삭제하기</button></div>}
              </div>
            )}
          </header>
          <div className="member-detail-identity"><span>{selected.name.slice(0, 1)}</span><h2>{selected.name}</h2><p>{selected.position}{isMe ? " · 나" : ""}</p></div>
          <dl>
            <div><dt>소속</dt><dd>{selected.department}<br />{selected.team}</dd></div>
            <div><dt>사번</dt><dd>{selected.login_id}</dd></div>
            <div><dt>권한</dt><dd className={selected.is_admin ? "authority" : ""}>{authority(selected)}</dd></div>
            <div><dt>최근 로그인</dt><dd>{selected.last_login_at ? formatRelativeTime(selected.last_login_at) : "아직 없음"}</dd></div>
          </dl>
          <div className="member-detail-activity">
            <div><span><Icon name="message" size={15} /></span><div><small>인계 중인 업무</small><strong>{selected.handover_count}건</strong></div></div>
            <button onClick={() => setDocumentsOpen(true)}><span><Icon name="check" size={15} /></span><div><small>완성한 문서</small><strong>{selected.completed_count}건</strong></div></button>
          </div>
        </aside>
      </div>
      {documentsOpen && (
        <div className="member-documents-overlay" role="presentation" onClick={() => setDocumentsOpen(false)}>
          <section className="member-documents-modal" role="dialog" aria-modal="true" aria-labelledby="member-documents-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span>COMPLETED DOCUMENTS</span><h2 id="member-documents-title">{selected.name}님의 완성 문서</h2><p>완성된 인수인계 문서를 확인할 수 있습니다.</p></div>
              <button onClick={() => setDocumentsOpen(false)} aria-label="완성 문서 팝업 닫기"><Icon name="close" size={17} /></button>
            </header>
            <div className="member-documents-list">
              {completedDocuments.map((document) => (
                <button key={document.id} onClick={() => onOpenDocument(document.id)}>
                  <span><Icon name="file" size={17} /></span>
                  <div><strong>{document.title}</strong><small>{document.organization} · 인수자 {document.successor || "미지정"}</small></div>
                  <div><small>마지막 생성</small><strong>{formatDate(document.updated_at)}</strong></div>
                  <em>v{document.document_version}</em>
                  <Icon name="chevron" size={13} />
                </button>
              ))}
              {!completedDocuments.length && <div className="member-documents-empty"><Icon name="file" size={24} /><strong>완성한 문서가 없습니다.</strong><span>인수인계서가 만들어지면 이곳에 표시됩니다.</span></div>}
            </div>
          </section>
        </div>
      )}
      {deleteConfirmOpen && (
        <div className="member-delete-overlay" role="presentation" onClick={() => !deleteBusy && setDeleteConfirmOpen(false)}>
          <section className="member-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="member-delete-title" onClick={(event) => event.stopPropagation()}>
            <span><Icon name="user" size={22} /></span>
            <h2 id="member-delete-title">정말 삭제하시겠습니까?</h2>
            <p><strong>{selected.name}</strong>님의 계정과 인수인계 {selected.handover_count}건(자료·대화·문서 포함)이<br />서버에서 모두 지워지며 되돌릴 수 없습니다.</p>
            <div>
              <button onClick={() => setDeleteConfirmOpen(false)} disabled={deleteBusy}>취소</button>
              <button onClick={() => void confirmDelete()} disabled={deleteBusy}>{deleteBusy ? "삭제 중…" : "삭제하기"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
