// 관리자 모드는 BackEnd 에 관리자 권한·관리 API 가 아직 없어 "개발용 미리보기"로만 제공한다.
// 개발 서버(npm run dev)에서는 항상 보이고, 빌드 결과물에서는 VITE_ADMIN_PREVIEW=true 로 빌드했을 때만 보인다.
// 실제 관리자 기능은 서버가 사용자 역할을 내려 주고 관리 API 가 생긴 뒤 서버 권한으로 제한해야 한다.
export const ADMIN_PREVIEW: boolean = import.meta.env.DEV || import.meta.env.VITE_ADMIN_PREVIEW === "true";
