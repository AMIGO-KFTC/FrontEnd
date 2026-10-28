// 인수인계서 '직접 수정하기': 표 칸과 항목 이름을 화면에서 바로 고친다.
// 문서 원문(Markdown + HTML 표)에서 고칠 수 있는 글 칸의 위치를 찾아 번호를 매기고(findCells), 수정 모드에서는 각 칸을
// <span data-cell="번호"> 로 감싸 화면이 그 칸을 입력칸으로 그리게 한다(markCells). 저장할 때는 고친 칸만 원문의 같은 자리에 바꿔 넣는다(applyCellEdits).
// 월별 일정표의 막대 칸(빈 칸·&nbsp;)과 표 머리글은 고칠 대상이 아니다(막대는 끌어서 고친다).
// 표의 행은 행마다 <span data-row="번호"> 표시를 마지막 칸 끝에 넣어 화면이 행 추가·삭제 단추를 그리게 하고(findRows),
// 단추를 누르면 원문에서 그 행을 지우거나 바로 아래에 빈 행('-')을 넣는다(deleteRow · addRowAfter). 카드 안 표의 행이면 왼쪽 묶음 칸의 rowspan 도 고친다.

export type Cell = { start: number; end: number; raw: string; kind: "md" | "html" };

const HTML_CELL = /<td(\s[^>]*)?>([\s\S]*?)<\/td>/g;
const HEADING = /^(#{3,6}\s+\d+\)\s*)(.+)$/; // '### 1) 항목 이름'

function isBlank(raw: string): boolean {
  const text = raw.trim();
  return text === "" || text === "&nbsp;";
}

// Markdown 표 한 줄의 칸 위치('|' 사이). '\|' 는 칸 구분이 아니다.
function markdownRowCells(line: string, offset: number): Cell[] {
  const cells: Cell[] = [];
  const bars: number[] = [];
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === "|" && line[i - 1] !== "\\") bars.push(i);
  }
  for (let k = 0; k + 1 < bars.length; k += 1) {
    const inner = line.slice(bars[k] + 1, bars[k + 1]);
    const lead = inner.length - inner.trimStart().length;
    const raw = inner.trim();
    if (!raw) continue;
    const start = offset + bars[k] + 1 + lead;
    cells.push({ start, end: start + raw.length, raw, kind: "md" });
  }
  return cells;
}

/** 장 본문에서 고칠 수 있는 글 칸(표의 내용 칸, 항목 이름)을 문서 순서대로 찾는다. */
export function findCells(body: string): Cell[] {
  const cells: Cell[] = [];
  for (const match of body.matchAll(HTML_CELL)) {
    const content = match[2];
    if (isBlank(content)) continue;
    const start = (match.index ?? 0) + match[0].indexOf(">") + 1;
    cells.push({ start, end: start + content.length, raw: content, kind: "html" });
  }
  const lines = body.split("\n");
  let offset = 0;
  lines.forEach((line, index) => {
    const heading = HEADING.exec(line);
    if (heading) {
      const start = offset + heading[1].length;
      cells.push({ start, end: start + heading[2].length, raw: heading[2], kind: "md" });
    } else if (line.trimStart().startsWith("|")) {
      const isSeparator = /^\s*\|[\s:|-]+\|\s*$/.test(line);
      const isHeader = /^\s*\|[\s:|-]+\|\s*$/.test(lines[index + 1] ?? ""); // 다음 줄이 구분선이면 머리글
      if (!isSeparator && !isHeader) cells.push(...markdownRowCells(line, offset));
    }
    offset += line.length + 1;
  });
  return cells.sort((a, b) => a.start - b.start);
}

export type Row = { start: number; end: number; marker: number; kind: "md" | "html" };

const HTML_ROW = /<tr(\s[^>]*)?>([\s\S]*?)<\/tr>/g;

/** 행을 더하고 뺄 수 있는 표의 행(문서 순서): 칸(td)이 있는 모든 행. 머리글만 있는 행(th 만), Markdown 표의 머리글·구분선, 월별 일정표의 행은 뺀다.
 * marker 는 행의 마지막 칸 끝(단추를 행 맨 오른쪽에 그린다). */
export function findRows(body: string): Row[] {
  const rows: Row[] = [];
  for (const match of body.matchAll(HTML_ROW)) {
    const inner = match[2];
    if (!/<td[\s>]/.test(inner) || /class="bar"|<td><\/td>/.test(inner)) continue; // 머리글 행, 월별 일정표
    const start = match.index ?? 0;
    const close = inner.lastIndexOf("</td>");
    rows.push({ start, end: start + match[0].length, marker: start + match[0].indexOf(inner) + close, kind: "html" });
  }
  const lines = body.split("\n");
  let offset = 0;
  lines.forEach((line, index) => {
    if (line.trimStart().startsWith("|")) {
      const isSeparator = /^\s*\|[\s:|-]+\|\s*$/.test(line);
      const isHeader = /^\s*\|[\s:|-]+\|\s*$/.test(lines[index + 1] ?? "");
      const last = line.lastIndexOf("|");
      if (!isSeparator && !isHeader && last > line.indexOf("|")) rows.push({ start: offset, end: offset + line.length, marker: offset + last, kind: "md" });
    }
    offset += line.length + 1;
  });
  return rows.sort((a, b) => a.start - b.start);
}

