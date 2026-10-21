import type { SessionSummary } from "@/shared/types";

// 홈 화면(대시보드·진행 중·완성 문서·받은 인수인계)이 공통으로 받는 이동 콜백
export type HomeNav = {
  onHome: () => void;
  onHandover: () => void;
  onDocuments: () => void;
  onReceived: () => void;
  onLogout: () => void;
};

// 서버 세션 목록. null 이면 아직 못 불러왔거나 실패한 것이라 "0건"으로 보여 주지 않는다.
export type SessionList = {
  sessions: SessionSummary[] | null;
  error: string | null;
  reload: () => void;
  open: (id: string) => void;
  openDocument: (id: string) => void; // 받은 인수인계의 문서 보기(인수자는 읽기만)
  remove: (id: string) => Promise<string | null>; // 실패하면 오류 문구를 돌려준다
};
