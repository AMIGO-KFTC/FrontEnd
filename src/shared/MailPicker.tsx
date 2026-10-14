// 메일 연결: BackEnd 메일 조회 API(/api/mail/messages)로 메일함을 검색하고, 고른 메일을 업무 자료(.eml)로 가져온다.
// 인수인계 업무와 관련 있는 메일이 먼저 오고(추천), 이미 가져온 메일은 다시 고를 수 없다.
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { Icon } from "./Icon";
import type { MailList, MailSummary } from "./types";

type Props = {
  sessionId: string;
  onImported: () => void;
};

function formatDate(value: string): string {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function MailPicker({ sessionId, onImported }: Props) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<MailList | null>(null);
  const [messages, setMessages] = useState<MailSummary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (q: string, page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.mails(sessionId, q, page);
        setResult(data);
        setMessages((prev) => (page === 1 ? data.messages : [...prev, ...data.messages]));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    void load("");
  }, [load]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const importSelected = async () => {
    if (!selected.size) return;
    setImporting(true);
    setError(null);
    try {
      const res = await api.importMails(sessionId, Array.from(selected));
      setNotice(res.message);
      setSelected(new Set());
      onImported();
      await load(query);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="step-link-area mail-picker">
      <div className="step-section-label">
        <span><Icon name="mail" size={15} /></span>
        <div>
          <strong>업무 메일 검색 및 선택</strong>
          <p>
            {result ? `${result.mailbox.email}${result.provider === "mock" ? " · 가상 메일함" : ""}` : "메일함을 불러오고 있어요."}
            {result?.keywords.length ? ` · '${result.keywords.slice(0, 3).join(", ")}' 관련 메일 우선` : ""}
          </p>
        </div>
      </div>
      <form
        className="step-link-input"
        onSubmit={(event) => {
          event.preventDefault();
          void load(query.trim());
        }}
      >
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목·본문·보낸 사람·첨부파일 이름으로 검색" />
        <button type="submit">검색</button>
      </form>
      <div className="mail-list" aria-busy={loading}>
        {messages.map((mail) => (
          <label className={`mail-row ${mail.imported ? "imported" : ""} ${selected.has(mail.id) ? "selected" : ""}`} key={mail.id}>
            <input type="checkbox" checked={mail.imported || selected.has(mail.id)} disabled={mail.imported} onChange={() => toggle(mail.id)} />
            <div>
              <strong>
                {mail.recommended && <em className="mail-tag">추천</em>}
                {mail.imported && <em className="mail-tag done">가져옴</em>}
                {mail.subject}
                {mail.has_attachments && <Icon name="paperclip" size={11} />}
              </strong>
              <small>{mail.folder === "sent" ? `받는 사람 ${mail.to.map((a) => a.name).join(", ")}` : mail.sender.name} · {formatDate(mail.sent_at)}</small>
              <p>{mail.snippet}</p>
            </div>
          </label>
        ))}
        {!loading && result && messages.length === 0 && <div className="empty-resource">{result.message}</div>}
        {loading && <div className="empty-resource">메일을 불러오고 있어요…</div>}
      </div>
      {error && <p className="mail-picker-error">{error}</p>}
      {notice && <p className="mail-picker-notice">{notice}</p>}
      <div className="mail-picker-actions">
        <span>{result ? `${result.total}건 중 ${messages.length}건 표시` : ""}</span>
        {result?.has_next && (
          <button type="button" disabled={loading} onClick={() => void load(query.trim(), result.page + 1)}>더 보기</button>
        )}
        <button type="button" className="primary" disabled={!selected.size || importing} onClick={() => void importSelected()}>
          {importing ? "가져오는 중…" : `선택한 메일 ${selected.size}건 가져오기`}
        </button>
      </div>
    </section>
  );
}
