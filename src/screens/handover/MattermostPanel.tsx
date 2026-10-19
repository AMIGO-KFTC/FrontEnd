import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/shared/api";
import { Icon } from "@/shared/Icon";
import { highlight, shortDate } from "@/shared/highlight";
import type { IntegrationImportResult, MattermostConversation, MattermostPost, Source } from "@/shared/types";

type Props = {
  sources: Source[]; // 이미 등록된 자료(등록된 대화는 체크 해제 불가)
  busy: boolean;
  onImport: (conversationIds: string[]) => Promise<IntegrationImportResult | undefined>;
};

const TYPE_LABEL: Record<MattermostConversation["type"], string> = { channel: "채널", private: "비공개", group: "그룹", dm: "DM" };

export function MattermostPanel({ sources, busy, onImport }: Props) {
  const [rows, setRows] = useState<MattermostConversation[] | null>(null);
  const [me, setMe] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState<string | null>(null);
  const [posts, setPosts] = useState<Record<string, MattermostPost[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const loadedOnce = useRef(false);

  // 찾기 입력은 서버에서 대화 이름·참여자·모든 메시지 내용을 대상으로 검색한다(입력이 멈추면 250ms 뒤).
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        api
          .mattermostConversations(filter.trim())
          .then((data) => {
            if (cancelled) return;
            setRows(data.conversations);
            setMe(data.me);
            setLoadError(null);
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
  }, [filter]);

  const registered = useMemo(() => new Set(sources.filter((s) => s.link_type === "mattermost").map((s) => s.url)), [sources]);
  const terms = useMemo(() => (filter.trim() ? filter.trim().split(/\s+/) : []), [filter]);
  const visible = rows ?? [];

  const selectable = visible.filter((row) => !registered.has(row.url));
  const allChecked = selectable.length > 0 && selectable.every((row) => selected.has(row.id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) selectable.forEach((row) => next.delete(row.id));
      else selectable.forEach((row) => next.add(row.id));
      return next;
    });
  };
  const open = (id: string) => {
    if (opened === id) {
      setOpened(null);
      return;
    }
    setOpened(id);
    if (!posts[id]) {
      api
        .mattermostConversation(id)
        .then((detail) => setPosts((prev) => ({ ...prev, [id]: detail.posts })))
        .catch((e: Error) => setLoadError(e.message));
    }
  };
  const submit = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setImporting(true);
    setNotice(null);
    const result = await onImport(ids);
    setImporting(false);
    if (result) {
      setSelected(new Set());
      setNotice(result.message);
    }
  };

  return (
    <section className="integration-panel">
      <div className="integration-head">
        <span><Icon name="message" size={15} /></span>
        <div>
          <strong>Mattermost 최근 대화</strong>
          <p>{me ? `${me} 계정 · ` : ""}가상 데이터예요. 인수인계에 쓸 대화를 체크하면 자료로 등록돼요.</p>
        </div>
        <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="대화·참여자·내용 찾기" aria-label="대화 찾기" />
      </div>
      {loadError && <p className="integration-error" role="alert">{loadError}</p>}
      {rows === null && !loadError && <p className="integration-empty">대화 목록을 불러오는 중…</p>}
      {rows !== null && (
        <>
          <div className="integration-list-head">
            <label><input type="checkbox" checked={allChecked} disabled={!selectable.length} onChange={toggleAll} /> 전체 선택</label>
            <span>{visible.length}개 대화 · 최근 순</span>
          </div>
          <ul className="integration-list">
            {visible.map((row) => {
              const done = registered.has(row.url);
              const checked = done || selected.has(row.id);
              const isOpen = opened === row.id;
              return (
                <li key={row.id} className={`integration-row${checked ? " checked" : ""}${done ? " registered" : ""}`}>
                  <input type="checkbox" checked={checked} disabled={done} onChange={() => toggle(row.id)} aria-label={`${row.display_name} 선택`} />
                  <div className="integration-row-body">
                    <div className="integration-row-title">
                      <span className={`mm-type mm-${row.type}`}>{TYPE_LABEL[row.type]}</span>
                      <strong>{highlight(row.display_name, terms)}</strong>
                      <time>{shortDate(row.last_post_at)}</time>
                    </div>
                    <small className="integration-row-meta">
                      {highlight(row.members.join(", "), terms)} · 메시지 {row.message_count}건
                      {done && <em className="registered-tag">등록됨</em>}
                    </small>
                    <p className="integration-row-preview">
                      <b>{row.last_message.user_name}</b>: {highlight(row.last_message.text, terms)}
                    </p>
                    <button type="button" className="integration-more" onClick={() => open(row.id)}>
                      {isOpen ? "접기" : "대화 보기"} <Icon name="chevron" size={11} />
                    </button>
                    {isOpen && (
                      <div className="mm-thread">
                        {!posts[row.id] && <p className="integration-empty">불러오는 중…</p>}
                        {posts[row.id]?.map((post) => (
                          <div key={post.id} className={`mm-post${post.mine ? " mine" : ""}`}>
                            <div className="mm-post-head"><strong>{post.user_name}</strong>{post.user_org && <span>{post.user_org}</span>}<time>{shortDate(post.created_at)}</time></div>
                            <p>{highlight(post.text, terms)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            {!visible.length && <li className="integration-empty">'{filter}' 이(가) 들어간 대화가 없어요.</li>}
          </ul>
          <div className="integration-foot">
            <span>{selected.size ? `${selected.size}개 선택됨` : "대화를 선택해 주세요"}</span>
            {notice && <em className="integration-notice">{notice}</em>}
            <button type="button" className="integration-submit" disabled={!selected.size || busy || importing} onClick={submit}>
              <Icon name="check" size={13} /> 선택한 대화 자료로 등록
            </button>
          </div>
        </>
      )}
    </section>
  );
}
