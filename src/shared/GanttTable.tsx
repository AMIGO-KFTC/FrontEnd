import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { EditableCell } from "./EditableCell";

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

// 일정표의 달 칸 하나. key 는 서버로 보내는 값(1~12월 표는 1~12, 해를 넘기는 표는 YYYYMM).
// quarter 가 있으면 분기 칸(전년·다음 해에 걸치는 표). 이 칸을 고르면 그 분기의 세 달이 계획기간으로 저장된다(months).
type Column = { key: number; month: number; year: number | null; label?: string; months: number[] };
const MONTHS: Column[] = Array.from({ length: 12 }, (_, i) => ({ key: i + 1, month: i + 1, year: null, months: [i + 1] }));
const monthNumber = (cell: Hast) => Number(textOf(cell).trim().replace(/월$/, ""));
const quarterNumber = (cell: Hast) => (/^([1-4])분기$/.exec(textOf(cell).trim()) ? Number(textOf(cell).trim()[0]) : 0);

/** 해를 넘기는 표(머리글 3행: '단위업무명 | 계획기간 | 진행상황 요약' + '2026년 | 2027년' + '12월 1월 …')의 달 칸 목록. 아니면 null. */
function yearColumns(rows: Hast[]): Column[] | null {
  const [first, second, third] = rows;
  if (!first || !second || !third) return null;
  const top = elements(first, "th");
  const years = elements(second, "th");
  const months = elements(third, "th");
  // 분기 표는 연도마다 4칸이라 2개 연도에 걸치면 8칸이다(예전에는 12칸 미만이면 일정표로 보지 않아 2개 연도 표는 막대를 못 고쳤다). 월 표는 12칸 이상.
  const quarterly = months.length > 0 && months.every((cell) => quarterNumber(cell));
  if (top.length !== 3 || !years.length || spanOf(top[1]) !== months.length || months.length < (quarterly ? 4 : 12)) return null;
  const yearOf: number[] = years.flatMap((cell) => Array.from({ length: spanOf(cell) }, () => Number(textOf(cell).trim().replace(/년$/, ""))));
  if (yearOf.length !== months.length || yearOf.some((y) => !Number.isFinite(y))) return null;
  if (quarterly) {
    return months.map((cell, i) => {
      const q = quarterNumber(cell);
      const first = (q - 1) * 3 + 1;
      return { key: yearOf[i] * 100 + first, month: first, year: yearOf[i], label: `${q}분기`, months: [0, 1, 2].map((d) => yearOf[i] * 100 + first + d) };
    });
  }
  const columns = months.map((cell, i) => ({ key: yearOf[i] * 100 + monthNumber(cell), month: monthNumber(cell), year: yearOf[i], months: [yearOf[i] * 100 + monthNumber(cell)] }));
  return columns.every((c) => c.month >= 1 && c.month <= 12) ? columns : null;
}

/** 머리글 행 수와 달 칸: 3행(해를 넘기는 표), 2행('단위업무명 | 계획기간(12칸 병합) | 진행상황 요약' + '1월 … 12월'), 예전 문서의 1행('이름 | 1월 … 12월 | 진행상황 요약'), 일정표가 아니면 0. */
function layoutOf(table: Hast): { heads: number; columns: Column[] } {
  const rows = rowsOf(table);
  const [first, second] = rows;
  if (!first) return { heads: 0, columns: [] };
  const top = elements(first, "th");
  if (top.length === 14 && isMonthRow(top, 1)) return { heads: 1, columns: MONTHS };
  if (top.length === 3 && spanOf(top[1]) === 12 && second && isMonthRow(elements(second, "th"), 0)) return { heads: 2, columns: MONTHS };
  const columns = yearColumns(rows);
  return columns ? { heads: 3, columns } : { heads: 0, columns: [] };
}

export function isGanttTable(table: Hast): boolean {
  return layoutOf(table).heads > 0;
}

// '직접 수정하기' 중이면 칸 안에 입력칸 표시(<span data-cell>)가 있다. 그 번호(없으면 null).
function editId(node: Hast): number | null {
  if (node.type === "element" && node.tagName === "span" && node.properties?.dataCell !== undefined) return Number(node.properties.dataCell);
  for (const child of node.children ?? []) {
    const id = editId(child);
    if (id !== null) return id;
  }
  return null;
}

function monthsOfRow(row: Hast, columns: Column[]): { name: string; months: Set<number>; note: string; nameId: number | null; noteId: number | null } | null {
  const cells = elements(row, "td");
  if (cells.length < 3) return null;
  const months = new Set<number>(); // 칠해진 칸의 key
  let index = 0;
  for (const cell of cells.slice(1, -1)) {
    const span = spanOf(cell);
    if (isBar(cell)) for (let i = index; i < index + span && i < columns.length; i += 1) months.add(columns[i].key);
    index += span;
  }
  if (index !== columns.length) return null; // 달 칸 수가 머리글과 다른 행은 손대지 않는다
  const last = cells[cells.length - 1];
  return { name: textOf(cells[0]).trim(), months, note: textOf(last), nameId: editId(cells[0]), noteId: editId(last) };
}

