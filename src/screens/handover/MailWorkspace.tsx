import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/shared/api";
import { highlight } from "@/shared/highlight";
import { captureMail, formatMailDate } from "@/shared/mailCapture";
import type { Picked, PickItem } from "@/shared/pickBridge";
import type { MailAddress, MailDetail, MailList, MailQueryParams, MailSummary } from "@/shared/types";
import "./mailWorkspace.css";

// 새 탭 선택 창의 메일함 화면. 사내 그룹웨어 웹메일처럼 왼쪽에 접고 펼치는 메일함 목록(즐겨찾기·메일함·빠른검색),
// 가운데 위에 메일 표, 아래에 미리보기가 있다. 빠른검색에서 제목이나 관련 사람 이름을 넣으면 목록이 바로 걸러진다.
// 고른 메일은 'AMIGO 로 보내기' 로 원래 창에 넘기고, '캡처로 올리기' 는 지금 보는 메일을 그림(PNG)으로 만들어 바로 자료로 올린다.
// (데이터는 BackEnd 의 메일 조회 API 가 준다. 지금은 가상 메일함이다.)

type Props = {
  picked: Picked;
  onSend: (items: PickItem[]) => Promise<string | undefined>; // 보낸 결과 안내(성공 시 문장, 실패 시 undefined)
  onCapture: (file: File) => Promise<string | undefined>; // 캡처를 올린 결과 안내(성공 시 문장, 실패 시 undefined)
  warning: string | null;
  onClose: () => void;
};

type Search = { subject: string; person: string; attachOnly: boolean };
type View = { key: string; label: string; params: Pick<MailQueryParams, "folder" | "important" | "hasAttachments" | "dateFrom"> };

const PAGE_SIZE = 30;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// 왼쪽 메일함 목록. 즐겨찾기는 조건으로 걸러 보는 가상 메일함이다.
const FAVORITES: View[] = [
  { key: "important", label: "중요메일함", params: { important: true } },
  { key: "attach", label: "첨부메일함", params: { hasAttachments: true } },
  { key: "today", label: "오늘온메일함", params: { folder: "inbox", dateFrom: today() } },
];
const BOXES: View[] = [
  { key: "inbox", label: "받은메일함", params: { folder: "inbox" } },
  { key: "sent", label: "보낸메일함", params: { folder: "sent" } },
  { key: "all", label: "전체메일", params: {} },
];
const ALL_VIEWS = [...FAVORITES, ...BOXES];

const svg = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const ClipIcon = ({ size = 14 }: { size?: number }) => <svg {...svg} width={size} height={size}><path d="m21 11-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" /></svg>;
const CaretIcon = () => <svg {...svg} width={11} height={11} strokeWidth={2.6}><path d="m6 9 6 6 6-6" /></svg>;
const FolderIcon = () => <svg {...svg} width={15} height={15}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>;
const StarIcon = ({ on }: { on?: boolean }) => <svg {...svg} width={14} height={14} fill={on ? "currentColor" : "none"}><path d="m12 3 2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.8Z" /></svg>;
const CheckIcon = ({ size = 13 }: { size?: number }) => <svg {...svg} width={size} height={size} strokeWidth={2.8}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;

const who = (a: MailAddress) => a.name || a.email;
const toItem = (mail: MailSummary): PickItem => ({ id: mail.id, title: mail.subject, url: `mail:${mail.id}` });
const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`);
const listDate = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// 보기(메일함)와 검색 조건으로 메일 목록을 불러온다. 조건이 바뀌면 처음 쪽부터 다시 읽고, 입력이 멈춘 뒤(250ms)에 검색한다.
function useMailList(view: View, search: Search) {
  const [data, setData] = useState<MailList | null>(null);
  const [messages, setMessages] = useState<MailSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const first = useRef(true);
  const query = (page: number): MailQueryParams => ({
    ...view.params,
    subject: search.subject.trim(),
    person: search.person.trim(),
    hasAttachments: view.params.hasAttachments || search.attachOnly || undefined,
    page,
    size: PAGE_SIZE,
  });
  const key = `${view.key}|${search.subject.trim()}|${search.person.trim()}|${search.attachOnly}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(
      () => {
        api
          .mailMessages(query(1))
          .then((result) => {
            if (cancelled) return;
            setData(result);
            setMessages(result.messages);
            setError(null);
          })
          .catch((e: Error) => !cancelled && setError(e.message))
          .finally(() => !cancelled && setLoading(false));
      },
      first.current ? 0 : 250,
    );
    first.current = false;
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loadMore = async () => {
    if (!data || loading) return;
    setLoading(true);
    try {
      const result = await api.mailMessages(query(data.page + 1));
      setData(result);
      setMessages((current) => [...current, ...result.messages.filter((m) => !current.some((c) => c.id === m.id))]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return { data, messages, error, loading, loadMore };
}

// 접고 펼치는 왼쪽 묶음(즐겨찾기·메일함·빠른검색)
function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="mbx-section">
      <button type="button" className="mbx-section-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <i className={open ? "open" : ""}><CaretIcon /></i> {title}
      </button>
      {open && <div className="mbx-section-body">{children}</div>}
    </section>
  );
}

