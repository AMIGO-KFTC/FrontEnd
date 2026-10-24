// 인수인계서 '직접 수정하기': 표 칸과 항목 이름을 화면에서 바로 고친다.
// 문서 원문(Markdown + HTML 표)에서 고칠 수 있는 글 칸의 위치를 찾아 번호를 매기고(findCells), 수정 모드에서는 각 칸을
// <span data-cell="번호"> 로 감싸 화면이 그 칸을 입력칸으로 그리게 한다(markCells). 저장할 때는 고친 칸만 원문의 같은 자리에 바꿔 넣는다(applyCellEdits).
// 월별 일정표의 막대 칸(빈 칸·&nbsp;)과 표 머리글은 고칠 대상이 아니다(막대는 끌어서 고친다).

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

/** 수정 모드에서 그릴 본문: 칸마다 <span data-cell="번호"> 로 감싼다. */
export function markCells(body: string, cells: Cell[] = findCells(body)): string {
  let out = body;
  for (let i = cells.length - 1; i >= 0; i -= 1) {
    const cell = cells[i];
    out = `${out.slice(0, cell.start)}<span data-cell="${i}">${cell.raw}</span>${out.slice(cell.end)}`;
  }
  return out;
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&#39;": "'" };

/** 칸 원문을 사람이 고칠 글로(이스케이프를 푼다). */
export function cellText(cell: Cell): string {
  if (cell.kind === "md") return cell.raw.replace(/\\\|/g, "|");
  return cell.raw.replace(/&(amp|lt|gt|quot|#x27|#39);/g, (entity) => ENTITIES[entity] ?? entity);
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
