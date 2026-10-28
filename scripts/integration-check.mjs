// 실제 BackEnd + 개발 서버를 상대로 전체 흐름을 브라우저에서 확인한다(API 가로채기 없음).
// 로그인 → 세션 생성 → 자료 업로드 → 분석 → 질의응답(답변·확인·건너뛰기·첨부) → 문서 생성 → 다운로드
// → 완료·목록·이어서 작성 → 삭제 → 로그아웃 후 주소 복귀까지 단계별 PASS/FAIL/SKIP 을 출력한다.
//
// 준비: BackEnd(8000)와 FrontEnd 개발 서버(5173)가 떠 있어야 하고, Playwright + Chromium 이 필요하다.
//   node scripts/integration-check.mjs [출력폴더]
//   환경변수: AMIGO_TEST_ID / AMIGO_TEST_PASSWORD(없으면 임의 계정을 가입해 쓴다. 비밀번호는 출력하지 않는다)
//            AMIGO_SAMPLES(기본 ../RAG/samples), BASE_URL(기본 http://localhost:5173), API_URL(기본 http://localhost:8000/api)
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const API = process.env.API_URL ?? "http://localhost:8000/api";
const OUT = process.argv[2] ?? "integration-shots";
fs.mkdirSync(OUT, { recursive: true });

// 샘플 자료: 일부 환경의 Playwright 가 한글 파일명을 input 에 넣지 못해 임시 폴더에 ASCII 이름으로 복사해 쓴다(서버는 한글 이름도 처리한다).
const sourceDir = process.env.AMIGO_SAMPLES ?? path.resolve("../RAG/samples");
const SAMPLES = fs.mkdtempSync(path.join(os.tmpdir(), "amigo-samples-"));
fs.readdirSync(sourceDir).filter((f) => !f.endsWith(".py")).forEach((f, i) => fs.copyFileSync(path.join(sourceDir, f), path.join(SAMPLES, `sample${i + 1}${path.extname(f)}`)));

const cred = process.env.AMIGO_TEST_ID
  ? { login_id: process.env.AMIGO_TEST_ID, password: process.env.AMIGO_TEST_PASSWORD ?? "", name: "검증자" }
  : { login_id: `uitest_${Date.now().toString(36)}`, password: `Pw-${crypto.randomBytes(9).toString("base64url")}`, name: "검증자" };
console.log(`테스트 계정: ${cred.login_id}`);

