// 주소 해시 라우터. 화면 상태를 주소에 담아 새로고침·직접 접속·뒤로/앞으로 가기가 모두 같은 규칙으로 동작하게 한다.
//
//   #/                     홈 대시보드
//   #/home/handover        진행 중인 인수인계      #/home/documents  내가 작성한 문서      #/home/received  받은 인수인계
//   #/home/calendar        캘린더 · 할 일          #/home/materials  근거 자료(업무별)
//   #/home/chat            인수인계서 챗봇(모든 문서)   #/home/chat/<문서ID>  그 문서만 물어보기
//   #/admin                팀 관리 모드(팀장)          #/admin/<tab>     팀 관리의 탭(tab = dashboard | members | handovers | duties | ai | personnel)
//   #/new                  인수인계 유형 선택      #/new/<mode>      기본 정보(mode = reassignment | leave)
//   #/s/<세션ID>           작업(서버에 저장된 단계로 복원)
//   #/s/<세션ID>/<step>    작업의 특정 화면(step = upload | processing | question | generating | document | complete)
//
// 예전 주소 #/s/<세션ID> 는 그대로 쓸 수 있다. 화면 사이 이동은 주소만 바꾸고, API 호출은 각 화면이 필요할 때만 한다.
import { useCallback, useEffect, useState } from "react";
import type { HandoverMode, SessionDetail, Stage } from "./types";

export type HomePage = "dashboard" | "handover" | "documents" | "received" | "chat" | "calendar" | "materials";
export type AdminSection = "dashboard" | "members" | "handovers" | "duties" | "ai" | "personnel";
export type StepScreen = "upload" | "processing" | "question" | "generating" | "document" | "complete";
export type Route =
  | { kind: "home"; page: HomePage; docId?: string } // docId 는 챗봇이 처음 물어볼 문서
  | { kind: "admin"; section: AdminSection }
  | { kind: "new"; mode: HandoverMode | null }
  | { kind: "session"; id: string; step: StepScreen | null };

const HOME_PAGES: HomePage[] = ["dashboard", "handover", "documents", "received", "chat", "calendar", "materials"];
const ADMIN_SECTIONS: AdminSection[] = ["dashboard", "members", "handovers", "duties", "ai", "personnel"];
const STEPS: StepScreen[] = ["upload", "processing", "question", "generating", "document", "complete"];
const SESSION_ID = /^[0-9a-f]{8,64}$/;
const DOC_ID = /^(transfer:)?[0-9a-f]{8,64}$/;

export const HOME: Route = { kind: "home", page: "dashboard" };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts.length === 0) return HOME;
  if (parts[0] === "home") {
    const page = parts[1] as HomePage | undefined;
    if (page === "chat") return parts[2] && DOC_ID.test(parts[2]) ? { kind: "home", page, docId: parts[2] } : { kind: "home", page };
    return { kind: "home", page: page && HOME_PAGES.includes(page) ? page : "dashboard" };
  }
  if (parts[0] === "admin") {
    const section = parts[1] as AdminSection | undefined;
    return { kind: "admin", section: section && ADMIN_SECTIONS.includes(section) ? section : "dashboard" };
  }
  if (parts[0] === "new") {
    const mode = parts[1];
    return { kind: "new", mode: mode === "leave" || mode === "reassignment" ? mode : null };
  }
  if (parts[0] === "s" && parts[1] && SESSION_ID.test(parts[1])) {
    const step = parts[2] as StepScreen | undefined;
    return { kind: "session", id: parts[1], step: step && STEPS.includes(step) ? step : null };
  }
  return HOME; // 모르는 주소는 홈으로
}

export function buildHash(route: Route): string {
  switch (route.kind) {
    case "home":
      if (route.page === "chat" && route.docId) return `#/home/chat/${route.docId}`;
      return route.page === "dashboard" ? "#/" : `#/home/${route.page}`;
    case "admin":
      return route.section === "dashboard" ? "#/admin" : `#/admin/${route.section}`;
    case "new":
      return route.mode ? `#/new/${route.mode}` : "#/new";
    case "session":
      return route.step ? `#/s/${route.id}/${route.step}` : `#/s/${route.id}`;
  }
}

export function sameRoute(a: Route, b: Route): boolean {
  return buildHash(a) === buildHash(b);
}

// 서버 단계로 정한 기본 화면(새로고침·직접 접속·목록에서 열기)
export function screenForStage(stage: Stage): StepScreen {
  switch (stage) {
    case "setup":
      return "upload";
    case "analyzing":
      return "processing";
    case "summary":
    case "qna":
      return "question";
    case "composing":
      return "generating";
    default:
      return "document"; // review
  }
}

// 주소가 가리키는 화면을 서버 단계가 허용하는지. 허용하지 않으면(예: 자료도 없는데 질의응답) 단계 기본 화면으로 돌린다.
export function resolveStep(requested: StepScreen | null, session: SessionDetail): StepScreen {
  const fallback = screenForStage(session.stage);
  if (!requested) return fallback;
  const allowed: StepScreen[] = (() => {
    switch (session.stage) {
      case "setup":
        return ["upload"];
      case "analyzing":
        return ["processing", "upload"];
      case "summary":
      case "qna":
        return ["question", "upload", "processing"];
      case "composing":
        return ["generating"];
      default:
        return session.document_version > 0 ? ["document", "complete", "question", "upload"] : ["question", "upload"];
    }
  })();
  return allowed.includes(requested) ? requested : fallback;
}

function currentRoute(): Route {
  return parseHash(window.location.hash);
}

// 주소 해시를 상태처럼 쓰는 훅. navigate 는 기록을 쌓고(push), replace 는 현재 기록을 바꾼다(자동 전환용).
export function useHashRoute() {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    const sync = () => setRoute(currentRoute());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  const navigate = useCallback((next: Route, options: { replace?: boolean } = {}) => {
    const hash = buildHash(next);
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    if (window.location.hash === hash || (hash === "#/" && window.location.hash === "")) {
      setRoute(next);
      return;
    }
    if (options.replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    setRoute(next);
  }, []);

  return { route, navigate };
}
