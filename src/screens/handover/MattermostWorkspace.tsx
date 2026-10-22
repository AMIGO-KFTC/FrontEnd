import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/shared/api";
import { highlight } from "@/shared/highlight";
import type { Picked, PickItem } from "@/shared/pickBridge";
import type { MattermostConversation, MattermostPost } from "@/shared/types";
import "./mattermostWorkspace.css";

// 새 탭 선택 창의 Mattermost 화면. 실제 Mattermost 처럼 왼쪽 사이드바에서 채널·그룹·DM 을 열어 대화를 읽고,
// 채널 머리글의 '자료로 선택' 으로 인수인계에 쓸 대화를 고른다. 고른 대화는 위쪽 '원래 창으로 보내기' 로 AMIGO 창에 넘긴다.
// (데이터는 BackEnd 의 가상 예시 데이터다.)

type Props = {
  picked: Picked;
  onSend: (items: PickItem[]) => Promise<string | undefined>; // 보낸 결과 안내(성공 시 문장, 실패 시 undefined)
  warning: string | null;
  onClose: () => void;
};

const SECTIONS: { key: string; label: string; types: MattermostConversation["type"][] }[] = [
  { key: "channels", label: "채널", types: ["channel", "private"] },
  { key: "groups", label: "그룹 메시지", types: ["group"] },
  { key: "dms", label: "다이렉트 메시지", types: ["dm"] },
];

const AVATAR_COLORS = ["#5d89ea", "#cc8f00", "#3db887", "#d24b4e", "#8e6bd6", "#1f9bb5", "#e07a3f", "#7a8aa5"];
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function hash(text: string): number {
  return Array.from(text).reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7);
}

// "2026-10-16 17:50" → 날짜 구분선 "2026년 10월 16일 (금)" / 시각 "오후 5:50"
function parseStamp(value: string): { day: string; label: string; time: string; minutes: number } {
  const [date = "", clock = "00:00"] = value.split(" ");
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = clock.split(":").map(Number);
  const weekday = WEEKDAY[new Date(y, (m || 1) - 1, d || 1).getDay()];
  return {
    day: date,
    label: `${y}년 ${m}월 ${d}일 (${weekday})`,
    time: `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(min).padStart(2, "0")}`,
    minutes: Math.floor(new Date(y, (m || 1) - 1, d || 1, h, min).getTime() / 60000),
  };
}

// DM 이름 "이수진 대리 (정보보호팀)" 은 사이드바에서 이름만 보여 준다.
const shortName = (row: MattermostConversation) => (row.type === "dm" ? row.display_name.replace(/\s*\(.*\)\s*$/, "") : row.display_name.replace(/^#/, ""));

function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <span className="mmw-avatar" style={{ width: size, height: size, background: AVATAR_COLORS[hash(name) % AVATAR_COLORS.length], fontSize: size * 0.42 }} aria-hidden="true">
      {name.trim().charAt(0)}
    </span>
  );
}

