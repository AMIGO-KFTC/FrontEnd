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
  },
};

export const documentRehypePlugins: PluggableList = [rehypeRaw, [rehypeSanitize, schema]];
