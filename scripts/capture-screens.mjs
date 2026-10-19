// 화면 검증 스크립트: 개발 서버(npm run dev, 5173)에 접속하고 /api 요청을 가짜 응답으로 가로채
// 화면마다 PNG 를 저장하고, 마지막 화면 종류·주소 해시·보낸 변경 요청(POST/PUT/DELETE) 수를 한 줄씩 출력한다.
// BackEnd 없이 화면 흐름·복원·뒤로 가기를 확인하는 용도이며 실제 서버 검증을 대신하지 않는다.
//
// 준비: Playwright 와 Chromium 이 필요하다. `npx playwright install chromium` 또는 전역 설치 후
//   node scripts/capture-screens.mjs <출력폴더>              # 모든 시나리오, 3개 해상도
//   ONLY=dashboard,question VP=laptop node scripts/capture-screens.mjs out   # 일부만
//   BASE_URL=http://localhost:4173 ...                         # vite preview 등 다른 주소
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2] ?? "shots";
fs.mkdirSync(outDir, { recursive: true });
const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const SID = "abc123def4567890";

const config = {
  max_upload_mb: 50,
  max_files_per_upload: 20,
  allowed_extensions: [".pdf", ".hwpx", ".docx", ".pptx", ".xlsx", ".eml", ".zip", ".png", ".jpg"],
  format_labels: {},
  link_types: [{ key: "auto", label: "자동" }],
  modes: [{ key: "reassignment", label: "인사발령" }, { key: "leave", label: "장기휴가" }],
  slots: [
    { key: "duties", title: "업무 단위 요약", description: "", fields: [], required: [], leave: true },
    { key: "recurring", title: "정기 업무", description: "", fields: [], required: [], leave: false },
    { key: "projects", title: "비정기 업무", description: "", fields: [], required: [], leave: false },
    { key: "contacts", title: "협업관계 표", description: "", fields: [], required: [], leave: false },
    { key: "systems", title: "시스템 접근 권한", description: "", fields: [], required: [], leave: true },
    { key: "issues", title: "부서별 추가 자료", description: "", fields: [], required: [], leave: false },
  ],
  engine: "offline",
  model: null,
};

const src = (id, kind, name, status, extra = {}) => ({
  id, kind, name, url: kind === "link" ? name : "", link_type: "", extension: name.includes(".") ? name.slice(name.lastIndexOf(".")) : "",
  size: 1.6 * 1024 * 1024, status, error: "", chunk_count: 12, warnings: [], added_stage: "setup", created_at: "2026-10-19T03:00:00Z", ...extra,
});
const sources = [
  src("s1", "file", "업무정의서_웹서비스팀.pdf", "ready"),
  src("s2", "file", "홈페이지_운영매뉴얼.hwpx", "ready"),
  src("s3", "file", "주간회의록_2026-09-22.docx", "processing"),
  src("s4", "link", "https://confluence.company.com/platform/operations", "ready", { link_type: "confluence_link" }),
  src("s5", "file", "#platform-weekly (채널)", "ready", { link_type: "mattermost", url: "https://mm.company.com/platform-weekly" }),
  src("s6", "file", "깨진파일.hwp", "failed", { error: "지원하지 않는 형식" }),
];

const slot = (key, coverage, n, cites) => ({ key, coverage, items: Array.from({ length: n }, (_, i) => ({ id: `${key}-${i}`, title: `${key} ${i}`, fields: {}, citations: Array.from({ length: cites }, (_, c) => ({ source_id: "s1", label: `[${c + 1}]` })), origin: "document" })) });
const slots = {
  duties: slot("duties", "sufficient", 3, 2), recurring: slot("recurring", "sufficient", 4, 1), projects: slot("projects", "partial", 2, 1),
  contacts: slot("contacts", "missing", 0, 0), systems: slot("systems", "partial", 2, 2), issues: slot("issues", "missing", 0, 0),
};
const gaps = [
  { id: "g1", slot: "contacts", description: "협업 부서 담당자와 연락처가 자료에 없어요.", question: "재무팀 담당자와 연락처를 알려주세요.", priority: 1, status: "asked" },
  { id: "g2", slot: "projects", description: "진행 중인 과제의 마감일이 필요해요.", question: "리뉴얼 과제 마감일은 언제인가요?", priority: 2, status: "open" },
  { id: "g3", slot: "systems", description: "", question: "관리자 권한 신청 절차는?", priority: 3, status: "open" },
  { id: "g4", slot: "issues", description: "", question: "추가 자료가 있나요?", priority: 4, status: "resolved" },
];

