import { useState } from "react";
import { CompletionScreen } from "./screens/CompletionScreen";
import { FinalDocumentScreen } from "./screens/FinalDocumentScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { ProcessingScreen } from "./screens/ProcessingScreen";
import { QuestionScreen } from "./screens/QuestionScreen";
import { StartScreen } from "./screens/StartScreen";
import { UploadStepScreen } from "./screens/UploadStepScreen";
import type { StartData } from "./shared/handover";

type Screen = "login" | "start" | "upload" | "processing" | "question" | "document" | "complete";

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [data, setData] = useState<StartData>({ name: "", division: "", team: "", role: "", task: "", date: "" });
  if (screen === "login") return <LoginScreen onLogin={() => setScreen("start")} />;
  if (screen === "start") return <StartScreen onStart={(formData) => { setData(formData); setScreen("upload"); }} />;
  if (screen === "upload") return <UploadStepScreen onBack={() => setScreen("start")} onNext={() => setScreen("processing")} />;
  if (screen === "processing") return <ProcessingScreen onNext={() => setScreen("question")} />;
  if (screen === "question") return <QuestionScreen onBack={() => setScreen("processing")} onComplete={() => setScreen("document")} />;
  if (screen === "document") return <FinalDocumentScreen data={data} onBack={() => setScreen("question")} onComplete={() => setScreen("complete")} />;
  return <CompletionScreen onViewDocument={() => setScreen("document")} onNew={() => setScreen("start")} />;
}
