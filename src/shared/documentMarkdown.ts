import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { PluggableList } from "unified";

// 인수인계서 Markdown 은 병합 셀(rowspan/colspan)과 막대 색이 필요한 표(월별 일정표, 협업관계 칸 분할)를 HTML <table> 로 담는다.
// 문서에는 사용자가 쓴 글이 들어가므로, HTML 을 읽은 뒤 표 관련 태그와 병합·막대 속성만 남기고 나머지(스크립트·이벤트 속성 등)는 모두 지운다.
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    td: [...(defaultSchema.attributes?.td ?? []), "colSpan", "rowSpan", ["className", "bar"]],
    th: [...(defaultSchema.attributes?.th ?? []), "colSpan", "rowSpan"],
    span: [...(defaultSchema.attributes?.span ?? []), "dataCell", "dataRow", ["className", "doc-hint"]], // '직접 수정하기'의 입력칸·행 추가/삭제 표시(editableCells.markCells), 비어 있는 칸의 흐린 안내(doc-hint)
  },
};

// 본문 글 뒤의 근거 번호(' [1]')를 <sup class="cite-ref" data-cite="1"> 로 바꾼다(화면이 마우스를 올리면 출처를 띄우는 번호로 그린다).
// 소독(sanitize) 뒤에 돌려서 코드가 만든 이 태그만 남긴다. 코드 블록 안의 글은 건드리지 않는다.
type HastNode = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: HastNode[] };
const CITATION_MARK = / ?\[(\d+)\]/g;

function splitMarks(node: HastNode): void {
  if (!node.children || node.tagName === "code" || node.tagName === "pre") return;
  const next: HastNode[] = [];
  for (const child of node.children) {
    if (child.type !== "text" || !child.value || !/\[\d+\]/.test(child.value)) {
      splitMarks(child);
      next.push(child);
      continue;
    }
    let last = 0;
    for (const match of child.value.matchAll(CITATION_MARK)) {
      const at = match.index ?? 0;
      if (at > last) next.push({ type: "text", value: child.value.slice(last, at) });
      next.push({ type: "element", tagName: "sup", properties: { className: ["cite-ref"], dataCite: match[1] }, children: [{ type: "text", value: match[1] }] });
      last = at + match[0].length;
    }
    if (last < child.value.length) next.push({ type: "text", value: child.value.slice(last) });
  }
  node.children = next;
}

const rehypeCitationMarks = () => (tree: HastNode) => splitMarks(tree);

export const documentRehypePlugins: PluggableList = [rehypeRaw, [rehypeSanitize, schema], rehypeCitationMarks];