function session(stage, status, extra = {}) {
  return {
    id: SID, title: "B2B 플랫폼 운영 인수인계", owner_name: "김민준", organization: "프로덕트본부 · 플랫폼팀", position: "프로덕트 매니저",
    mode: "reassignment", task_name: "B2B 플랫폼 기획 및 운영", stage, status, document_version: 0, created_at: "2026-10-19T03:00:00Z", updated_at: "2026-10-19T03:10:00Z",
    duties: "B2B 플랫폼 기획 및 운영\n고객 요청 및 장애 대응", successor: "", handover_date: "2025-03-14",
    progress: { message: "문서의 텍스트와 표를 읽고 있어요", current: 3, total: 6 }, error: "", engine: "offline",
    slots, gaps, open_gap_count: 3, question_count: 1, sources, last_message_id: 3,
    usage: { requests: 0, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 0 }, ...extra,
  };
}
const messages = [
  { id: 1, role: "assistant", kind: "summary", content: "자료 분석을 마쳤어요.", meta: {}, created_at: "" },
  { id: 2, role: "assistant", kind: "question", content: "**[협업관계 표]** 재무팀 담당자와 연락처를 알려주세요. 메일에 '유지보수대금 요청' 건이 있는데 담당자 이름이 없어요.", meta: { gap_id: "g1", slot: "contacts", number: 1, remaining: 3, quick_replies: ["모르겠어요 (건너뛰기)", "지금 문서 생성"], allow_files: true }, created_at: "" },
  { id: 3, role: "user", kind: "answer", content: "재무팀 박지훈 차장, 내선 2345", meta: {}, created_at: "" },
  { id: 4, role: "assistant", kind: "confirm", content: "다음과 같이 정리했어요.\n\n**[협업관계 표] 재무팀**\n- **담당자**: 박지훈 차장 (내선 2345)\n\n맞으면 '네', 고칠 부분이 있으면 말씀해 주세요.", meta: { quick_replies: ["네, 맞아요", "수정할게요"] }, created_at: "" },
  { id: 5, role: "user", kind: "answer", content: "네, 맞아요", meta: {}, created_at: "" },
  { id: 6, role: "assistant", kind: "question", content: "**[비정기 업무]** 홈페이지 리뉴얼 과제의 마감일과 현재 진행 상황을 알려주세요.", meta: { gap_id: "g2", slot: "projects", number: 2, remaining: 2, quick_replies: ["모르겠어요 (건너뛰기)", "지금 문서 생성"], allow_files: true }, created_at: "" },
];
const gapsAfterFirst = () => gaps.map((g) => (g.id === "g1" ? { ...g, status: "resolved" } : g.id === "g2" ? { ...g, status: "asked" } : g));
const markdown = `# 업무 인수인계서

## 1. 업무 단위 요약

| 업무 단위 | 주요 내용 | 비고 |
|---|---|---|
| 홈페이지 운영 | 콘텐츠 게시·장애 대응 [1] | 주 1회 점검 |
| 접근성 개선 | 지적사항 반영 일정 관리 [2] | 11월 완료 |

> 담당 업무의 핵심은 **업무 연속성 확보**입니다.

## 2. 정기 업무

- 매주 월요일 운영 지표 리뷰 [1]
- 매월 1주차 재무팀 유지보수 대금 검수 [3]

### 세부 절차

1. 체크리스트 확인
2. 결재 상신

## 3. 협업관계 표

| 부서 | 담당자 | 연락처 |
|---|---|---|
| 재무팀 | 박지훈 차장 | 내선 2345 |

## 근거 자료

1. 업무정의서_웹서비스팀.pdf, 2쪽
2. 웹접근성_개선계획.pptx, 5쪽
3. 재무팀_유지보수대금_요청.eml
`;

