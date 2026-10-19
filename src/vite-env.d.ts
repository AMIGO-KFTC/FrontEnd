/// <reference types="vite/client" />

// 빌드 시 넣는 변수. 개발용 관리자 미리보기를 빌드 결과물에서도 열려면 VITE_ADMIN_PREVIEW=true 로 빌드한다.
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_ADMIN_PREVIEW?: string;
}
