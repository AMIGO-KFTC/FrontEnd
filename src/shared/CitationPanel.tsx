// 근거 원문 패널: 문서의 근거 번호([1] …)가 가리키는 자료의 인용문과 원문 조각을 오른쪽에 보여 준다.
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "./Icon";
import type { CitationDetail } from "./types";

type Props = {
  citations: CitationDetail[];
  selected: number | null;
  slotTitles: Record<string, string>;
  onClose: () => void;
};

export function CitationPanel({ citations, selected, slotTitles, onClose }: Props) {
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  // 번호를 눌러 열면 그 근거로 스크롤하고 원문을 펼친다.
  useEffect(() => {
    if (selected === null) return;
    setOpened((current) => new Set(current).add(selected));
    listRef.current?.querySelector(`[data-card="${selected}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (n: number) =>
    setOpened((current) => {
      const next = new Set(current);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  return (
    <aside className="cite-panel" aria-label="근거 원문">
      <header className="cite-panel-head">
        <div><strong>근거 원문</strong><small>{citations.length}개</small></div>
        <button onClick={onClose} aria-label="닫기"><Icon name="close" size={15} /></button>
      </header>
      <div className="cite-panel-body" ref={listRef}>
        {citations.length === 0 && <p className="cite-empty">연결된 근거가 없어요.</p>}
        {citations.map((c) => {
          const open = opened.has(c.number);
          const slot = slotTitles[c.slot];
          return (
            <article key={c.number} data-card={c.number} className={`cite-card ${selected === c.number ? "selected" : ""}`}>
              <div className="cite-card-top"><span className="cite-badge">[{c.number}]</span><strong>{c.label || c.source_name || "인계자 답변"}</strong></div>
              <div className="cite-card-meta">{c.kind === "answer" ? "인계자 답변" : "올린 자료"}{slot ? ` · ${slot}` : ""}</div>
              <blockquote>{c.quote}</blockquote>
              {c.text && c.text !== c.quote && (
                <>
                  <button className="cite-toggle" onClick={() => toggle(c.number)} aria-expanded={open}>{open ? "원문 접기" : "원문 보기"}</button>
                  {open && <div className="cite-text"><ReactMarkdown remarkPlugins={[remarkGfm]}>{c.text}</ReactMarkdown></div>}
                </>
              )}
            </article>
          );
        })}
      </div>
    </aside>
  );
}