const mmConversations = {
  me: "김민준", total: 3,
  conversations: [
    { id: "c1", type: "channel", name: "platform-weekly", display_name: "platform-weekly", team: "플랫폼", purpose: "주간 회의 공유", members: ["김민준", "이지윤", "박지훈"], member_count: 3, message_count: 42, first_post_at: "2026-09-01T00:00:00Z", last_post_at: "2026-10-18T09:00:00Z", last_message: { user_name: "이지윤", text: "이번 주 배포 일정 공유드립니다." }, url: "https://mm.company.com/platform-weekly" },
    { id: "c2", type: "dm", name: "jihoon", display_name: "박지훈", team: "", purpose: "", members: ["김민준", "박지훈"], member_count: 2, message_count: 8, first_post_at: "2026-09-10T00:00:00Z", last_post_at: "2026-10-17T02:00:00Z", last_message: { user_name: "박지훈", text: "장애 대응 연락망 업데이트했어요." }, url: "https://mm.company.com/dm-jihoon" },
    { id: "c3", type: "group", name: "ops-group", display_name: "운영 협의체", team: "플랫폼", purpose: "운영 협의", members: ["김민준", "최유진", "이서연"], member_count: 3, message_count: 15, first_post_at: "2026-08-01T00:00:00Z", last_post_at: "2026-10-12T05:00:00Z", last_message: { user_name: "최유진", text: "정산 일정 확인 부탁드려요." }, url: "https://mm.company.com/ops-group" },
  ],
};
const cfSearch = {
  query: "운영", terms: ["운영"], total: 2,
  results: [
    { id: "p1", title: "홈페이지 운영 매뉴얼", space_key: "WEB", space_name: "웹서비스", labels: ["운영", "매뉴얼"], author: "김민준", updated_at: "2026-10-10T00:00:00Z", version: 4, ancestors: ["웹서비스팀"], url: "https://confluence.company.com/WEB/1", excerpt: "홈페이지 운영 절차와 권한 신청 방법을 정리한 페이지입니다.", matched_in: ["title", "body"] },
    { id: "p2", title: "장애 대응 프로세스", space_key: "OPS", space_name: "운영", labels: ["장애"], author: "박지훈", updated_at: "2026-09-20T00:00:00Z", version: 2, ancestors: [], url: "https://confluence.company.com/OPS/2", excerpt: "장애 발생 시 운영 담당자 연락 순서입니다.", matched_in: ["body"] },
  ],
  spaces: [{ key: "WEB", name: "웹서비스" }, { key: "OPS", name: "운영" }],
};

let scenario = { me: true, stage: "setup", status: "idle", extra: {} };
let deleted = new Set();
const summary = (id, title, task, stage, status, version, updatedMinAgo, createdDaysAgo, mode = "reassignment") => ({
  id, title, owner_name: "김민준", organization: "프로덕트본부 · 플랫폼팀", position: "프로덕트 매니저", mode, task_name: task, stage, status, document_version: version,
  created_at: new Date(Date.now() - createdDaysAgo * 86400000).toISOString(), updated_at: new Date(Date.now() - updatedMinAgo * 60000).toISOString(),
});
const sessionList = () => [
  summary(SID, "B2B 플랫폼 운영 인수인계", "B2B 플랫폼 기획 및 운영", "qna", "waiting", 0, 10, 2),
  summary("bbbb2222bbbb2222", "", "Q1 프로젝트 진행 현황 관리", "setup", "idle", 0, 60 * 26, 5),
  summary("cccc3333cccc3333", "장애 대응 체계 인수인계", "장애 대응", "analyzing", "error", 0, 60 * 24 * 3, 9, "leave"),
  summary("dddd4444dddd4444", "플랫폼 운영 업무 인수인계서", "플랫폼 운영", "review", "idle", 2, 60 * 24 * 1, 20),
  summary("eeee5555eeee5555", "", "고객 대응 프로세스", "qna", "waiting", 1, 60 * 24 * 12, 40),
].filter((s) => !deleted.has(s.id));

