// 시작 화면 아래의 "진행 중인 작업" 목록: 이전에 만든 인수인계 작업을 골라 이어서 하거나 지운다.
import { useState } from "react";
import { Icon } from "./Icon";
import type { ConversationProgress } from "./types";

const VISIBLE = 5;

function when(iso: string): string {
  const date = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`);
  return date.toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function tone(item: ConversationProgress): string {
  if (item.status === "error") return "error";
  return item.stage === "review" ? "done" : "working";
}

type Props = {
  items: ConversationProgress[];
  onOpen: (id: string) => void;
  onDelete: (item: ConversationProgress) => void;
};

export function RecentWorks({ items, onOpen, onDelete }: Props) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, VISIBLE);

  return (
    <section className="recent-works" aria-label="진행 중인 작업">
      <div className="recent-works-title"><strong>진행 중인 작업</strong><small>{items.length}개</small></div>
      <ul>
        {shown.map((item) => (
          <li key={item.session_id}>
            <button className="recent-work-open" onClick={() => onOpen(item.session_id)}>
              <span className="recent-work-head">
                <strong>{item.title}</strong>
                <em className={`recent-work-stage ${tone(item)}`}>{item.status === "error" ? "멈춤" : item.stage_label}</em>
              </span>
              <span className="recent-work-meta">{item.next_action_label} · {when(item.last_activity_at)}</span>
            </button>
            <button className="recent-work-delete" onClick={() => onDelete(item)} aria-label={`${item.title} 삭제`}><Icon name="close" size={13} /></button>
          </li>
        ))}
      </ul>
      {items.length > VISIBLE && (
        <button className="recent-works-more" onClick={() => setAll((current) => !current)}>{all ? "접기" : `더 보기 (${items.length - VISIBLE})`}</button>
      )}
    </section>
  );
}