const svgProps = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const GlobeIcon = () => (
  <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></svg>
);
const LockIcon = () => (
  <svg {...svgProps}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
const SearchIcon = () => (
  <svg {...svgProps}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
const CheckIcon = () => (
  <svg {...svgProps} width={14} height={14} strokeWidth={2.6}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
const ChevronIcon = () => (
  <svg {...svgProps} width={12} height={12} strokeWidth={2.6}><path d="m6 9 6 6 6-6" /></svg>
);
const ChatMark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /></svg>
);

function RowIcon({ row }: { row: MattermostConversation }): ReactNode {
  if (row.type === "channel") return <GlobeIcon />;
  if (row.type === "private") return <LockIcon />;
  if (row.type === "group") return <span className="mmw-group-count">{row.member_count}</span>;
  return <Avatar name={shortName(row)} size={20} />;
}

const TYPE_LABEL: Record<MattermostConversation["type"], string> = { channel: "채널", private: "비공개 채널", group: "그룹 메시지", dm: "다이렉트 메시지" };

// 대화 선택 모달: 열려 있는 Mattermost 화면 위에서 인수인계에 쓸 대화를 목록으로 보고 고른다.
function PickModal({ picked, sending, onSubmit, onClose }: { picked: Picked; sending: boolean; onSubmit: () => void; onClose: () => void }) {
  const [rows, setRows] = useState<MattermostConversation[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        api
          .mattermostConversations(query.trim())
          .then((data) => {
            if (cancelled) return;
            setRows(data.conversations);
            setError(null);
          })
          .catch((e: Error) => !cancelled && setError(e.message));
      },
      loadedOnce.current ? 250 : 0,
    );
    loadedOnce.current = true;
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const terms = useMemo(() => (query.trim() ? query.trim().split(/\s+/) : []), [query]);
  const visible = rows ?? [];
  const toItem = (row: MattermostConversation): PickItem => ({ id: row.id, title: row.display_name, url: row.url });
  const allChecked = visible.length > 0 && visible.every((row) => picked.has(row.id));
  const toggleAll = () => {
    if (allChecked) picked.removeMany(visible.map((row) => row.id));
    else picked.addMany(visible.map(toItem));
  };

  return (
    <div className="mmw-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="mmw-modal" role="dialog" aria-modal="true" aria-labelledby="mmw-modal-title" onKeyDown={(event) => event.key === "Escape" && onClose()}>
        <div className="mmw-modal-head">
          <div>
            <h2 id="mmw-modal-title">인수인계에 쓸 대화 선택</h2>
            <p>자료로 등록할 대화를 골라 주세요. 여러 개를 고를 수 있어요.</p>
          </div>
          <button type="button" className="mmw-modal-x" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <label className="mmw-modal-search">
          <SearchIcon />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="대화 이름·참여자·내용으로 찾기" aria-label="대화 찾기" />
        </label>
        <div className="mmw-modal-listhead">
          <label>
            <input type="checkbox" checked={allChecked} disabled={!visible.length} onChange={toggleAll} /> 전체 선택
          </label>
          <span>{rows ? `${visible.length}개 대화 · 최근 순` : ""}</span>
        </div>
        <ul className="mmw-modal-list">
          {error && <li className="mmw-modal-note error" role="alert">{error}</li>}
          {rows === null && !error && <li className="mmw-modal-note">대화 목록을 불러오는 중…</li>}
          {rows !== null && !visible.length && <li className="mmw-modal-note">'{query}' 이(가) 들어간 대화가 없어요.</li>}
          {visible.map((row) => {
            const stamp = parseStamp(row.last_post_at);
            return (
              <li key={row.id}>
                <label className={`mmw-modal-row${picked.has(row.id) ? " checked" : ""}`}>
                  <input type="checkbox" checked={picked.has(row.id)} onChange={() => picked.toggle(toItem(row))} />
                  <span className="mmw-channel-icon mmw-modal-icon"><RowIcon row={row} /></span>
                  <span className="mmw-modal-row-main">
                    <span className="mmw-modal-row-title">
                      <strong>{highlight(row.type === "dm" ? shortName(row) : row.display_name, terms)}</strong>
                      <em>{TYPE_LABEL[row.type]}</em>
                      <time>{stamp.label.replace(/^\d+년 /, "")}</time>
                    </span>
                    <span className="mmw-modal-row-meta">{highlight(row.members.join(", "), terms)} · 메시지 {row.message_count}건</span>
                    <span className="mmw-modal-row-preview"><b>{row.last_message.user_name}</b>: {highlight(row.last_message.text, terms)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="mmw-modal-foot">
          <span>{picked.items.length ? `${picked.items.length}개 선택됨` : "대화를 선택해 주세요"}</span>
          <button type="button" className="mmw-btn secondary" onClick={onClose}>취소</button>
          <button type="button" className="mmw-btn primary" disabled={!picked.items.length || sending} onClick={onSubmit}>
            {sending ? "보내는 중…" : "선택한 대화 AMIGO 로 보내기"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MattermostWorkspace({ picked, onSend, warning, onClose }: Props) {
  const [rows, setRows] = useState<MattermostConversation[] | null>(null);
  const [me, setMe] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Record<string, MattermostPost[]>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<PickItem[]>([]); // 원래 창으로 이미 보낸 대화(보낸 뒤에도 무엇을 보냈는지 보이게)
  const [modalOpen, setModalOpen] = useState(true); // 이 화면이 열리면 대화 선택 모달이 바로 뜬다
  const feedRef = useRef<HTMLDivElement>(null);
  const loadedOnce = useRef(false);

  // 검색은 서버에서 대화 이름·참여자·메시지 내용을 대상으로 한다(입력이 멈추면 250ms 뒤).
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        api
          .mattermostConversations(query.trim())
          .then((data) => {
            if (cancelled) return;
            setRows(data.conversations);
            setMe(data.me);
            setLoadError(null);
            setOpenId((current) => current ?? data.conversations[0]?.id ?? null); // 처음에는 가장 최근 대화를 연다
          })
          .catch((e: Error) => !cancelled && setLoadError(e.message));
      },
      loadedOnce.current ? 250 : 0,
    );
    loadedOnce.current = true;
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!openId || posts[openId]) return;
    let cancelled = false;
    api
      .mattermostConversation(openId)
      .then((detail) => !cancelled && setPosts((prev) => ({ ...prev, [openId]: detail.posts })))
      .catch((e: Error) => !cancelled && setLoadError(e.message));
    return () => {
      cancelled = true;
    };
  }, [openId, posts]);

  // Mattermost 처럼 대화를 열면 가장 최근 메시지가 보이도록 맨 아래로 내린다.
  const openPosts = openId ? posts[openId] : undefined;
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [openId, openPosts]);

  // 보낸 뒤 안내는 몇 초 뒤 사라진다.
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const terms = useMemo(() => (query.trim() ? query.trim().split(/\s+/) : []), [query]);
  const known = useMemo(() => new Map((rows ?? []).map((row) => [row.id, row])), [rows]);
  const current = openId ? known.get(openId) : undefined;
  const toItem = (row: MattermostConversation): PickItem => ({ id: row.id, title: row.display_name, url: row.url });
  const team = rows?.find((row) => row.team)?.team ?? "";

  const send = async () => {
    if (!picked.items.length || sending) return;
    setSending(true);
    const message = await onSend(picked.items);
    setSending(false);
    if (message) {
      setSent((prev) => [...prev.filter((p) => !picked.items.some((i) => i.id === p.id)), ...picked.items]);
      picked.clear();
      setToast(message);
      setModalOpen(false);
      window.setTimeout(onClose, 1800); // 보냈으면 이 탭은 닫는다(스크립트로 연 탭만 닫히고, 아니면 이 화면이 그대로 남는다)
    }
  };

  const feed = (list: MattermostPost[]) => {
    let lastDay = "";
    let lastUser = "";
    let lastMinutes = -1;
    return list.map((post) => {
      const stamp = parseStamp(post.created_at);
      const newDay = stamp.day !== lastDay;
      const follow = !newDay && post.user === lastUser && stamp.minutes - lastMinutes < 5; // 같은 사람이 5분 안에 이어 쓴 글은 머리글 없이 이어 붙인다
      lastDay = stamp.day;
      lastUser = post.user;
      lastMinutes = stamp.minutes;
      return (
        <div key={post.id}>
          {newDay && (
            <div className="mmw-day"><span>{stamp.label}</span></div>
          )}
          <div className={`mmw-post${follow ? " follow" : ""}`}>
            <div className="mmw-post-gutter">{follow ? <time>{stamp.time}</time> : <Avatar name={post.user_name} size={36} />}</div>
            <div className="mmw-post-main">
              {!follow && (
                <div className="mmw-post-head">
                  <strong>{post.user_name}</strong>
                  {post.user_org && <span className="mmw-org">{post.user_org}</span>}
                  <time>{stamp.time}</time>
                </div>
              )}
              <p>{highlight(post.text, terms)}</p>
            </div>
          </div>
        </div>
      );
    });
  };

  const isPicked = (id: string) => picked.has(id);
  const isSent = (id: string) => sent.some((item) => item.id === id);

  return (
    <div className="mmw">
      <header className="mmw-globalbar">
        <div className="mmw-product" aria-hidden="true"><ChatMark /></div>
        <label className="mmw-search">
          <SearchIcon />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="대화·참여자·내용 검색" aria-label="대화 검색" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}
        </label>
        <div className="mmw-globalbar-right">
          <button type="button" className={`mmw-choose${picked.items.length ? " has-picked" : ""}`} onClick={() => setModalOpen(true)}>대화 고르기{picked.items.length ? ` (${picked.items.length})` : ""}</button>
          <button type="button" className="mmw-send" disabled={!picked.items.length || sending} onClick={send}>
            {sending ? "보내는 중…" : `원래 창으로 보내기${picked.items.length ? ` (${picked.items.length})` : ""}`}
          </button>
          <button type="button" className="mmw-close" onClick={onClose}>이 탭 닫기</button>
          <Avatar name={me || "나"} size={28} />
        </div>
      </header>

      <div className="mmw-body">
        <nav className="mmw-teams" aria-label="팀">
          <span className="mmw-team-tile" title={team}>{(team || "팀").charAt(0)}</span>
        </nav>

        <aside className="mmw-sidebar">
          <div className="mmw-sidebar-head">
            <strong>{team || "Mattermost"}</strong>
            <ChevronIcon />
          </div>
          {(picked.items.length > 0 || sent.length > 0) && (
            <div className="mmw-tray" aria-label="내가 고른 대화">
              {picked.items.length > 0 && (
                <>
                  <div className="mmw-tray-title">내가 고른 대화 <b>{picked.items.length}</b></div>
                  {picked.items.map((item) => (
                    <div className={`mmw-tray-item${item.id === openId ? " active" : ""}`} key={item.id}>
                      <button type="button" className="mmw-tray-open" onClick={() => setOpenId(item.id)} title="이 대화 보기">
                        <CheckIcon />
                        <span>{item.title}</span>
                      </button>
                      <button type="button" className="mmw-tray-x" onClick={() => picked.toggle(item)} aria-label={`${item.title} 선택 해제`} title="선택 해제">×</button>
                    </div>
                  ))}
                </>
              )}
              {sent.length > 0 && (
                <>
                  <div className="mmw-tray-title sent">원래 창으로 보낸 대화 <b>{sent.length}</b></div>
                  {sent.map((item) => (
                    <button type="button" className="mmw-tray-item sent" key={item.id} onClick={() => setOpenId(item.id)}>
                      <span>{item.title}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
          <div className="mmw-sidebar-scroll">
            {rows === null && !loadError && <p className="mmw-side-note">불러오는 중…</p>}
            {rows !== null && rows.length === 0 && <p className="mmw-side-note">'{query}' 이(가) 들어간 대화가 없어요.</p>}
            {SECTIONS.map((section) => {
              const items = (rows ?? []).filter((row) => section.types.includes(row.type));
              if (!items.length) return null;
              const folded = collapsed[section.key];
              return (
                <section key={section.key} className="mmw-category">
                  <button type="button" className="mmw-category-head" onClick={() => setCollapsed((prev) => ({ ...prev, [section.key]: !prev[section.key] }))} aria-expanded={!folded}>
                    <span className={folded ? "folded" : ""}><ChevronIcon /></span>
                    {section.label}
                  </button>
                  {!folded &&
                    items.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        className={`mmw-channel${row.id === openId ? " active" : ""}${isPicked(row.id) ? " picked" : ""}`}
                        aria-current={row.id === openId ? "true" : undefined}
                        onClick={() => setOpenId(row.id)}
                      >
                        <span className="mmw-channel-icon"><RowIcon row={row} /></span>
                        <span className="mmw-channel-name">{highlight(shortName(row), terms)}</span>
                        {isPicked(row.id) && <span className="mmw-picked-mark" title="자료로 선택됨"><CheckIcon /></span>}
                        {!isPicked(row.id) && isSent(row.id) && <span className="mmw-sent-mark" title="원래 창으로 보냈어요">보냄</span>}
                      </button>
                    ))}
                </section>
              );
            })}
          </div>
        </aside>

        <main className="mmw-center">
          {loadError && <p className="mmw-error" role="alert">{loadError}</p>}
          {warning && <p className="mmw-error" role="alert">{warning}</p>}
          {current ? (
            <>
              <div className="mmw-channel-header">
                <div className="mmw-channel-title">
                  <span className="mmw-title-icon"><RowIcon row={current} /></span>
                  <h1>{highlight(current.type === "dm" ? shortName(current) : current.display_name, terms)}</h1>
                </div>
                <span className="mmw-header-meta">멤버 {current.member_count}명 · 메시지 {current.message_count}건</span>
                {current.purpose && <span className="mmw-header-purpose">{current.purpose}</span>}
                <button type="button" className={`mmw-pick${isPicked(current.id) ? " on" : ""}`} onClick={() => picked.toggle(toItem(current))} aria-pressed={isPicked(current.id)}>
                  {isPicked(current.id) ? <><CheckIcon /> 선택됨</> : "자료로 선택"}
                </button>
              </div>
              <div className="mmw-feed" ref={feedRef}>
                {!openPosts && <p className="mmw-feed-note">대화를 불러오는 중…</p>}
                {openPosts && (
                  <>
                    <div className="mmw-intro">
                      <Avatar name={shortName(current)} size={64} />
                      <h2>{current.type === "dm" ? shortName(current) : current.display_name}</h2>
                      <p>{current.type === "dm" ? `${shortName(current)}님과 나눈 대화예요.` : `${current.display_name} 의 시작이에요.`} 인수인계에 쓸 대화라면 위의 '자료로 선택' 을 눌러 주세요.</p>
                    </div>
                    {feed(openPosts)}
                  </>
                )}
              </div>
              <div className="mmw-composer" aria-hidden="true">
                <span>가상 데이터라 메시지를 보낼 수 없어요. 읽고 고르기만 할 수 있어요.</span>
              </div>
            </>
          ) : (
            <p className="mmw-feed-note">{rows === null ? "불러오는 중…" : "왼쪽에서 대화를 선택해 주세요."}</p>
          )}
        </main>
      </div>

      {modalOpen && <PickModal picked={picked} sending={sending} onSubmit={send} onClose={() => setModalOpen(false)} />}

      {toast && (
        <div className="mmw-toast" role="status">
          <CheckIcon /> {toast}
        </div>
      )}
    </div>
  );
}