/** 수정 모드에서 그릴 본문: 칸마다 <span data-cell="번호"> 로 감싸고, 행마다 첫 칸 앞에 <span data-row="번호"></span> 표시를 넣는다. */
export function markCells(body: string, cells: Cell[] = findCells(body), rows: Row[] = []): string {
  type Mark = { at: number; end: number; text: string; order: number };
  const marks: Mark[] = [
    ...cells.map((cell, i) => ({ at: cell.start, end: cell.end, text: `<span data-cell="${i}">${cell.raw}</span>`, order: 1 })),
    ...rows.map((row, i) => ({ at: row.marker, end: row.marker, text: `<span data-row="${i}"></span>`, order: 0 })),
  ].sort((a, b) => b.at - a.at || b.order - a.order); // 뒤에서부터 바꾼다. 같은 자리면 칸을 먼저 감싸고 행 표시를 그 앞에 넣는다
  let out = body;
  for (const mark of marks) out = `${out.slice(0, mark.at)}${mark.text}${out.slice(mark.end)}`;
  return out;
}

/** HTML 행이 속한 묶음 칸(같은 표에서 이 행을 rowspan 으로 덮는 왼쪽 머리 칸)의 rowspan 을 delta 만큼 바꾼다. */
function shiftRowspan(body: string, row: Row, delta: number): string {
  const tableStart = body.lastIndexOf("<table", row.start);
  const before = [...body.slice(tableStart, row.start).matchAll(HTML_ROW)];
  for (let k = before.length - 1; k >= 0; k -= 1) {
    const span = /<th rowspan="(\d+)"/.exec(before[k][0]);
    if (!span) continue;
    if (k + Number(span[1]) - 1 < before.length) return body; // 이 행까지 덮지 않는다(rowspan 이 덮는 행: k ~ k+N-1, 이 행은 before.length 번째)
    const at = tableStart + (before[k].index ?? 0) + span.index;
    return `${body.slice(0, at)}<th rowspan="${Math.max(1, Number(span[1]) + delta)}"${body.slice(at + span[0].length)}`;
  }
  return body;
}

/** 표의 내용 행 하나를 지운 본문. */
export function deleteRow(body: string, index: number): string {
  const row = findRows(body)[index];
  if (!row) return body;
  if (row.kind === "md") return `${body.slice(0, row.start)}${body.slice(row.end + 1)}`;
  const out = `${body.slice(0, row.start)}${body.slice(row.end)}`;
  return shiftRowspan(out, row, -1);
}

/** 표의 내용 행 바로 아래에 같은 모양의 빈 행('-')을 넣은 본문. */
export function addRowAfter(body: string, index: number): string {
  const row = findRows(body)[index];
  if (!row) return body;
  const text = body.slice(row.start, row.end);
  if (row.kind === "md") {
    const count = Math.max(1, text.trim().replace(/\\\|/g, "").split("|").length - 2);
    return `${body.slice(0, row.end)}\n| ${Array(count).fill("-").join(" | ")} |${body.slice(row.end)}`;
  }
  const blank = text.replace(/(<(td|th)(\s[^>]*)?>)[\s\S]*?(<\/\2>)/g, "$1-$4");
  const out = `${body.slice(0, row.end)}${blank}${body.slice(row.end)}`;
  return shiftRowspan(out, row, 1);
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&#39;": "'" };

const DOC_HINT = /<span class="doc-hint">[^<]*<\/span>/g; // 비어 있는 칸의 흐린 안내: 고칠 글이 아니라 빈 칸으로 본다

/** 칸 원문을 사람이 고칠 글로(이스케이프를 푼다). 흐린 안내만 있는 칸은 빈 글. */
export function cellText(cell: Cell): string {
  const raw = cell.raw.replace(DOC_HINT, "");
  if (cell.kind === "md") return raw.replace(/\\\|/g, "|");
  return raw.replace(/&(amp|lt|gt|quot|#x27|#39);/g, (entity) => ENTITIES[entity] ?? entity);
}

/** 꼭 직접 적어야 하는 칸인지: 비어 있거나(흐린 안내만 남은 칸), 수기로 적는 빈칸('________', ID/PW)이 남아 있다. */
export function needsFill(text: string): boolean {
  return text.trim() === "" || /_{3,}/.test(text);
}

function encode(text: string, kind: Cell["kind"]): string {
  const flat = text.replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean).join(" / ").trim() || "-";
  if (kind === "md") return flat.replace(/\|/g, "\\|");
  return flat.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 고친 칸만 원문의 같은 자리에 바꿔 넣은 본문. edits 의 키는 findCells 의 순서 번호. */
export function applyCellEdits(body: string, edits: Record<number, string>): string {
  const cells = findCells(body);
  let out = body;
  for (let i = cells.length - 1; i >= 0; i -= 1) {
    if (edits[i] === undefined || edits[i] === cellText(cells[i])) continue;
    out = `${out.slice(0, cells[i].start)}${encode(edits[i], cells[i].kind)}${out.slice(cells[i].end)}`;
  }
  return out;
}
