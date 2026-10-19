// 구성원 관리(개발용 미리보기). BackEnd 에 구성원 목록·권한 API 가 없어 adminMembers.ts 의 값으로만 동작한다.
import { useState } from "react";
import { Icon } from "@/shared/Icon";
import type { AdminMember } from "./adminMembers";

export function AdminMembersPage({ members, onDelete }: { members: AdminMember[]; onDelete: (id: number) => void }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(1);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const filteredMembers = members.filter((member) => `${member.name} ${member.team} ${member.division} ${member.role}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = members.find((member) => member.id === selectedId) ?? members[0];
  if (!selected) {
    return <div className="admin-members-page"><div className="members-page-empty"><Icon name="user" size={28} /><h2>등록된 구성원이 없습니다.</h2><p>구성원이 등록되면 이곳에서 관리할 수 있습니다.</p></div></div>;
  }
  const completedCount = Math.max(selected.handovers - 1, 0);
  const documentTitles = ["플랫폼 운영 업무 인수인계서", "주요 프로젝트 진행 현황", "업무 프로세스 및 협업 가이드", "정기 업무 운영 매뉴얼", "시스템 권한 및 계정 안내", "고객 대응 프로세스"];
  const completedDocuments = Array.from({ length: completedCount }, (_, index) => ({
    title: documentTitles[index % documentTitles.length],
    date: `2025. 03. ${String(14 - index * 2).padStart(2, "0")}`,
    sources: 18 - index * 2,
  }));

  return (
    <div className="admin-members-page">
      <section className="members-page-title">
        <div><span><Icon name="user" size={13} /> MEMBER MANAGEMENT</span><h1>구성원 관리</h1><p>팀 구성원과 관리자 권한, 인수인계 활동을 관리합니다.</p></div>
      </section>
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
                <span className="members-person"><i>{member.name.slice(0, 1)}</i><span><strong>{member.name}</strong><small>{member.role}</small></span></span>
                <span><strong>{member.team}</strong><small>{member.division}</small></span>
                <em className={member.authority !== "일반 구성원" ? "admin" : ""}>{member.authority}</em>
                <strong className="member-handover-count">{member.handovers}건</strong>
              </button>
            ))}
            {!filteredMembers.length && <div className="members-empty"><Icon name="search" size={20} /><strong>검색 결과가 없습니다.</strong><span>다른 검색어나 필터를 선택해 주세요.</span></div>}
          </div>
        </section>
        <aside className="member-detail-panel">
          <header>
            <span>MEMBER PROFILE</span>
            <div className="member-profile-menu">
              <button aria-label="구성원 메뉴" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((current) => !current)}><Icon name="more" size={17} /></button>
              {profileMenuOpen && <div><button onClick={() => { setProfileMenuOpen(false); setDeleteConfirmOpen(true); }}><Icon name="close" size={13} /> 삭제하기</button></div>}
            </div>
          </header>
          <div className="member-detail-identity"><span>{selected.name.slice(0, 1)}</span><h2>{selected.name}</h2><p>{selected.role}</p></div>
          <dl>
            <div><dt>소속</dt><dd>{selected.division}<br />{selected.team}</dd></div>
            <div><dt>권한</dt><dd className={selected.authority !== "일반 구성원" ? "authority" : ""}>{selected.authority}</dd></div>
            <div><dt>최근 활동</dt><dd>{selected.lastActive}</dd></div>
          </dl>
          <div className="member-detail-activity">
            <div><span><Icon name="message" size={15} /></span><div><small>참여한 인수인계</small><strong>{selected.handovers}건</strong></div></div>
            <button onClick={() => setDocumentsOpen(true)}><span><Icon name="check" size={15} /></span><div><small>완료한 문서</small><strong>{completedCount}건</strong></div></button>
          </div>
        </aside>
      </div>
      {documentsOpen && (
        <div className="member-documents-overlay" role="presentation" onClick={() => setDocumentsOpen(false)}>
          <section className="member-documents-modal" role="dialog" aria-modal="true" aria-labelledby="member-documents-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span>COMPLETED DOCUMENTS</span><h2 id="member-documents-title">{selected.name}님의 완료 문서</h2><p>완료된 인수인계 문서를 확인할 수 있습니다.</p></div>
              <button onClick={() => setDocumentsOpen(false)} aria-label="완료 문서 팝업 닫기"><Icon name="close" size={17} /></button>
            </header>
            <div className="member-documents-list">
              {completedDocuments.map((document, index) => (
                <button key={`${document.title}-${index}`}>
                  <span><Icon name="file" size={17} /></span>
                  <div><strong>{document.title}</strong><small>{selected.division} · {selected.team}</small></div>
                  <div><small>완성일</small><strong>{document.date}</strong></div>
                  <em>출처 {document.sources}개</em>
                  <Icon name="chevron" size={13} />
                </button>
              ))}
              {!completedDocuments.length && <div className="member-documents-empty"><Icon name="file" size={24} /><strong>완료한 문서가 없습니다.</strong><span>인수인계가 완료되면 이곳에 표시됩니다.</span></div>}
            </div>
          </section>
        </div>
      )}
      {deleteConfirmOpen && (
        <div className="member-delete-overlay" role="presentation" onClick={() => setDeleteConfirmOpen(false)}>
          <section className="member-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="member-delete-title" onClick={(event) => event.stopPropagation()}>
            <span><Icon name="user" size={22} /></span>
            <h2 id="member-delete-title">정말 삭제하시겠습니까?</h2>
            <p><strong>{selected.name}</strong>님이 이 미리보기 목록에서만 지워집니다.<br />서버에는 구성원 API 가 없어 실제로 삭제되지 않습니다.</p>
            <div>
              <button onClick={() => setDeleteConfirmOpen(false)}>취소</button>
              <button onClick={() => {
                const nextMember = members.find((member) => member.id !== selected.id);
                if (nextMember) setSelectedId(nextMember.id);
                setDeleteConfirmOpen(false);
                onDelete(selected.id);
              }}>삭제하기</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
