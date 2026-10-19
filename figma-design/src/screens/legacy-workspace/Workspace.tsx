import { useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import Icon from "@/components/Icon";
import { type StartData } from "@/screens/handover/types";
import ChatPanel from "@/screens/legacy-workspace/ChatPanel";
import DocumentViewer from "@/screens/legacy-workspace/DocumentViewer";
import SlotBoard from "@/screens/legacy-workspace/SlotBoard";
import StageProgress from "@/screens/legacy-workspace/StageProgress";
import UploadPanel from "@/screens/legacy-workspace/UploadPanel";

export default function Workspace({ data, onLogout }: { data: StartData; onLogout: () => void }) {
  const [stage, setStage] = useState(1);
  const [documentMode, setDocumentMode] = useState(false);
  const generate = () => { setStage(4); setDocumentMode(true); };
  return (
    <div className="app-shell workspace">
      <AppSidebar active={documentMode ? "documents" : "handover"} onLogout={onLogout} />
      <div className="workspace-main">
        <header className="workspace-header">
          <div className="project-name"><span /><div><strong>{data.task.split("\n")[0] || "업무"} 외 인수인계</strong><small>{data.name} · {data.team}</small></div><Icon name="chevron" size={14} /></div>
          <div className="header-actions"><span className="saved"><Icon name="check" size={13} /> 자동 저장됨</span><button className="help-button">?</button><button className="share-button">공유</button></div>
        </header>
        <StageProgress stage={stage} />
        {documentMode ? <DocumentViewer onBack={() => { setDocumentMode(false); setStage(3); }} /> : (
          <main className="workspace-grid">
            <UploadPanel onAnalyze={() => setStage(2)} />
            <ChatPanel onGenerate={generate} />
            <SlotBoard />
          </main>
        )}
      </div>
    </div>
  );
}