function GanttRow({ name, months, note, nth, nameId, noteId, columns }: { name: string; months: Set<number>; note: string; nth: number; nameId: number | null; noteId: number | null; columns: Column[] }) {
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
      // 서버가 돌려준 문서로 바뀔 때까지 고친 모양을 그대로 보여 준다(실패하면 원래대로). 분기 칸은 그 분기의 세 달로 풀어 보낸다.
      const saved = [...new Set(columns.filter((column) => next.includes(column.key)).flatMap((column) => column.months))].sort((a, b) => a - b);
      onChange(name, nth, saved).catch(() => setDraft(null));
    };
    window.addEventListener("pointerup", finish);
    return () => window.removeEventListener("pointerup", finish);
  }, [months, name, nth, onChange, columns]);

  // state.last 는 직전 칸의 순번(columns 의 index)
  const apply = (index: number) => {
    const state = drag.current;
    if (!state) return;
    // 마우스가 빠르면 사이 칸을 건너뛰므로, 직전 칸부터 지금 칸까지 한꺼번에 칠한다.
    const next = new Set(state.current);
    for (let i = Math.min(state.last, index); i <= Math.max(state.last, index); i += 1) {
      if (state.paint) next.add(columns[i].key);
      else next.delete(columns[i].key);
    }
    state.current = next;
    state.last = index;
    setDraft(next);
  };

  const cells: ReactNode[] = columns.map((column, index) => {
    const on = shown.has(column.key);
    const joined = on && index > 0 && shown.has(columns[index - 1].key);
    return (
      <td
        key={column.key}
        className={`${on ? "bar" : ""} ${joined ? "joined" : ""} ${editable ? "gantt-cell" : ""}`.trim()}
        onPointerDown={editable ? (event) => {
          event.preventDefault();
          drag.current = { paint: !shown.has(column.key), current: new Set(shown), last: index };
          apply(index);
        } : undefined}
        onPointerEnter={editable ? () => apply(index) : undefined}
      >{on ? " " : ""}</td>
    );
  });
  return (
    <tr className={editable && shown.size === 0 ? "needs-fill-row" : undefined}>
      <td>{nameId !== null ? <EditableCell id={nameId} /> : name}</td>
      {cells}
      <td>{noteId !== null ? <EditableCell id={noteId} /> : note}</td>
    </tr>
  );
}

/** react-markdown 의 table 자리에 끼우는 컴포넌트. 월별 일정표가 아니면 평범한 표로 그린다. */
export function GanttAwareTable({ node, children }: { node?: Hast; children?: ReactNode }) {
  const { editable } = useContext(GanttContext);
  if (!node || !isGanttTable(node)) return <table>{children}</table>;
  const rows = rowsOf(node);
  const { heads, columns } = layoutOf(node);
  const top = elements(rows[0], "th");
  const name = textOf(top[0]);
  const note = textOf(top[top.length - 1]);
  const period = heads >= 2 ? textOf(top[1]) : "계획기간"; // 예전 문서(1행 머리글)도 2행으로 보여 준다
  const years: { year: number; span: number }[] = []; // 해를 넘기는 표의 연도 머리글
  for (const column of columns) {
    if (column.year === null) break;
    const last = years[years.length - 1];
    if (last && last.year === column.year) last.span += 1;
    else years.push({ year: column.year, span: 1 });
  }
  const headSpan = years.length ? 3 : 2;
  const seen = new Map<string, number>();
  return (
    <table className={`gantt-table ${editable ? "gantt-editable" : ""} ${years.length ? "gantt-years" : ""}`.trim()}>
      <thead>
        <tr><th rowSpan={headSpan}>{name}</th><th colSpan={columns.length}>{period}</th><th rowSpan={headSpan}>{note}</th></tr>
        {years.length > 0 && <tr>{years.map((y) => <th key={y.year} colSpan={y.span}>{y.year}년</th>)}</tr>}
        <tr>{columns.map((column) => <th key={column.key}>{column.label ?? `${column.month}월`}</th>)}</tr>
      </thead>
      <tbody>
        {rows.slice(heads).map((row, index) => {
          const parsed = monthsOfRow(row, columns);
          if (!parsed) return <tr key={index}>{elements(row, "td").map((cell, i) => <td key={i}>{textOf(cell)}</td>)}</tr>;
          const nth = seen.get(parsed.name) ?? 0;
          seen.set(parsed.name, nth + 1);
          return <GanttRow key={`${parsed.name}-${nth}`} {...parsed} nth={nth} columns={columns} />;
        })}
      </tbody>
    </table>
  );
}