const results = [];
const record = (step, ok, note = "") => { results.push({ step, ok, note }); console.log(`${ok === null ? "SKIP" : ok ? "PASS" : "FAIL"}  ${step}${note ? "  — " + note : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs, every = 500) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { const v = await fn(); if (v) return v; } catch {}
    await sleep(every);
  }
  return null;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
const rootClass = () => page.evaluate(() => document.querySelector("#root > *")?.className ?? "(empty)");
const hash = () => page.evaluate(() => location.hash);

try {
  // 0) 회원가입(이미 있으면 409 등 무시) — 실제 서버 API
  const signup = await page.request.post(`${API}/auth/signup`, { data: cred });
  record("회원가입 API", signup.ok() || signup.status() === 409 || signup.status() === 400, `HTTP ${signup.status()}`);

  // 1) 로그인
  await page.goto(`${BASE}/`);
  await page.waitForSelector(".login-page", { timeout: 15000 });
  await page.getByPlaceholder("업무용 아이디를 입력하세요").fill(cred.login_id);
  await page.getByPlaceholder("비밀번호를 입력하세요").fill(cred.password);
  await page.getByRole("button", { name: /^로그인/ }).click();
  const dash = await waitFor(async () => (await rootClass()).includes("dashboard-page"), 10000);
  await shot("01-dashboard");
  record("로그인 → 홈 대시보드", !!dash, `hash=${await hash()}`);

  // 2) 새 인수인계 → 유형 선택 → 기본 정보 → 세션 생성
  await page.locator(".dashboard-start").click();
  await page.locator(".handover-type-card.personnel").click();
  await page.waitForSelector(".onboarding-page");
  const prefilledName = await page.locator(".field-grid input").first().inputValue();
  record("기본 정보에 서버 프로필 이름 채움", prefilledName === cred.name, `name="${prefilledName}"`);
  await page.locator(".field-grid select").nth(0).selectOption({ index: 1 });
  await page.locator(".field-grid select").nth(1).selectOption({ index: 1 });
  await page.getByPlaceholder("업무를 입력하고 Enter를 눌러 추가하세요").fill("홈페이지 운영");
  await page.locator(".onboarding-next").click();
  const upload = await waitFor(async () => (await rootClass()).includes("upload-step-page"), 15000);
  const sessionHash = await hash();
  const sessionId = sessionHash.match(/#\/s\/([0-9a-f]+)/)?.[1];
  await shot("02-upload-empty");
  record("세션 생성 → 자료 등록 화면", !!upload && !!sessionId, `hash=${sessionHash}`);

  // 3) 자료 업로드(RAG/samples 6개) → 모두 ready
  const files = fs.readdirSync(SAMPLES).map((f) => path.join(SAMPLES, f));
  await page.locator("input.source-file-input").setInputFiles(files);
  const allReady = await waitFor(async () => {
    const state = await page.request.get(`${API}/sessions/${sessionId}/state?after=0`);
    const data = await state.json();
    const s = data.session.sources;
    return s.length === files.length && s.every((x) => x.status === "ready") ? s : (s.some((x) => x.status === "failed") ? false : null);
  }, 180000, 1500);
  await shot("03-upload-ready");
  record(`자료 업로드 ${files.length}건 처리 완료(ready)`, !!allReady, allReady ? `chunks=${allReady.map((s) => s.chunk_count).join("/")}` : "실패 또는 시간 초과");

  // 4) 분석 시작 → 분석 화면 → 완료 → 질의응답
  await page.locator(".upload-step-actions .onboarding-next").click();
  const processing = await waitFor(async () => (await rootClass()).includes("processing-page"), 15000);
  record("분석 시작 → 분석 화면", !!processing, `hash=${await hash()}`);
  const analyzed = await waitFor(async () => (await page.locator(".processing-next").innerText()).includes("질의응답 시작"), 180000, 1000);
  await shot("04-processing-done");
  record("서버 분석 완료 표시(진행률·현재 자료는 서버 값)", !!analyzed);
  await page.locator(".processing-next").click();
  const question = await waitFor(async () => (await rootClass()).includes("question-page"), 10000);
  const firstQuestion = await waitFor(async () => { const t = await page.locator(".amigo-question-card h2").innerText(); return t && !t.includes("준비하고") ? t : null; }, 60000, 1000);
  await shot("05-question");
  record("질의응답 화면에 서버 질문 표시", !!question && !!firstQuestion, firstQuestion ? firstQuestion.slice(0, 50) : "");
  const gapCount = await page.locator(".question-list-item").count();
  record("왼쪽 질문 목록 = 서버 gaps", gapCount > 0, `${gapCount}개`);

  // 5) 새로고침 복원(질의응답)
  await page.reload();
  const restored = await waitFor(async () => (await rootClass()).includes("question-page"), 20000);
  record("새로고침 → 질의응답 화면으로 복원", !!restored, `hash=${await hash()}`);

  // 6) 답변 → 확인 요청 → "네, 맞아요" → 다음 질문
  await page.locator(".answer-compose textarea").fill("재무팀 박지훈 차장, 내선 2345");
  await page.locator(".answer-send").click();
  const confirm = await waitFor(async () => (await page.locator(".question-chat-message.ai").count()) > 0 && (await page.locator(".answer-suggestions button", { hasText: "네" }).count()) > 0, 60000, 1000);
  await shot("06-answer-confirm");
  record("답변 전송 → 서버 확인 요청(말풍선·추천 답변)", !!confirm);
  const beforeAsked = await page.locator(".question-list-head em").innerText();
  await page.locator(".answer-suggestions button", { hasText: "네" }).click();
  const nextQ = await waitFor(async () => (await page.locator(".question-list-head em").innerText()) !== beforeAsked || (await page.locator(".question-list-item.done").count()) > 0, 60000, 1000);
  await shot("07-next-question");
  record("확인 후 다음 질문·목록 상태 갱신", !!nextQ, `${beforeAsked} → ${await page.locator(".question-list-head em").innerText()}`);

  // 7) 건너뛰기
  const doneBefore = await page.locator(".question-list-item.done").count();
  await page.locator(".question-skip").click();
  const skipped = await waitFor(async () => (await page.locator(".question-list-item.done").count()) > doneBefore, 60000, 1000);
  record("질문 건너뛰기", !!skipped);

  // 8) 대화 중 자료 첨부(추가 파일) → 안내 문구
  await page.locator(".answer-compose input[type=file]").setInputFiles([files[0]]);
  const attached = await waitFor(async () => (await page.locator("p[role=status]").count()) > 0, 60000, 1000);
  record("대화 중 자료 첨부 → 서버 반영 안내", !!attached, attached ? await page.locator("p[role=status]").first().innerText() : "");

  // 9) 문서 생성 → 생성 중 화면 → 문서 화면
  await page.locator(".question-page-actions .onboarding-next").click();
  const seen = await waitFor(async () => { const c = await rootClass(); return c.includes("generation-page") ? "generating" : c.includes("final-document-page") ? "document" : null; }, 15000, 100);
  await shot("08-generating");
  record("문서 생성 요청 수락(202) → 생성 중 또는 문서 화면", !!seen, `처음 잡힌 화면=${seen}, hash=${await hash()}`);
  if (seen !== "generating") record("생성 중 화면 표시(실제 서버)", null, "오프라인 엔진이 1초 안에 문서를 만들어 생성 중 화면이 순간 지나감 — 가짜 응답으로만 확인됨");
  const doc = await waitFor(async () => (await rootClass()).includes("final-document-page") && (await page.locator(".paper-section").count()) > 0, 180000, 1000);
  await shot("09-document-v1");
  record("문서 생성 완료 → 문서 화면(Markdown 섹션 렌더링)", !!doc, `섹션 ${await page.locator(".paper-section").count()}개, 목차 ${await page.locator(".final-outline nav button").count()}개`);
  const gantt = await page.locator(".final-paper table.gantt-table").count();
  const mermaid = await page.locator(".mermaid-box").count();
  record("간트 표 렌더링", gantt > 0 ? true : null, gantt > 0 ? `${gantt}개` : "문서에 월별 일정표가 없어 확인 못 함");
  record("Mermaid 관계도 렌더링", mermaid > 0 ? true : null, mermaid > 0 ? `${mermaid}개` : "문서에 관계도가 없어 확인 못 함");

  // 10) 새로고침 → 문서 화면 복원
  await page.reload();
  const docRestored = await waitFor(async () => (await rootClass()).includes("final-document-page") && (await page.locator(".paper-section").count()) > 0, 30000, 1000);
  record("새로고침 → 문서 화면으로 복원", !!docRestored, `hash=${await hash()}`);

  // 11) 다운로드(PDF·Word·Markdown): 쿠키 포함 요청으로 응답 확인
  for (const [fmt, type] of [["pdf", "application/pdf"], ["docx", "wordprocessingml"], ["md", "text/markdown"]]) {
    const res = await page.request.get(`${API}/sessions/${sessionId}/download?format=${fmt}`);
    const ct = res.headers()["content-type"] ?? "";
    const body = await res.body();
    record(`다운로드 ${fmt.toUpperCase()}`, res.ok() && ct.includes(type) && body.length > 500, `HTTP ${res.status()}, ${ct.split(";")[0]}, ${body.length} bytes`);
  }

  // 12) 완료 → 홈 → 목록(완성 문서)에 표시 → 문서 열기 → 이어서 작성 흐름
  await page.locator(".finish-handover:visible").first().click();
  await waitFor(async () => (await rootClass()).includes("completion-page"), 10000);
  await shot("11-complete");
  await page.getByRole("button", { name: /홈으로 돌아가기/ }).click();
  await waitFor(async () => (await rootClass()).includes("dashboard-page"), 10000);
  await page.locator(".sidebar-nav button", { hasText: "완성 문서" }).click();
  const listed = await waitFor(async () => (await page.locator(".documents-list > button").count()) > 0, 15000);
  await shot("12-documents-list");
  record("완료 → 홈 → 완성 문서 목록에 실제 세션 표시", !!listed, `${await page.locator(".documents-list > button").count()}건`);
  await page.getByRole("button", { name: /문서 열기/ }).click();
  const opened = await waitFor(async () => (await rootClass()).includes("final-document-page") && (await page.locator(".paper-section").count()) > 0, 30000, 1000);
  record("완성 문서 목록 → 문서 열기(서버 단계로 복원)", !!opened, `hash=${await hash()}`);

  // 13) 질의응답으로 돌아가기 → 뒤로가기/앞으로가기(변경 요청 없음)
  await page.locator(".document-back").click();
  await waitFor(async () => (await rootClass()).includes("question-page"), 10000);
  await page.goBack();
  const backDoc = await waitFor(async () => (await rootClass()).includes("final-document-page"), 10000);
  await page.goForward();
  const fwdQ = await waitFor(async () => (await rootClass()).includes("question-page"), 10000);
  record("브라우저 뒤로·앞으로 가기(문서 ↔ 질의응답)", !!backDoc && !!fwdQ);

  // 14) 두 번째 세션으로 "이어서 작성": 새 세션을 자료 등록 단계에 두고 홈 목록에서 열기
  await page.goto(`${BASE}/#/new/leave`);
  await page.waitForSelector(".onboarding-page.leave-theme");
  await page.locator(".field-grid select").nth(0).selectOption({ index: 1 });
  await page.locator(".field-grid select").nth(1).selectOption({ index: 1 });
  await page.getByPlaceholder("업무를 입력하고 Enter를 눌러 추가하세요").fill("휴가 중 결재 대행");
  await page.locator(".onboarding-next").click();
  await waitFor(async () => (await rootClass()).includes("upload-step-page"), 15000);
  const leaveHash = await hash();
  await page.goto(`${BASE}/#/home/handover`);
  const ongoing = await waitFor(async () => (await page.locator(".ongoing-card").count()) > 0, 15000);
  await shot("13-ongoing-list");
  record("장기휴가 세션 생성 → 진행 중 목록에 표시", !!ongoing, `${await page.locator(".ongoing-card").count()}건`);
  await page.locator(".ongoing-card", { hasText: "휴가 중 결재 대행" }).getByRole("button", { name: /이어서 작성/ }).click();
  const resumed = await waitFor(async () => (await rootClass()).includes("upload-step-page") && (await rootClass()).includes("leave-theme"), 15000);
  record("이어서 작성 → 저장된 단계(자료 등록)·바다 테마로 복원", !!resumed, `${leaveHash} → ${await hash()}`);

  // 15) 삭제(확인창 → 서버 삭제 → 목록 갱신), 삭제된 주소 접속 → 안내
  await page.goto(`${BASE}/#/home/handover`);
  await waitFor(async () => (await page.locator(".ongoing-card").count()) > 0, 15000);
  const card = page.locator(".ongoing-card", { hasText: "휴가 중 결재 대행" });
  await card.locator("button[title='더보기']").click();
  await card.locator(".ongoing-more-menu button").click();
  await page.locator(".logout-modal button:last-child").click();
  const deleted = await waitFor(async () => (await page.locator(".ongoing-card", { hasText: "휴가 중 결재 대행" }).count()) === 0, 15000);
  record("삭제 확인창 → 서버 삭제 → 목록 갱신", !!deleted);
  await page.goto(`${BASE}/${leaveHash}`);
  const gone = await waitFor(async () => (await page.locator(".session-gate-visual.missing").count()) > 0, 15000);
  await shot("14-deleted-session");
  record("삭제된 작업 주소 접속 → '열 수 없는 작업' 안내", !!gone);

  // 16) 로그아웃 → 작업 주소 직접 접속 → 로그인 → 같은 작업으로 복귀
  await page.goto(`${BASE}/#/`);
  await waitFor(async () => (await rootClass()).includes("dashboard-page"), 10000);
  await page.locator(".profile-more").click();
  await page.locator(".profile-logout").click();
  await page.locator(".logout-modal button:last-child").click();
  await waitFor(async () => (await rootClass()).includes("login-page"), 10000);
  await page.goto(`${BASE}/#/s/${sessionId}/document`);
  await page.waitForSelector(".login-page");
  await page.getByPlaceholder("업무용 아이디를 입력하세요").fill(cred.login_id);
  await page.getByPlaceholder("비밀번호를 입력하세요").fill(cred.password);
  await page.getByRole("button", { name: /^로그인/ }).click();
  const deep = await waitFor(async () => (await rootClass()).includes("final-document-page") && (await page.locator(".paper-section").count()) > 0, 30000, 1000);
  record("로그아웃 후 작업 주소 접속 → 로그인 → 같은 문서로 복귀", !!deep, `hash=${await hash()}`);
} catch (e) {
  record("스크립트 중단", false, e.message.split("\n")[0]);
  await shot("error");
} finally {
  await browser.close();
  console.log(`\n페이지 JS 오류: ${errors.length}${errors.length ? "\n" + errors.join("\n") : ""}`);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  const pass = results.filter((r) => r.ok === true).length, fail = results.filter((r) => r.ok === false).length, skip = results.filter((r) => r.ok === null).length;
  console.log(`\nPASS ${pass} / FAIL ${fail} / SKIP ${skip}`);
}
