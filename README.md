# AMIGO FrontEnd — 인수인계 도우미 화면 (React + Vite)

AI 기반 인수인계서 자동 작성 시스템의 **화면(UI/UX)** 입니다.
자료를 올리고, AI 의 진행 단계를 확인하며, 메신저처럼 질문에 답하고, 완성된 인수인계서를 내려받습니다.

```
FrontEnd(이 저장소, :5173) ──/api(프록시)──▶ BackEnd(FastAPI, :8000) ──▶ AI(LangGraph) · RAG(ChromaDB)
```

## 실행

```bash
npm install
npm run dev          # http://localhost:5173  (/api 요청은 http://localhost:8000 으로 프록시)
npm run build        # 타입 검사 + dist/ 생성
```

BackEnd 가 먼저 떠 있어야 합니다(BackEnd/README.md 참고). 다른 주소의 API 를 쓰려면 `AMIGO_API=http://서버:8000 npm run dev`.
`npm run build` 결과물(`dist/`)은 BackEnd 의 `AMIGO_FRONTEND_DIST=../FrontEnd/dist` 설정으로 8000 포트 하나에서 함께 서비스할 수 있습니다.

## 화면 구성

| 화면 | 컴포넌트 | 내용 |
|---|---|---|
| 시작 | `StartScreen` | 인계자 기초 정보 등록(성명·소속·직책·담당 업무·인수자·인계일), 최근 작업 이어하기 |
| 진행 단계 | `StageProgress` | STAGE 1 자료 분석 ➔ 2 분석 요약 ➔ 3 질의응답 ➔ 4 문서 생성 스테퍼 + 진행률 바 + 현재 작업 문구 |
| 자료 등록 | `UploadPanel` | **드래그 앤 드롭 업로드**(PDF·HWPX/HWP·Word·PPT·Excel·메일·소스코드·ZIP), 컨플루언스/나누미 **링크 입력**, 처리 상태(대기/처리 중/완료/실패 사유), 분석 시작 |
| 대화 | `ChatPanel` | **메신저 형태 채팅**: 질문·확인 요청·요약 말풍선, 빠른 답장(네, 맞아요 / 건너뛰기 / 지금 문서 생성), 입력 중 표시, 채팅창에서 자료 첨부 |
| 항목 현황 | `SlotBoard` | 인수인계서 항목별 충족 수준(충분/부분/부족), 항목·근거 출처·확인 필요 필드 미리보기 |
| 문서 | `DocumentViewer` | **Markdown 인수인계서 뷰어**(표·근거 번호), **PDF / Word / Markdown 다운로드**, 인쇄 |

화면 폭이 좁으면(모바일) 자료 · 대화·문서 · 현황을 탭으로 전환합니다.

## 백엔드 연동 방식

- `src/api.ts` 에 모든 API 호출이 있습니다. 오류는 서버의 `detail` 메시지를 그대로 토스트로 보여 줍니다.
- `src/hooks/useSessionState.ts` 가 `GET /api/sessions/{id}/state?after=<마지막 메시지 ID>` 를 폴링합니다.
  AI 가 처리 중이거나 자료를 적재 중이면 1초, 그 외에는 4초 간격으로 새 메시지만 받아 이어 붙입니다.
- 분석·답변·문서 생성 요청은 서버가 202 로 바로 응답하고 백그라운드에서 처리하므로, 화면은 폴링 결과로 진행 상황을 그립니다.
- 주소창 해시(`#/s/<세션ID>`)로 현재 세션을 기억해 새로고침해도 이어서 작업합니다.
- 브라우저별 임의 ID 를 `X-User-Id` 헤더로 보내 사용자별 작업 목록을 구분합니다(프로토타입용, 실서비스는 SSO 로 교체).

## 구조

```
src/
  App.tsx                 # 해시 라우팅, 토스트
  api.ts / types.ts       # API 클라이언트와 응답 타입(BackEnd/app/schemas.py 와 동일)
  hooks/useSessionState.ts
  components/
    StartScreen.tsx  Workspace.tsx  StageProgress.tsx  UploadPanel.tsx
    ChatPanel.tsx    SlotBoard.tsx  DocumentViewer.tsx icons.tsx
  styles.css              # 디자인 토큰(:root 변수)과 반응형 레이아웃, 인쇄 스타일
```