let mutations = [];
async function route(routeObj) {
  const url = new URL(routeObj.request().url());
  const p = url.pathname;
  const method = routeObj.request().method();
  if (method !== "GET") mutations.push(`${method} ${p}`);
  if (p.endsWith("/state") && scenario.stateStatus) return routeObj.fulfill({ status: scenario.stateStatus, contentType: "application/json", body: JSON.stringify({ detail: scenario.stateStatus === 401 ? "로그인이 필요합니다." : scenario.stateStatus === 404 ? "세션을 찾을 수 없습니다." : "데이터베이스 오류" }) });
  const json = (body, status = 200) => routeObj.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (p === "/api/auth/me") return scenario.me ? json({ user: { id: 1, login_id: "2503141", name: "김민준", profile: { department: "프로덕트본부", position: "프로덕트 매니저", team: "플랫폼팀", name: "김민준" } } }) : json({ detail: "로그인이 필요합니다." }, 401);
  if (p === "/api/auth/login") return json({ message: "ok", name: "김민준", user: { id: 1, login_id: "2503141", name: "김민준", profile: { department: "프로덕트본부", position: "프로덕트 매니저", team: "플랫폼팀", name: "김민준" } }, expires_at: "" });
  if (p === "/api/auth/logout") return json({ message: "ok" });
  if (p === "/api/config") return json(config);
  if (p === "/api/health") return json({ status: "ok", engine: "offline", model: null });
  if (p.endsWith("/state")) {
    const count = scenario.messageCount ?? messages.length;
    const after = Number(url.searchParams.get("after"));
    const extra = scenario.createdMode ? { ...scenario.extra, mode: scenario.createdMode, sources: [] } : scenario.extra;
    const base = session(scenario.stage, scenario.status, extra);
    if (count >= 6) Object.assign(base, { gaps: gapsAfterFirst(), question_count: 2, open_gap_count: 2 });
    return json({ session: { ...base, id: p.split("/")[3] }, messages: messages.slice(0, count).filter((m) => m.id > after), usage_total: null });
  }
  if (p.endsWith("/document")) return json({ markdown, version: scenario.extra?.document_version ?? 1 });
  if (p.endsWith("/generate") || p.endsWith("/chat")) {
    const body = p.endsWith("/chat") ? routeObj.request().postDataJSON() : null;
    if (scenario.rejectAction) return json({ detail: "AI가 이전 요청을 처리하고 있어요." }, 409);
    scenario = { ...scenario, stage: "composing", status: "running", extra: { ...scenario.extra, progress: { message: "인수인계서를 작성하고 있어요.", current: 0, total: 0 } } };
    return json({ ok: true, message: { id: 99, role: "user", kind: body ? "answer" : "command", content: body ? body.text : "지금까지 내용으로 인수인계서를 만들어 주세요.", meta: {}, created_at: "" } }, 202);
  }
  if (p === "/api/integrations/mattermost/conversations") return json(mmConversations);
  if (p === "/api/integrations/confluence/search") return json(cfSearch);
  if (p === "/api/sessions" && routeObj.request().method() === "POST") {
    const body = routeObj.request().postDataJSON();
    scenario.createdMode = body.mode;
    return json({ ...session("setup", "idle", { mode: body.mode, owner_name: body.owner_name, organization: body.organization, position: body.position, duties: body.duties, task_name: body.task_name, handover_date: body.handover_date, sources: [] }) }, 201);
  }
  if (p === "/api/sessions" && routeObj.request().method() === "GET") {
    if (scenario.list === "error") return json({ detail: "데이터베이스에 연결할 수 없습니다." }, 500);
    if (scenario.list === "expired") return json({ detail: "로그인이 필요합니다." }, 401);
    if (scenario.list === "empty") return json([]);
    return json(sessionList());
  }
  if (/^\/api\/sessions\/[^/]+$/.test(p) && routeObj.request().method() === "DELETE") {
    if (scenario.deleteFail) return json({ detail: "삭제 권한이 없습니다." }, 403);
    deleted.add(p.split("/").pop());
    return routeObj.fulfill({ status: 204, body: "" });
  }
  return json({ detail: `mock 없음: ${p}` }, 404);
}

const viewports = { desktop: { width: 1440, height: 900 }, laptop: { width: 1280, height: 720 }, mobile: { width: 390, height: 844 } };

const browser = await chromium.launch();
async function shot(name, vp, setup) {
  const ctx = await browser.newContext({ viewport: viewports[vp], deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.route("**/api/**", route);
  mutations = [];
  await setup(page);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outDir, `${name}-${vp}.png`), fullPage: true });
  const metrics = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight, innerW: innerWidth, innerH: innerHeight, rootClass: document.querySelector("#root > *")?.className ?? "(empty)", hash: location.hash }));
  console.log(`${name}-${vp}: [${metrics.rootClass}] ${metrics.hash || "(no hash)"} 변경요청=${mutations.length}${mutations.length ? " (" + mutations.join(", ") + ")" : ""} ${metrics.scrollW}x${metrics.scrollH}${metrics.scrollW > metrics.innerW ? " ⚠ 가로 넘침" : ""}${errors.length ? " ⚠ 오류: " + errors.join(" | ") : ""}`);
  await ctx.close();
}

