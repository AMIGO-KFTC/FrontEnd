import { createContext, useContext, useState, type ReactNode } from "react";
import type { DocumentCitation } from "@/shared/types";

// 인수인계서 본문 글 뒤의 근거 번호([1]). 번호에 마우스를 올리면(또는 키보드로 고르면) 그 근거의 출처·문장을 작은 창으로 띄우고,
// 누르면 문서 맨 아래 '근거 자료' 목록의 그 번호로 내려간다(jump).
// 번호별 출처는 GET /api/sessions/{id}/citations 의 number 와 같다(문서를 그릴 때 같은 규칙으로 번호를 매긴다).
export type CitationContextValue = {
  byNumber: Map<number, DocumentCitation>;
  slotTitle: (key: string) => string;
  jump?: (number: number, from: HTMLElement) => void; // 번호를 눌렀을 때. 없으면 누르지 못한다
};

export const CitationContext = createContext<CitationContextValue>({ byNumber: new Map(), slotTitle: (key) => key });

export function CitationRef({ number }: { number: number }) {
  const { byNumber, slotTitle, jump } = useContext(CitationContext);
  const [open, setOpen] = useState(false);
  const cite = byNumber.get(number);
  const source = cite ? (cite.kind === "answer" ? "인계자 답변" : cite.source_name || cite.label) : "";
  const where = cite ? [slotTitle(cite.slot), cite.item_title].filter(Boolean).join(" · ") : "";
  let body: ReactNode = <p className="cite-pop-empty">출처를 불러오는 중이에요.</p>;
  if (cite) {
    body = (
      <>
        <strong className="cite-pop-title">{source}</strong>
        {cite.label && cite.label !== source && <span className="cite-pop-label">{cite.label}</span>}
        {cite.quote && <p className="cite-pop-quote">“{cite.quote}”</p>}
        {where && <span className="cite-pop-where">{where}</span>}
      </>
    );
  }
  return (
    <span
      className={`cite-ref${jump ? " clickable" : ""}`}
      data-cite={number}
      tabIndex={0}
      role="button"
      aria-label={`근거 ${number}${source ? `: ${source}` : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={(event) => {
        if (!jump) return;
        setOpen(false);
        jump(number, event.currentTarget);
      }}
      onKeyDown={(event) => {
        if (!jump || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        setOpen(false);
        jump(number, event.currentTarget);
      }}
    >
      {number}
      {open && <span className="cite-pop" role="tooltip">{body}</span>}
    </span>
  );
}
