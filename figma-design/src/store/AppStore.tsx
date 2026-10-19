import { createContext, ReactNode, SetStateAction, useCallback, useContext, useRef, useState } from "react";
import { firstAnswerReply, questions } from "@/screens/handover/questions";
import { type HandoverVariant, type StartData } from "@/screens/handover/types";

// App-wide state shared across screens. Lives only while the app is running (no persistence yet).

export type Profile = { name: string; employeeId: string; division: string; team: string; role: string; photo: string };

export type HandoverStep = "start" | "upload" | "processing" | "question" | "generating" | "document" | "complete";
export type DraftFile = { name: string; size: number; file?: File };
export type DraftMail = { id: number; subject: string; sender: string };
export type ChatMessage = { role: "user" | "ai"; text: string };

export type HandoverDraft = {
  id: number;
  variant: HandoverVariant;
  step: HandoverStep;
  completed: boolean;
  title?: string;
  tone: "violet" | "coral";
  /** Minimum progress shown on the card; the step-based value is used when higher. */
  progress: number;
  updatedAt: number;
  startData: StartData;
  files: DraftFile[];
  links: string[];
  mailResources: DraftMail[];
  mailAuthenticated: boolean;
  mailAddress: string;
  selectedMailIds: number[];
  questionIndex: number;
  conversations: Record<number, ChatMessage[]>;
  completedQuestions: number[];
};

const initialProfile: Profile = { name: "김민준", employeeId: "2503141", division: "프로덕트본부", team: "플랫폼팀", role: "프로덕트 매니저", photo: "" };

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const emptyResources = { files: [], links: [], mailResources: [], mailAuthenticated: false, mailAddress: "", selectedMailIds: [] };
const emptyQuestions = { questionIndex: 0, conversations: {}, completedQuestions: [] };

const initialDrafts: HandoverDraft[] = [
  {
    id: 1,
    variant: "personnel",
    step: "question",
    completed: false,
    title: "B2B 플랫폼 운영 인수인계",
    tone: "violet",
    progress: 72,
    updatedAt: Date.now() - 10 * MINUTE,
    startData: { name: "김민준", division: "프로덕트본부", team: "플랫폼팀", role: "프로덕트 매니저", task: "B2B 플랫폼 운영\n고객 요청 및 장애 대응", date: "2025-03-25" },
    files: [
      { name: "플랫폼_운영가이드_v3.pdf", size: 4.8 * 1024 * 1024 },
      { name: "2025_Q1_백로그.xlsx", size: 1.2 * 1024 * 1024 },
      { name: "장애대응_연락망.pdf", size: 0.6 * 1024 * 1024 },
      { name: "월간_배포_체크리스트.docx", size: 0.4 * 1024 * 1024 },
      { name: "운영지표_리포트_2월.pptx", size: 3.1 * 1024 * 1024 },
    ],
    links: ["https://confluence.company.com/platform/operations"],
    mailResources: [
      { id: 1, subject: "2025년 플랫폼 운영 계획 및 주요 일정 공유", sender: "김민준 · 플랫폼기획팀" },
      { id: 3, subject: "장애 대응 프로세스 및 비상 연락망 업데이트", sender: "박지훈 · 인프라팀" },
    ],
    mailAuthenticated: true,
    mailAddress: "minjun.kim@company.com",
    selectedMailIds: [1, 3],
    questionIndex: 2,
    conversations: {
      0: [{ role: "user", text: "플랫폼팀 전원이 참석하고, 결과는 #platform-weekly 채널에 공유해요." }, { role: "ai", text: firstAnswerReply }],
      1: [{ role: "user", text: "당직 담당자를 먼저 확인하고, 이지윤님께 바로 연락해요." }, { role: "ai", text: firstAnswerReply }],
    },
    completedQuestions: [0, 1],
  },
  {
    id: 2,
    variant: "personnel",
    step: "processing",
    completed: false,
    title: "Q1 프로젝트 진행 현황",
    tone: "coral",
    progress: 38,
    updatedAt: Date.now() - DAY,
    startData: { name: "김민준", division: "프로덕트본부", team: "서비스기획팀", role: "프로덕트 매니저", task: "Q1 프로젝트 진행 현황 관리", date: "2025-04-02" },
    files: [
      { name: "Q1_프로젝트_로드맵.pptx", size: 2.4 * 1024 * 1024 },
      { name: "프로젝트_이슈트래커.xlsx", size: 0.9 * 1024 * 1024 },
      { name: "주간회의록_모음.docx", size: 0.7 * 1024 * 1024 },
    ],
    links: ["https://confluence.company.com/planning/q1-projects", "https://nanumi.company.com/docs/q1-review"],
    mailResources: [],
    mailAuthenticated: false,
    mailAddress: "",
    selectedMailIds: [],
    ...emptyQuestions,
  },
];