const open = (hash = "") => async (page) => { await page.goto(`${BASE}/${hash}`); await page.waitForLoadState("networkidle"); };
const steps = [
  ["login", () => { scenario = { me: false, stage: "setup", status: "idle", extra: {} }; }, open()],
  ["login-sso", () => { scenario = { me: false, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open()(page); await page.getByRole("button", { name: /SSO/ }).click(); await page.waitForTimeout(200); }],
  ["login-submit", () => { scenario = { me: false, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open()(page); await page.getByPlaceholder("업무용 아이디를 입력하세요").fill("2503141"); await page.getByPlaceholder("비밀번호를 입력하세요").fill("pw"); await page.getByRole("button", { name: /^로그인/ }).click(); await page.waitForTimeout(600); }],
  ["signup", () => { scenario = { me: false, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open()(page); await page.getByRole("button", { name: "회원가입" }).click(); await page.waitForTimeout(300); }],
  ["forgot", () => { scenario = { me: false, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open()(page); await page.getByRole("button", { name: "비밀번호 재설정" }).click(); await page.waitForTimeout(300); }],
  ["forgot-step3", () => { scenario = { me: false, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open()(page); await page.getByRole("button", { name: "비밀번호 재설정" }).click(); await page.getByPlaceholder("사번을 입력하세요").fill("2503141"); await page.getByRole("button", { name: /^다음/ }).click(); await page.getByRole("button", { name: "요청" }).click(); await page.getByPlaceholder("6자리 인증번호").fill("123456"); await page.getByRole("button", { name: /인증 완료/ }).click(); await page.waitForTimeout(300); }],
  ["start-usermenu", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open("#/new/reassignment")(page); await page.locator(".step-user-avatar").click(); await page.waitForTimeout(200); }],
  ["start-logout-confirm", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open("#/new/reassignment")(page); await page.locator(".step-user-avatar").click(); await page.locator(".type-profile-logout").click(); await page.waitForTimeout(200); }],
  ["start-logged-out", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open("#/new/reassignment")(page); await page.locator(".step-user-avatar").click(); await page.locator(".type-profile-logout").click(); await page.locator(".logout-modal button:last-child").click(); await page.waitForTimeout(400); }],
  ["dashboard", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, open()],
  ["dashboard-notifications", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open()(page); await page.locator(".header-icon-button").click(); await page.waitForTimeout(200); }],
  ["dashboard-list-error", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {}, list: "error" }; }, open()],
  ["dashboard-sidebar-recent", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open()(page); await page.locator(".sidebar-section button").first().click(); await page.waitForTimeout(600); }],
  ["ongoing", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open()(page); await page.locator(".sidebar-nav button", { hasText: "진행 중인 인수인계" }).click(); await page.waitForTimeout(400); }],
  ["ongoing-empty", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {}, list: "empty" }; }, async (page) => { await open()(page); await page.locator(".sidebar-nav button", { hasText: "진행 중인 인수인계" }).click(); await page.waitForTimeout(400); }],
  ["ongoing-error", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {}, list: "error" }; }, async (page) => { await open()(page); await page.locator(".sidebar-nav button", { hasText: "진행 중인 인수인계" }).click(); await page.waitForTimeout(400); }],
  ["ongoing-delete-confirm", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open()(page); await page.locator(".sidebar-nav button", { hasText: "진행 중인 인수인계" }).click(); await page.locator(".ongoing-card-actions button[title='더보기']").nth(1).click(); await page.locator(".ongoing-more-menu button").click(); await page.waitForTimeout(200); }],
  ["ongoing-delete-failed", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {}, deleteFail: true }; }, async (page) => { await open()(page); await page.locator(".sidebar-nav button", { hasText: "진행 중인 인수인계" }).click(); await page.locator(".ongoing-card-actions button[title='더보기']").nth(1).click(); await page.locator(".ongoing-more-menu button").click(); await page.locator(".logout-modal button:last-child").click(); await page.waitForTimeout(400); }],
  ["ongoing-deleted", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; deleted = new Set(); }, async (page) => { await open()(page); await page.locator(".sidebar-nav button", { hasText: "진행 중인 인수인계" }).click(); await page.locator(".ongoing-card-actions button[title='더보기']").nth(1).click(); await page.locator(".ongoing-more-menu button").click(); await page.locator(".logout-modal button:last-child").click(); await page.waitForTimeout(500); deleted = new Set(); }],
  ["ongoing-continue", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open()(page); await page.locator(".sidebar-nav button", { hasText: "진행 중인 인수인계" }).click(); await page.getByRole("button", { name: /이어서 작성/ }).first().click(); await page.waitForTimeout(700); }],
  ["documents", () => { scenario = { me: true, stage: "review", status: "idle", extra: { document_version: 2 } }; }, async (page) => { await open()(page); await page.locator(".sidebar-nav button", { hasText: "완성 문서" }).click(); await page.waitForTimeout(400); }],
  ["documents-open", () => { scenario = { me: true, stage: "review", status: "idle", extra: { document_version: 2 } }; }, async (page) => { await open()(page); await page.locator(".sidebar-nav button", { hasText: "완성 문서" }).click(); await page.getByRole("button", { name: /문서 열기/ }).click(); await page.waitForTimeout(800); }],
  ["received", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open()(page); await page.locator(".sidebar-nav button", { hasText: "받은 인수인계" }).click(); await page.waitForTimeout(400); }],
  ["complete-home", () => { scenario = { me: true, stage: "review", status: "idle", extra: { document_version: 1 } }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.locator(".finish-handover:visible").first().click(); await page.waitForTimeout(300); }],
  ["admin", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open()(page); await page.locator(".admin-mode-entry").click(); await page.waitForTimeout(400); }],
  ["admin-members", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open()(page); await page.locator(".admin-mode-entry").click(); await page.locator(".admin-nav button", { hasText: "구성원 관리" }).click(); await page.waitForTimeout(300); }],
  ["admin-members-delete", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open()(page); await page.locator(".admin-mode-entry").click(); await page.locator(".admin-nav button", { hasText: "구성원 관리" }).click(); await page.locator(".member-profile-menu > button").click(); await page.locator(".member-profile-menu div button").click(); await page.waitForTimeout(300); }],
  ["admin-handovers", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open()(page); await page.locator(".admin-mode-entry").click(); await page.locator(".admin-nav button", { hasText: "인수인계 관리" }).click(); await page.waitForTimeout(300); }],
  ["admin-ai", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open()(page); await page.locator(".admin-mode-entry").click(); await page.locator(".admin-nav button", { hasText: "AI 맞춤 설정" }).click(); await page.waitForTimeout(300); }],
  ["admin-ai-saved", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open()(page); await page.locator(".admin-mode-entry").click(); await page.locator(".admin-nav button", { hasText: "AI 맞춤 설정" }).click(); await page.locator(".ai-settings-save button").click(); await page.waitForTimeout(300); }],
  ["type", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open()(page); await page.locator(".dashboard-start").click(); await page.waitForTimeout(300); }],
  ["start-personnel", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open()(page); await page.locator(".dashboard-start").click(); await page.locator(".handover-type-card.personnel").click(); await page.waitForTimeout(300); }],
  ["start-leave", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open()(page); await page.locator(".dashboard-start").click(); await page.locator(".handover-type-card.leave").click(); await page.waitForTimeout(500); }],
  ["start-validation", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open()(page); await page.locator(".dashboard-start").click(); await page.locator(".handover-type-card.leave").click(); await page.locator(".onboarding-next").click(); await page.waitForTimeout(300); }],
  ["start-created-leave", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open()(page); await page.locator(".dashboard-start").click(); await page.locator(".handover-type-card.leave").click(); await page.getByPlaceholder("업무를 입력하고 Enter를 눌러 추가하세요").fill("B2B 플랫폼 운영"); await page.locator(".onboarding-next").click(); await page.waitForTimeout(800); }],
  ["upload-leave", () => { scenario = { me: true, stage: "setup", status: "idle", extra: { mode: "leave" } }; }, open(`#/s/${SID}`)],
  ["processing-leave", () => { scenario = { me: true, stage: "analyzing", status: "running", extra: { mode: "leave" } }; }, open(`#/s/${SID}`)],
  ["processing-error", () => { scenario = { me: true, stage: "analyzing", status: "error", extra: { error: "Claude API 호출이 실패했습니다 (rate limit)." } }; }, open(`#/s/${SID}`)],
  ["generating", () => { scenario = { me: true, stage: "composing", status: "running", extra: { progress: { message: "인수인계서를 작성하고 있어요.", current: 0, total: 0 } } }; }, open(`#/s/${SID}`)],
  ["generating-leave", () => { scenario = { me: true, stage: "composing", status: "running", extra: { mode: "leave", progress: { message: "인수인계서를 작성하고 있어요.", current: 0, total: 0 } } }; }, open(`#/s/${SID}`)],
  ["generating-error", () => { scenario = { me: true, stage: "composing", status: "error", extra: { error: "Claude API 예산을 모두 사용했어요." } }; }, open(`#/s/${SID}`)],
  ["question-generate", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.locator(".question-page-actions .onboarding-next").click(); await page.waitForTimeout(1500); }],
  ["document-revision-open", () => { scenario = { me: true, stage: "review", status: "idle", extra: { document_version: 1 } }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.locator(".amigo-revision-button").click(); await page.waitForTimeout(300); }],
  ["document-revision-sent", () => { scenario = { me: true, stage: "review", status: "idle", extra: { document_version: 1 } }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.locator(".amigo-revision-button").click(); await page.locator(".revision-compose textarea").fill("협업 관계에 총무팀 최유진 주임(내선 3456)도 추가해 주세요"); await page.locator(".revision-send").click(); await page.waitForTimeout(1500); }],
  ["document-revision-error", () => { scenario = { me: true, stage: "review", status: "error", extra: { document_version: 1, error: "수정 요청을 처리하지 못했어요." } }; }, open(`#/s/${SID}`)],
  ["generate-to-document", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.locator(".question-page-actions .onboarding-next").click(); await page.waitForTimeout(1200); scenario = { ...scenario, stage: "review", status: "idle", extra: { document_version: 1 } }; await page.waitForTimeout(2500); }],
  ["revision-to-document", () => { scenario = { me: true, stage: "review", status: "idle", extra: { document_version: 1 } }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.locator(".amigo-revision-button").click(); await page.locator(".revision-compose textarea").fill("총무팀 최유진 주임 추가"); await page.locator(".revision-send").click(); await page.waitForTimeout(1200); scenario = { ...scenario, stage: "review", status: "idle", extra: { document_version: 2 } }; await page.waitForTimeout(2500); }],
  ["complete-to-home", () => { scenario = { me: true, stage: "review", status: "idle", extra: { document_version: 1 } }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.locator(".finish-handover:visible").first().click(); await page.getByRole("button", { name: /홈으로 돌아가기/ }).click(); await page.waitForTimeout(600); }],
  ["complete-to-new", () => { scenario = { me: true, stage: "review", status: "idle", extra: { document_version: 1 } }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.locator(".finish-handover:visible").first().click(); await page.getByRole("button", { name: /새 인수인계 시작하기/ }).click(); await page.waitForTimeout(400); }],
  ["route-direct-documents", () => { scenario = { me: true, stage: "review", status: "idle", extra: { document_version: 1 } }; }, open("#/home/documents")],
  ["route-direct-admin", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, open("#/admin")],
  ["route-direct-new-leave", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, open("#/new/leave")],
  ["route-step-mismatch", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, open(`#/s/${SID}/question`)],
  ["route-direct-generating", () => { scenario = { me: true, stage: "composing", status: "running", extra: { progress: { message: "인수인계서를 작성하고 있어요.", current: 0, total: 0 } } }; }, open(`#/s/${SID}`)],
  ["route-direct-document", () => { scenario = { me: true, stage: "review", status: "idle", extra: { document_version: 2 } }; }, open(`#/s/${SID}`)],
  ["route-direct-complete", () => { scenario = { me: true, stage: "review", status: "idle", extra: { document_version: 1 } }; }, open(`#/s/${SID}/complete`)],
  ["route-old-link", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, open(`#/s/${SID}`)],
  ["route-back-forward-home", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open()(page); await page.locator(".sidebar-nav button", { hasText: "진행 중인 인수인계" }).click(); await page.waitForTimeout(300); await page.locator(".sidebar-nav button", { hasText: "완성 문서" }).click(); await page.waitForTimeout(300); await page.goBack(); await page.waitForTimeout(300); await page.goBack(); await page.waitForTimeout(300); await page.goForward(); await page.waitForTimeout(400); }],
  ["route-back-from-upload", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.locator(".previous-step").click(); await page.waitForTimeout(400); await page.goBack(); await page.waitForTimeout(500); }],
  ["route-back-after-generate", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.locator(".question-page-actions .onboarding-next").click(); await page.waitForTimeout(1200); scenario = { ...scenario, stage: "review", status: "idle", extra: { document_version: 1 } }; await page.waitForTimeout(2500); await page.goBack(); await page.waitForTimeout(600); }],
  ["route-back-to-home-from-session", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open()(page); await page.locator(".sidebar-nav button", { hasText: "진행 중인 인수인계" }).click(); await page.getByRole("button", { name: /이어서 작성/ }).first().click(); await page.waitForTimeout(800); await page.goBack(); await page.waitForTimeout(600); }],
  ["route-login-deeplink", () => { scenario = { me: false, stage: "qna", status: "waiting", extra: {} }; }, async (page) => { await open(`#/s/${SID}/question`)(page); await page.getByPlaceholder("업무용 아이디를 입력하세요").fill("2503141"); await page.getByPlaceholder("비밀번호를 입력하세요").fill("pw"); await page.getByRole("button", { name: /^로그인/ }).click(); await page.waitForTimeout(900); }],
  ["gate-loading", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {}, stateStatus: 0 }; }, async (page) => { await page.route("**/api/sessions/*/state*", () => new Promise(() => {})); await page.goto(`${BASE}/#/s/${SID}`); await page.waitForTimeout(800); }],
  ["gate-missing", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {}, stateStatus: 404 }; }, open(`#/s/${SID}`)],
  ["gate-missing-home", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {}, stateStatus: 404 }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.getByRole("button", { name: /홈으로 돌아가기/ }).click(); await page.waitForTimeout(500); }],
  ["gate-server", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {}, stateStatus: 500 }; }, open(`#/s/${SID}`)],
  ["gate-server-retry", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {}, stateStatus: 500 }; }, async (page) => { await open(`#/s/${SID}`)(page); scenario = { ...scenario, stateStatus: 0 }; await page.getByRole("button", { name: /다시 시도/ }).click(); await page.waitForTimeout(700); }],
  ["gate-expired", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {}, stateStatus: 401 }; }, open(`#/s/${SID}`)],
  ["list-expired", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {}, list: "expired" }; }, open()],
  ["start", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, open("#/new/reassignment")],
  ["upload", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, open(`#/s/${SID}`)],
  ["upload-mattermost", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.getByRole("button", { name: /메신저/ }).click(); await page.waitForTimeout(400); }],
  ["upload-mattermost-scrolled", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.getByRole("button", { name: /메신저/ }).click(); await page.waitForTimeout(400); await page.evaluate(() => { const m = document.querySelector(".upload-step-main"); m.scrollTop = m.scrollHeight; }); await page.waitForTimeout(200); }],
  ["upload-confluence", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.locator(".source-card-heading").click(); await page.waitForTimeout(300); await page.locator(".integration-search input").fill("운영"); await page.locator(".integration-search button").click(); await page.waitForTimeout(400); }],
  ["upload-mail", () => { scenario = { me: true, stage: "setup", status: "idle", extra: {} }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.getByRole("button", { name: /메일 연결/ }).click(); await page.waitForTimeout(300); }],
  ["processing", () => { scenario = { me: true, stage: "analyzing", status: "running", extra: {} }; }, open(`#/s/${SID}`)],
  ["processing-done", () => { scenario = { me: true, stage: "summary", status: "idle", extra: {} }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.evaluate(() => history.replaceState(null, "", "#/s/abc123def4567890")); }],
  ["question", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {} }; }, open(`#/s/${SID}`)],
  ["question-confirm", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: {}, messageCount: 4 }; }, open(`#/s/${SID}`)],
  ["question-running", () => { scenario = { me: true, stage: "qna", status: "running", extra: { progress: { message: "답변을 정리하고 있어요.", current: 0, total: 0 } }, messageCount: 3 }; }, open(`#/s/${SID}`)],
  ["question-error", () => { scenario = { me: true, stage: "qna", status: "error", extra: { error: "AI 응답 시간이 초과됐어요." }, messageCount: 3 }; }, open(`#/s/${SID}`)],
  ["question-empty", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: { gaps: [], open_gap_count: 0, question_count: 0 }, messageCount: 1 }; }, open(`#/s/${SID}`)],
  ["question-leave", () => { scenario = { me: true, stage: "qna", status: "waiting", extra: { mode: "leave" } }; }, open(`#/s/${SID}`)],
  ["document", () => { scenario = { me: true, stage: "review", status: "idle", extra: { document_version: 1 } }; }, open(`#/s/${SID}`)],
  ["document-editing", () => { scenario = { me: true, stage: "review", status: "idle", extra: { document_version: 1 } }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.getByRole("button", { name: /직접 수정하기/ }).click(); await page.waitForTimeout(200); }],
  ["complete", () => { scenario = { me: true, stage: "review", status: "idle", extra: { document_version: 1 } }; }, async (page) => { await open(`#/s/${SID}`)(page); await page.locator(".finish-handover:visible").first().click(); await page.waitForTimeout(300); }],
];
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const vps = process.env.VP ? process.env.VP.split(",") : ["desktop", "laptop", "mobile"];
for (const [name, set, setup] of steps) {
  if (only && !only.includes(name)) continue;
  for (const vp of vps) {
    if (vp === "mobile" && ["upload-mattermost", "upload-mattermost-scrolled", "upload-confluence", "upload-mail", "document-editing", "processing-done"].includes(name)) continue;
    set();
    try { await shot(name, vp, setup); } catch (e) { console.log(`${name}-${vp}: ✖ ${e.message.split("\n")[0]}`); }
  }
}
await browser.close();
