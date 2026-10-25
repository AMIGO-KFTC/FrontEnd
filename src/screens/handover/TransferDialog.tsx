// 완성 문서 화면의 "인수자에게 전송하기". 받는 사람을 여러 명 골라 [전송하기]를 눌러야 전달된다(완료 버튼으로는 전달되지 않는다).
// 이미 보낸 사람은 '전송됨'으로 표시한다. 보낸 뒤에 문서를 고쳐도 받는 사람은 항상 최신 문서를 본다.
import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api";
import { Icon } from "@/shared/Icon";
import type { Member, SentTransfer } from "@/shared/types";

type Props = { sessionId: string; selfLoginId: string; onClose: () => void };

export function TransferDialog({ sessionId, selfLoginId, onClose }: Props) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [sent, setSent] = useState<SentTransfer[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string[] | null>(null); // 방금 전송에 성공한 사람 이름

  useEffect(() => {
    api.members().then((result) => setMembers(result.members.filter((member) => member.login_id !== selfLoginId))).catch((e) => { setMembers([]); setError((e as Error).message); });
    api.sessionTransfers(sessionId).then((result) => setSent(result.transfers)).catch(() => setSent([]));
  }, [sessionId, selfLoginId]);

  const sentIds = useMemo(() => new Set(sent.map((transfer) => transfer.recipient.user_id)), [sent]);
  const shown = (members ?? []).filter((member) => `${member.name} ${member.position} ${member.team} ${member.department}`.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (id: number) => setPicked((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  const send = async () => {
    if (!picked.length || sending) return;
    setSending(true);
    setError("");
    const ok: string[] = [];
    const failed: string[] = [];
    for (const id of picked) {
      const member = members?.find((item) => item.id === id);
      try {
        await api.sendTransfer(sessionId, id, message.trim());
        ok.push(member?.name ?? String(id));
      } catch (e) {
        failed.push(`${member?.name ?? id}: ${(e as Error).message}`);
      }
    }
    setSending(false);
    api.sessionTransfers(sessionId).then((result) => setSent(result.transfers)).catch(() => undefined);
    setPicked([]);
    if (failed.length) setError(`전송하지 못한 사람이 있어요. ${failed.join(" / ")}`);
    if (ok.length) setDone(ok);
  };

  return (
    <div className="logout-overlay" role="presentation" onClick={onClose}>
      <section className="transfer-modal" role="dialog" aria-modal="true" aria-labelledby="transfer-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="transfer-title">인수자에게 전송하기</h2>
        {done ? (
          <>
            <p className="transfer-done"><Icon name="check" size={15} /> {done.join(", ")}님에게 전송했어요.{"\n"}받는 사람의 '받은 인수인계'에 나타나요.</p>
            {error && <p className="signup-error" role="alert">{error}</p>}
            <div className="transfer-actions"><button type="button" onClick={() => setDone(null)}>더 보내기</button><button type="button" className="primary" onClick={onClose}>닫기</button></div>
          </>
        ) : (
          <>
            <p className="transfer-desc">받는 사람을 고르고 [전송하기]를 누르면 그때 전달돼요.{"\n"}여러 명을 고를 수 있어요.</p>
            <input className="transfer-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름·직위·팀으로 찾기" />
            <ul className="transfer-list">
              {members === null && <li className="transfer-empty">구성원을 불러오는 중…</li>}
              {members !== null && shown.length === 0 && <li className="transfer-empty">고를 수 있는 구성원이 없어요.</li>}
              {shown.map((member) => {
                const already = sentIds.has(member.id);
                return (
                  <li key={member.id}>
                    <label className={already ? "is-sent" : ""}>
                      <input type="checkbox" checked={picked.includes(member.id)} disabled={already || sending} onChange={() => toggle(member.id)} />
                      <span><strong>{member.name} {member.position}</strong><small>{[member.department, member.team].filter(Boolean).join(" · ") || "소속 미입력"}</small></span>
                      {already && <em>전송됨</em>}
                    </label>
                  </li>
                );
              })}
            </ul>
            <textarea className="transfer-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} placeholder="받는 사람에게 남길 말 (선택)" disabled={sending} />
            {error && <p className="signup-error" role="alert">{error}</p>}
            <div className="transfer-actions">
              <button type="button" onClick={onClose} disabled={sending}>취소</button>
              <button type="button" className="primary" disabled={!picked.length || sending} onClick={() => void send()}>{sending ? "전송 중…" : picked.length ? `${picked.length}명에게 전송하기` : "전송하기"}</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
