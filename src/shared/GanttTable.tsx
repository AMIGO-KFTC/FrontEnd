import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// 월별 일정표(업무 단위 요약 + 일정 명세표)의 막대를 화면에서 마우스로 고친다.
// 고친 월 목록은 서버로 보내 계획기간으로 확정되고(재생성해도 유지), 서버가 다시 만든 문서가 돌아와 표가 갱신된다(GanttContext.onChange).
type Hast = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: Hast[] };

export type GanttContextValue = {
  editable: boolean;
  onChange: (name: string, nth: number, months: number[]) => Promise<void>;
};

export const GanttContext = createContext<GanttContextValue>({ editable: false, onChange: async () => {} });

const elements = (node: Hast, tag: string) => (node.children ?? []).filter((child) => child.type === "element" && child.tagName === tag);
const textOf = (node: Hast): string => (node.type === "text" ? node.value ?? "" : (node.children ?? []).map(textOf).join(""));
const spanOf = (cell: Hast) => Number(cell.properties?.colSpan ?? 1) || 1;
const isBar = (cell: Hast) => {
  const names = cell.properties?.className;
  return Array.isArray(names) ? names.includes("bar") : String(names ?? "").split(" ").includes("bar");
};

const rowsOf = (table: Hast) => elements(table, "thead").concat(elements(table, "tbody")).flatMap((part) => elements(part, "tr")).concat(elements(table, "tr"));

const isMonthRow = (cells: Hast[], from: number) => cells.length >= from + 12 && textOf(cells[from]).trim() === "1월" && textOf(cells[from + 11]).trim() === "12월";

/** 머리글 행 수: 2행('단위업무명 | 계획기간(12칸 병합) | 진행상황 요약' + '1월 … 12월'), 예전 문서의 1행('이름 | 1월 … 12월 | 진행상황 요약'), 일정표가 아니면 0. */
function headerRows(table: Hast): number {
  const [first, second] = rowsOf(table);
  if (!first) return 0;
  const top = elements(first, "th");
  if (top.length === 14 && isMonthRow(top, 1)) return 1;
  if (top.length === 3 && spanOf(top[1]) === 12 && second && isMonthRow(elements(second, "th"), 0)) return 2;
  return 0;
}

export function isGanttTable(table: Hast): boolean {
  return headerRows(table) > 0;
}

function monthsOfRow(row: Hast): { name: string; months: Set<number>; note: string } | null {
  const cells = elements(row, "td");
  if (cells.length < 3) return null;
  const months = new Set<number>();
  let month = 1;
  for (const cell of cells.slice(1, -1)) {
    const span = spanOf(cell);
    if (isBar(cell)) for (let m = month; m < month + span; m += 1) months.add(m);
    month += span;
  }
  if (month !== 13) return null; // 1~12월 칸이 아닌 행은 손대지 않는다
  return { name: textOf(cells[0]).trim(), months, note: textOf(cells[cells.length - 1]) };
}

function GanttRow({ name, months, note, nth }: { name: string; months: Set<number>; note: string; nth: number }) {
  const { editable, onChange } = useContext(GanttContext);
  const [draft, setDraft] = useState<Set<number> | null>(null);
  const drag = useRef<{ paint: boolean; current: Set<number>; last: number } | null>(null);
  const shown = draft ?? months;
  const monthsKey = [...months].sort((a, b) => a - b).join();
  useEffect(() => { if (!drag.current) setDraft(null); }, [monthsKey]);

  useEffect(() => {
    const finish = () => {
      const state = drag.current;
      if (!state) return;
      drag.current = null;
      const next = [...state.current].sort((a, b) => a - b);
      const before = [...months].sort((a, b) => a - b);
      if (next.join() === before.join()) return setDraft(null);
      // 서버가 돌려준 문서로 바뀔 때까지 고친 모양을 그대로 보여 준다(실패하면 원래대로)
      onChange(name, nth, next).catch(() => setDraft(null));
    };
    window.addEventListener("pointerup", finish);
    return () => window.removeEventListener("pointerup", finish);
  }, [months, name, nth, onChange]);

  const apply = (month: number) => {
    const state = drag.current;
    if (!state) return;
    // 마우스가 빠르면 사이 칸을 건너뛰므로, 직전 칸부터 지금 칸까지 한꺼번에 칠한다.
    const next = new Set(state.current);
    for (let m = Math.min(state.last, month); m <= Math.max(state.last, month); m += 1) {
      if (state.paint) next.add(m);
      else next.delete(m);
    }
    state.current = next;
    state.last = month;
    setDraft(next);
  };

  const cells: ReactNode[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const on = shown.has(month);
    const joined = on && shown.has(month - 1);
    cells.push(
      <td
        key={month}
        className={`${on ? "bar" : ""} ${joined ? "joined" : ""} ${editable ? "gantt-cell" : ""}`.trim()}
        onPointerDown={editable ? (event) => {
          event.preventDefault();
          drag.current = { paint: !shown.has(month), current: new Set(shown), last: month };
          apply(month);
        } : undefined}
        onPointerEnter={editable ? () => apply(month) : undefined}
      >{on ? " " : ""}</td>,
    );
  }
  return <tr><td>{name}</td>{cells}<td>{note}</td></tr>;
}

/** react-markdown 의 table 자리에 끼우는 컴포넌트. 월별 일정표가 아니면 평범한 표로 그린다. */
export function GanttAwareTable({ node, children }: { node?: Hast; children?: ReactNode }) {
  const { editable } = useContext(GanttContext);
  if (!node || !isGanttTable(node)) return <table>{children}</table>;
  const rows = rowsOf(node);
  const heads = headerRows(node);
  const top = elements(rows[0], "th");
  const name = textOf(top[0]);
  const note = textOf(top[top.length - 1]);
  const period = heads === 2 ? textOf(top[1]) : "계획기간"; // 예전 문서(1행 머리글)도 2행으로 보여 준다
  const seen = new Map<string, number>();
  return (
    <table className={`gantt-table ${editable ? "gantt-editable" : ""}`}>
      <thead>
        <tr><th rowSpan={2}>{name}</th><th colSpan={12}>{period}</th><th rowSpan={2}>{note}</th></tr>
        <tr>{Array.from({ length: 12 }, (_, i) => <th key={i}>{i + 1}월</th>)}</tr>
      </thead>
      <tbody>
        {rows.slice(heads).map((row, index) => {
          const parsed = monthsOfRow(row);
          if (!parsed) return <tr key={index}>{elements(row, "td").map((cell, i) => <td key={i}>{textOf(cell)}</td>)}</tr>;
          const nth = seen.get(parsed.name) ?? 0;
          seen.set(parsed.name, nth + 1);
          return <GanttRow key={`${parsed.name}-${nth}`} {...parsed} nth={nth} />;
        })}
      </tbody>
    </table>
  );
}
