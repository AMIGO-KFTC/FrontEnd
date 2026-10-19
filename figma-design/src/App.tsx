import { useState } from "react";
import AdminDashboardScreen from "@/screens/admin/AdminDashboardScreen";
import ForgotPasswordScreen from "@/screens/auth/ForgotPasswordScreen";
import LoginScreen from "@/screens/auth/LoginScreen";
import SignupScreen from "@/screens/auth/SignupScreen";
import CompletionScreen from "@/screens/handover/CompletionScreen";
import FinalDocumentScreen from "@/screens/handover/FinalDocumentScreen";
import GeneratingDocumentScreen from "@/screens/handover/GeneratingDocumentScreen";
import HandoverTypeScreen from "@/screens/handover/HandoverTypeScreen";
import ProcessingScreen from "@/screens/handover/ProcessingScreen";
import QuestionScreen from "@/screens/handover/QuestionScreen";
import StartScreen from "@/screens/handover/StartScreen";
import { type StartData, type HandoverVariant } from "@/screens/handover/types";
import UploadStepScreen from "@/screens/handover/UploadStepScreen";
import CompletedDocumentsScreen from "@/screens/home/CompletedDocumentsScreen";
import DashboardScreen from "@/screens/home/DashboardScreen";
import OngoingHandoverScreen from "@/screens/home/OngoingHandoverScreen";
import ReceivedHandoverScreen from "@/screens/home/ReceivedHandoverScreen";
import LandingScreen from "@/screens/LandingScreen";
import Workspace from "@/screens/legacy-workspace/Workspace";
import AppStoreProvider, { type HandoverStep, useAppStore } from "@/store/AppStore";

type Screen = "landing" | "login" | "signup" | "forgot" | "dashboard" | "admin" | "handoverType" | "handover" | "documents" | "received" | HandoverStep | "workspace";

const handoverSteps: Screen[] = ["start", "upload", "processing", "question", "generating", "document", "complete"];
const emptyStartData: StartData = { name: "", division: "", team: "", role: "", task: "", date: "" };

export default function App() {
  return (
    <AppStoreProvider>
      <AppScreens />
    </AppStoreProvider>
  );
}

function AppScreens() {
  const [screen, setScreen] = useState<Screen>("login");
  const { drafts, activeDraft, setActiveDraftId, createDraft, updateDraft } = useAppStore();
  const data = activeDraft?.startData ?? emptyStartData;
  const handoverVariant: HandoverVariant = activeDraft?.variant ?? "personnel";

  // Move to a handover step and remember it on the draft so "이어서 작성" can resume there.
  const goToStep = (step: HandoverStep, draftId = activeDraft?.id) => {
    if (draftId !== undefined) {
      updateDraft(draftId, (draft) => {
        const completed = draft.completed || step === "complete";
        return draft.step === step && draft.completed === completed ? draft : { ...draft, step, completed };
      });
    }
    setScreen(step);
  };
  const startNewDraft = (variant: HandoverVariant) => goToStep("start", createDraft(variant));
  const continueDraft = (id: number) => {
    const draft = drafts.find((item) => item.id === id);
    if (!draft) return;
    setActiveDraftId(id);
    setScreen(draft.step);
  };

  const dashboard = <DashboardScreen onNew={() => setScreen("handoverType")} onLogout={() => setScreen("login")} onHandover={() => setScreen("handover")} onDocuments={() => setScreen("documents")} onReceived={() => setScreen("received")} onAdmin={() => setScreen("admin")} />;

  if (screen === "landing") return <LandingScreen onBegin={() => setScreen("login")} onLogin={() => setScreen("login")} />;
  if (screen === "login") return <LoginScreen onLogin={() => setScreen("dashboard")} onSignup={() => setScreen("signup")} onForgot={() => setScreen("forgot")} />;
  if (screen === "signup") return <><LoginScreen onLogin={() => setScreen("dashboard")} onSignup={() => {}} onForgot={() => setScreen("forgot")} /><SignupScreen onBack={() => setScreen("login")} /></>;
  if (screen === "forgot") return <><LoginScreen onLogin={() => setScreen("dashboard")} onSignup={() => setScreen("signup")} onForgot={() => {}} /><ForgotPasswordScreen onBack={() => setScreen("login")} /></>;
  if (screen === "dashboard") return dashboard;
  if (screen === "admin") return <AdminDashboardScreen onExit={() => setScreen("dashboard")} />;
  if (screen === "handoverType") return <HandoverTypeScreen onSelect={startNewDraft} onLogout={() => setScreen("login")} onHome={() => setScreen("dashboard")} />;
  if (screen === "handover") return <OngoingHandoverScreen onHome={() => setScreen("dashboard")} onNew={() => setScreen("handoverType")} onContinue={continueDraft} onDocuments={() => setScreen("documents")} onReceived={() => setScreen("received")} onLogout={() => setScreen("login")} />;
  if (screen === "documents") return <CompletedDocumentsScreen onHome={() => setScreen("dashboard")} onHandover={() => setScreen("handover")} onReceived={() => setScreen("received")} onLogout={() => setScreen("login")} />;
  if (screen === "received") return <ReceivedHandoverScreen onHome={() => setScreen("dashboard")} onHandover={() => setScreen("handover")} onDocuments={() => setScreen("documents")} onLogout={() => setScreen("login")} />;
  // Handover step screens need a draft to read and write; fall back to home if it was removed.
  if (handoverSteps.includes(screen) && !activeDraft) return dashboard;
  if (screen === "start") return <StartScreen onStart={() => goToStep("upload")} onLogout={() => setScreen("login")} onHome={() => setScreen("dashboard")} variant={handoverVariant} />;
  if (screen === "upload") return <UploadStepScreen onBack={() => goToStep("start")} onNext={() => goToStep("processing")} onLogout={() => setScreen("login")} onHome={() => setScreen("dashboard")} variant={handoverVariant} />;
  if (screen === "processing") return <ProcessingScreen onNext={() => goToStep("question")} onLogout={() => setScreen("login")} onHome={() => setScreen("dashboard")} variant={handoverVariant} />;
  if (screen === "question") return <QuestionScreen onBack={() => goToStep("processing")} onComplete={() => goToStep("generating")} onLogout={() => setScreen("login")} onHome={() => setScreen("dashboard")} variant={handoverVariant} />;
  if (screen === "generating") return <GeneratingDocumentScreen onComplete={() => goToStep("document")} onLogout={() => setScreen("login")} onHome={() => setScreen("dashboard")} variant={handoverVariant} />;
  if (screen === "document") return <FinalDocumentScreen data={data} onBack={() => goToStep("question")} onComplete={() => goToStep("complete")} onLogout={() => setScreen("login")} onHome={() => setScreen("dashboard")} variant={handoverVariant} />;
  if (screen === "complete") return <CompletionScreen onViewDocument={() => goToStep("document")} onNew={() => startNewDraft(handoverVariant)} onHome={() => setScreen("dashboard")} variant={handoverVariant} />;
  return <Workspace data={data} onLogout={() => setScreen("login")} />;
}
