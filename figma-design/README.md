# figma-design — 확장 디자인 화면 (Figma Make)

Figma Make에서 만든 **AMIGO 확장 디자인**입니다. 저장소 최상위의 `src/`(BackEnd API 연동 7개 화면)와는 별도로 동작하는 화면 코드입니다.

- 들어 있는 화면: 로그인·회원가입·비밀번호 재설정, 홈 대시보드(캘린더·알림), 진행 중인 인수인계, 완성 문서, 받은 인수인계, 관리자 모드(대시보드·구성원·인수인계 관리·AI 맞춤 설정), 인수인계 유형 선택(정기인사/장기휴가), 4단계 작성 흐름, 완료 화면
- 아직 **BackEnd·AI와 연결되어 있지 않습니다.** 화면에 보이는 데이터는 예시 값이고, 분석·문서 생성은 진행 애니메이션만 보여줍니다.
- 상태는 앱이 실행되는 동안만 유지됩니다(`src/store/AppStore.tsx`). 새로고침하면 처음 상태로 돌아갑니다.

## 실행

```bash
cd figma-design
npm install
npm run dev      # http://localhost:8443
```

타입 검사: `npx tsc --noEmit` · 빌드: `npm run build`

## 구조

| 경로 | 내용 |
|---|---|
| `src/App.tsx` | 화면 전환 |
| `src/store/AppStore.tsx` | 프로필, 작성 중인 인수인계(입력값·단계) 공통 상태 |
| `src/components/` | 아이콘, 사이드바, 프로필 메뉴 등 공통 부품 |
| `src/screens/auth`, `home`, `admin`, `handover` | 화면별 컴포넌트 |
| `src/screens/legacy-workspace/` | 예전 3단 작업 화면(현재 진입 경로 없음, 보존용) |
| `src/index.css` | 디자인·애니메이션 전체 |
| `.figma/`, `vite.config.ts` | Figma Make 빌드 설정(`vite.config.ts`가 `.figma/make/site.json`을 읽으므로 지우지 마세요) |

`AGENTS.md`는 Figma Make 환경 기준으로 쓰여 있어서 "개발 서버가 이미 떠 있다"고 안내하지만, 이 저장소에서는 위 명령으로 직접 실행해야 합니다.

## 다음 작업 방향

이 폴더의 디자인을 최상위 `src/`의 API 연동 코드에 옮기거나, 반대로 이 화면에 `src/shared/api.ts`를 연결하는 방식으로 합칠 예정입니다.
