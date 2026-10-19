import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/shared/api";
import { Icon } from "@/shared/Icon";
import { highlight, shortDate } from "@/shared/highlight";
import { PickedChips } from "./PickedChips";
import type { Picked, PickItem } from "@/shared/pickBridge";
import type { IntegrationImportResult, MattermostConversation, MattermostPost, Source } from "@/shared/types";

type Props = {
  sources: Source[]; // 이미 등록된 자료(등록된 대화는 체크 해제 불가)
  busy: boolean;
  picked: Picked; // 고른 대화(다른 탭에서 보내 온 것 포함). 화면이 들고 있어 패널을 닫아도 남는다.
  onImport?: (conversationIds: string[]) => Promise<IntegrationImportResult | undefined>; // 자료 등록(원래 창)
  onSend?: (items: PickItem[]) => Promise<string | undefined>; // 원래 창으로 보내기(새 탭 선택 창). 있으면 onImport 대신 쓴다.
  onPopOut?: () => void; // 새 탭에서 열기(원래 창에서만)
};

const TYPE_LABEL: Record<MattermostConversation["type"], string> = { channel: "채널", private: "비공개", group: "그룹", dm: "DM" };

export function MattermostPanel({ sources, busy, picked, onImport, onSend, onPopOut }: Props) {
  const [rows, setRows] = useState<MattermostConversation[] | null>(null);
  const [me, setMe] = useState("");
  const [filter, setFilter] = useState("");
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
  const allChecked = selectable.length > 0 && selectable.every((row) => picked.has(row.id));

  const toItem = (row: MattermostConversation): PickItem => ({ id: row.id, title: row.display_name, url: row.url });
  const toggle = (row: MattermostConversation) => picked.toggle(toItem(row));
  const toggleAll = () => {
    if (allChecked) picked.removeMany(selectable.map((row) => row.id));
    else picked.addMany(selectable.map(toItem));
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
    if (!picked.items.length) return;
    setImporting(true);
    setNotice(null);
    if (onSend) {
      const message = await onSend(picked.items);
      if (message) {
        picked.clear();
        setNotice(message);
      }
    } else if (onImport) {
      const result = await onImport(picked.items.map((item) => item.id));
      if (result) {
        picked.clear();
        setNotice(result.message);
      }
    }
    setImporting(false);
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
        {onPopOut && (
          <button type="button" className="integration-popout" onClick={onPopOut} title="이 목록을 새 탭에서 열어요. 거기서 고른 대화는 이 창으로 넘어와요.">
            <Icon name="chevron" size={11} /> 새 탭에서 열기
          </button>
        )}
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
              const checked = done || picked.has(row.id);
              const isOpen = opened === row.id;
              return (
                <li key={row.id} className={`integration-row${checked ? " checked" : ""}${done ? " registered" : ""}`}>
                  <input type="checkbox" checked={checked} disabled={done} onChange={() => toggle(row)} aria-label={`${row.display_name} 선택`} />
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
          <PickedChips picked={picked} />
          <div className="integration-foot">
            <span>{picked.items.length ? `${picked.items.length}개 선택됨` : "대화를 선택해 주세요"}</span>
            {notice && <em className="integration-notice">{notice}</em>}
            <button type="button" className="integration-submit" disabled={!picked.items.length || busy || importing} onClick={submit}>
              <Icon name="check" size={13} /> {onSend ? "선택한 대화 원래 창으로 보내기" : "선택한 대화 자료로 등록"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
