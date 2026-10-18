// 인수인계서 본문의 "[1]" 같은 근거 번호를 눌러서 원문을 볼 수 있게 표시하는 rehype 플러그인.
// 서버가 근거로 돌려준 번호(numbers)에 해당하는 것만 바꾸고, 코드·링크 안의 글자는 건드리지 않는다.
type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const SKIP = new Set(["code", "pre", "a", "button", "script", "style"]);
const REF = /\[(\d{1,3})\]/g;

function split(value: string, numbers: Set<number>): HastNode[] {
  const out: HastNode[] = [];
  let last = 0;
  for (const match of value.matchAll(REF)) {
    const n = Number(match[1]);
    if (!numbers.has(n)) continue;
    const at = match.index ?? 0;
    if (at > last) out.push({ type: "text", value: value.slice(last, at) });
    out.push({
      type: "element",
      tagName: "sup",
      properties: { className: ["cite-ref"], dataCite: String(n), role: "button", tabIndex: 0, title: "근거 원문 보기" },
      children: [{ type: "text", value: match[0] }],
    });
    last = at + match[0].length;
  }
  if (last === 0) return [{ type: "text", value }];
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

function walk(node: HastNode, numbers: Set<number>): void {
  if (!node.children) return;
  if (node.type === "element" && node.tagName && SKIP.has(node.tagName)) return;
  const next: HastNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string") next.push(...split(child.value, numbers));
    else {
      walk(child, numbers);
      next.push(child);
    }
  }
  node.children = next;
}

export function rehypeCitationRefs(options: { numbers: Set<number> }) {
  return (tree: HastNode) => walk(tree, options.numbers);
}