const stepLabels: Record<HandoverStep, string> = {
  start: "기본 정보",
  upload: "자료 등록",
  processing: "자료 분석",
  question: "질의응답",
  generating: "문서 생성",
  document: "문서 검토",
  complete: "완료",
};

export function draftStageLabel(draft: HandoverDraft) {
  return stepLabels[draft.step];
}

export function draftProgress(draft: HandoverDraft) {
  const byStep: Record<HandoverStep, number> = {
    start: 10,
    upload: 25,
    processing: 38,
    question: 50 + Math.round((draft.completedQuestions.length / questions.length) * 30),
    generating: 85,
    document: 95,
    complete: 100,
  };
  return Math.max(draft.progress, byStep[draft.step]);
}

export function draftTitle(draft: HandoverDraft) {
  if (draft.title) return draft.title;
  const firstTask = draft.startData.task.split("\n").find(Boolean);
  return firstTask ? `${firstTask} 인수인계` : "새 인수인계";
}

export function draftResourceCount(draft: HandoverDraft) {
  return draft.files.length + draft.links.length + draft.mailResources.length;
}

export function formatDueDate(date: string) {
  return date ? date.replace(/-/g, ". ") : "미정";
}

export function formatRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < MINUTE) return "방금 전";
  if (diff < 60 * MINUTE) return `${Math.floor(diff / MINUTE)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / (60 * MINUTE))}시간 전`;
  const days = Math.floor(diff / DAY);
  return days === 1 ? "어제" : `${days}일 전`;
}

type AppStoreValue = {
  profile: Profile;
  setProfile: (profile: Profile) => void;
  drafts: HandoverDraft[];
  activeDraft: HandoverDraft | null;
  setActiveDraftId: (id: number | null) => void;
  createDraft: (variant: HandoverVariant) => number;
  updateDraft: (id: number, updater: (draft: HandoverDraft) => HandoverDraft) => void;
  deleteDraft: (id: number) => void;
};

const AppStoreContext = createContext<AppStoreValue | null>(null);

export default function AppStoreProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState(initialProfile);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [activeDraftId, setActiveDraftId] = useState<number | null>(null);
  const nextDraftId = useRef(initialDrafts.length + 1);

  const createDraft = (variant: HandoverVariant) => {
    const id = nextDraftId.current++;
    const draft: HandoverDraft = {
      id,
      variant,
      step: "start",
      completed: false,
      tone: id % 2 ? "violet" : "coral",
      progress: 0,
      updatedAt: Date.now(),
      startData: { name: profile.name, division: profile.division, team: profile.team, role: profile.role, task: "B2B 플랫폼 기획 및 운영", date: "2025-03-14" },
      ...emptyResources,
      ...emptyQuestions,
    };
    setDrafts((current) => [draft, ...current]);
    setActiveDraftId(id);
    return id;
  };

  const updateDraft = useCallback((id: number, updater: (draft: HandoverDraft) => HandoverDraft) => {
    setDrafts((current) => current.map((draft) => {
      if (draft.id !== id) return draft;
      const next = updater(draft);
      return next === draft ? draft : { ...next, updatedAt: Date.now() };
    }));
  }, []);

  const deleteDraft = (id: number) => {
    setDrafts((current) => current.filter((draft) => draft.id !== id));
    setActiveDraftId((current) => (current === id ? null : current));
  };

  const activeDraft = drafts.find((draft) => draft.id === activeDraftId) ?? null;

  return (
    <AppStoreContext.Provider value={{ profile, setProfile, drafts, activeDraft, setActiveDraftId, createDraft, updateDraft, deleteDraft }}>
      {children}
    </AppStoreContext.Provider>
  );
}

export function useAppStore() {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error("useAppStore must be used inside AppStoreProvider");
  return store;
}

export function useProfile() {
  const { profile, setProfile } = useAppStore();
  return [profile, setProfile] as const;
}

/** Ongoing (not yet completed) drafts, most recently updated first. */
export function useOngoingDrafts() {
  const { drafts } = useAppStore();
  return drafts.filter((draft) => !draft.completed).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** useState-like access to one field of the draft currently being written. */
export function useDraftState<K extends keyof HandoverDraft>(key: K) {
  const { activeDraft, updateDraft } = useAppStore();
  if (!activeDraft) throw new Error("useDraftState requires an active draft");
  const id = activeDraft.id;
  const setValue = useCallback((next: SetStateAction<HandoverDraft[K]>) => {
    updateDraft(id, (draft) => {
      const value = typeof next === "function" ? (next as (previous: HandoverDraft[K]) => HandoverDraft[K])(draft[key]) : next;
      return value === draft[key] ? draft : { ...draft, [key]: value };
    });
  }, [id, key, updateDraft]);
  return [activeDraft[key], setValue] as const;
}