export function MailWorkspace({ picked, onSend, onCapture, warning, onClose }: Props) {
  const [view, setView] = useState<View>(BOXES[0]);
  const [search, setSearch] = useState<Search>({ subject: "", person: "", attachOnly: false });
  const { data, messages, error: listError, loading, loadMore } = useMailList(view, search);
  const [counts, setCounts] = useState<Record<string, number>>({}); // 메일함마다 메일 수(조건 없이)
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MailDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ALL_VIEWS.forEach((item) => {
      api
        .mailMessages({ ...item.params, page: 1, size: 1 })
        .then((result) => !cancelled && setCounts((prev) => ({ ...prev, [item.key]: result.total })))
        .catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 목록이 바뀌면 열어 둔 메일이 목록에 없을 때 첫 메일을 연다(없으면 닫는다).
  useEffect(() => {
    setOpenId((current) => (current && messages.some((m) => m.id === current) ? current : (messages[0]?.id ?? null)));
  }, [messages]);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailError(null);
    api
      .mailMessage(openId)
      .then((mail) => !cancelled && setDetail(mail))
      .catch((e: Error) => !cancelled && setDetailError(e.message));
    return () => {
      cancelled = true;
    };
  }, [openId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const current = detail && detail.id === openId ? detail : null;
  const mailbox = data?.mailbox ?? null;
  const searching = Boolean(search.subject.trim() || search.person.trim() || search.attachOnly);
  const subjectTerms = search.subject.split(/\s+/).filter(Boolean);
  const personTerms = search.person.split(/\s+/).filter(Boolean);
  const allChecked = messages.length > 0 && messages.every((mail) => picked.has(mail.id));
  const toggleAll = () => (allChecked ? picked.removeMany(messages.map((m) => m.id)) : picked.addMany(messages.map(toItem)));

  const send = async () => {
    if (!picked.items.length || sending) return;
    setSending(true);
    const message = await onSend(picked.items);
    setSending(false);
    if (message) {
      picked.clear();
      setToast(message);
      window.setTimeout(onClose, 1800); // 보냈으면 이 탭은 닫는다(스크립트로 연 탭만 닫히고, 아니면 이 화면이 그대로 남는다)
    }
  };

  const capture = async () => {
    if (!current || capturing) return;
    setCapturing(true);
    try {
      const file = await captureMail(current, mailbox);
      const message = await onCapture(file);
      setToast(message ?? "캡처 그림을 원래 창으로 보내지 못했어요.\n자료 등록 화면이 열려 있는지 확인해 주세요.");
    } catch (e) {
      setToast(`캡처하지 못했어요: ${(e as Error).message}`);
    } finally {
      setCapturing(false);
    }
  };

  const viewButton = (item: View) => (
    <button key={item.key} type="button" className={`mbx-view${view.key === item.key ? " on" : ""}`} onClick={() => setView(item)} aria-current={view.key === item.key}>
      <FolderIcon /> <span>{item.label}</span>
      {counts[item.key] !== undefined && <em>{counts[item.key]}</em>}
    </button>
  );

  return (
    <div className="mbx">
      <aside className="mbx-side">
        <h1>메일</h1>
        <button type="button" className="mbx-send" disabled={!picked.items.length || sending} onClick={send}>
          {sending ? "보내는 중…" : `AMIGO 로 보내기${picked.items.length ? ` (${picked.items.length})` : ""}`}
        </button>
        <p className="mbx-side-help">보낼 메일을 표에서 체크하세요.{"\n"}'AI 분석 시작' 때 자료로 등록돼요.</p>

        <Section title="즐겨찾기">{FAVORITES.map(viewButton)}</Section>
        <Section title="메일함">{BOXES.map(viewButton)}</Section>
        <Section title="빠른검색">
          <label className="mbx-quick">
            <span>제목</span>
            <input value={search.subject} onChange={(event) => setSearch({ ...search, subject: event.target.value })} placeholder="관련 제목  예: 유지보수 대금" aria-label="메일 제목 검색어" autoFocus />
          </label>
          <label className="mbx-quick">
            <span>사람</span>
            <input value={search.person} onChange={(event) => setSearch({ ...search, person: event.target.value })} placeholder="관련 사람  예: 박지훈" aria-label="관련 사람 이름" />
          </label>
          <label className="mbx-quick-check">
            <input type="checkbox" checked={search.attachOnly} onChange={(event) => setSearch({ ...search, attachOnly: event.target.checked })} /> 첨부파일 있는 메일만
          </label>
          {searching && <button type="button" className="mbx-link" onClick={() => setSearch({ subject: "", person: "", attachOnly: false })}>검색 조건 지우기</button>}
          <p className="mbx-quick-note">사람은 보낸 사람·받는 사람·참조에서 찾아요.</p>
        </Section>

        <div className="mbx-side-foot">
          <strong>{data?.provider === "mock" || !data ? "메일함" : data.provider}</strong>
          <span>{mailbox?.email}</span>
          <button type="button" className="mbx-link" onClick={onClose}>이 탭 닫기</button>
        </div>
      </aside>

      <main className="mbx-main">
        <header className="mbx-title">
          <h2>{view.label}</h2>
          <span>{data ? `${searching ? "검색 결과 " : "전체 "}${data.total}통` : ""}{picked.items.length ? ` · 선택 ${picked.items.length}통` : ""}</span>
        </header>
        {warning && <p className="mbx-banner" role="alert">{warning}</p>}

        <div className="mbx-table-wrap">
          <table className="mbx-table">
            <thead>
              <tr>
                <th className="c-check"><input type="checkbox" checked={allChecked} disabled={!messages.length} onChange={toggleAll} aria-label="전체 선택" /></th>
                <th className="c-star" aria-label="중요" />
                <th className="c-from">{view.key === "sent" ? "받는사람" : "보낸사람"}</th>
                <th>제목</th>
                <th className="c-clip" aria-label="첨부" />
                <th className="c-date">날짜</th>
              </tr>
            </thead>
            <tbody>
              {listError && <tr><td colSpan={6} className="mbx-empty error" role="alert">{listError}</td></tr>}
              {!data && !listError && <tr><td colSpan={6} className="mbx-empty">불러오는 중…</td></tr>}
              {data && !messages.length && !loading && <tr><td colSpan={6} className="mbx-empty">{searching ? "조건에 맞는 메일이 없어요. 다른 제목이나 이름으로 찾아보세요." : "메일이 없어요."}</td></tr>}
              {messages.map((mail) => (
                <tr key={mail.id} className={`${mail.id === openId ? "current" : ""}${picked.has(mail.id) ? " picked" : ""}`} onClick={() => setOpenId(mail.id)}>
                  <td className="c-check" onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" checked={picked.has(mail.id)} onChange={() => picked.toggle(toItem(mail))} aria-label={`${mail.subject} 선택`} />
                  </td>
                  <td className={`c-star${mail.important ? " on" : ""}`}><StarIcon on={mail.important} /></td>
                  <td className="c-from">{highlight(mail.folder === "sent" ? mail.to.map(who).join(", ") : who(mail.sender), personTerms)}</td>
                  <td className="c-subject"><span>{highlight(mail.subject, subjectTerms)}</span></td>
                  <td className="c-clip">{mail.has_attachments && <ClipIcon />}</td>
                  <td className="c-date">{listDate(mail.sent_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.has_next && <button type="button" className="mbx-more" disabled={loading} onClick={() => void loadMore()}>더 보기 ({messages.length}/{data.total})</button>}
        </div>

        <article className="mbx-preview" aria-label="메일 미리보기">
          {detailError && <p className="mbx-banner" role="alert">{detailError}</p>}
          {current ? (
            <>
              <header className="mbx-preview-head">
                <h3>{current.important && <i className="mbx-star-on"><StarIcon on /></i>}{current.subject}</h3>
                <span className="mbx-preview-actions">
                  <button type="button" disabled={capturing} onClick={() => void capture()} title="이 메일을 그림(PNG)으로 만들어 자료로 올려요">{capturing ? "만드는 중…" : "캡처로 올리기"}</button>
                  <button type="button" className={picked.has(current.id) ? "on" : ""} onClick={() => picked.toggle(toItem(current))} aria-pressed={picked.has(current.id)}>
                    {picked.has(current.id) ? <><CheckIcon /> 선택됨</> : "자료로 선택"}
                  </button>
                </span>
              </header>
              <dl className="mbx-meta">
                <div><dt>보낸사람</dt><dd>{who(current.sender)} &lt;{current.sender.email}&gt;</dd></div>
                <div><dt>받는사람</dt><dd>{current.to.map((a) => `${who(a)} <${a.email}>`).join(", ")}</dd></div>
                {current.cc.length > 0 && <div><dt>참조</dt><dd>{current.cc.map((a) => `${who(a)} <${a.email}>`).join(", ")}</dd></div>}
                <div><dt>날짜</dt><dd>{formatMailDate(current.sent_at)}</dd></div>
                {current.attachments.length > 0 && (
                  <div>
                    <dt>첨부파일</dt>
                    <dd className="mbx-files">
                      <b>{current.attachments.length}개</b>
                      {current.attachments.map((file) => <span key={file.name}><ClipIcon size={12} /> {file.name} <small>({sizeLabel(file.size)})</small></span>)}
                    </dd>
                  </div>
                )}
              </dl>
              <pre className="mbx-body">{current.body}</pre>
            </>
          ) : (
            <p className="mbx-empty">{data ? "목록에서 메일을 선택하면 내용이 보여요." : ""}</p>
          )}
        </article>
      </main>

      {toast && (
        <div className="mbx-toast" role="status">
          <CheckIcon size={15} /> {toast}
        </div>
      )}
    </div>
  );
}
