// AI 맞춤 설정(개발용 미리보기). 지침·톤·원칙은 화면에서 편집하고 이 브라우저(localStorage)에만 저장한다.
// BackEnd 에 팀 설정·프롬프트 API 가 없어 서버에 저장되지 않고, 실제 문서 생성에도 반영되지 않는다.
import { useRef, useState } from "react";
import { Icon } from "@/shared/Icon";

type Material = { name: string; type: "파일" | "링크" };
type AiSettings = { baseMaterials: Material[]; prompt: string; tone: string; rules: string[] };

const STORAGE_KEY = "amigo-admin-ai-settings";
const DEFAULT_SETTINGS: AiSettings = {
  baseMaterials: [
    { name: "플랫폼팀_업무운영가이드.pdf", type: "파일" },
    { name: "장애대응_프로세스_v2.docx", type: "파일" },
    { name: "플랫폼팀 Confluence", type: "링크" },
  ],
  prompt: `당신은 AMIGO 플랫폼팀의 인수인계 전문 AI입니다.

팀에서 사용하는 업무 용어와 운영 절차를 바탕으로 답변하고, 모든 안내는 실행 가능한 단계로 정리하세요.
근거 자료가 없는 내용은 추측하지 말고 추가 확인이 필요하다고 알려주세요.
인수인계 문서에서 담당자, 일정, 시스템 권한, 예외 대응 절차가 누락되지 않았는지 우선 확인하세요.`,
  tone: "명확하고 간결하게",
  rules: ["근거가 있는 내용만 답변", "실행 항목을 체크리스트로 정리", "사내 용어를 그대로 사용"],
};

function loadSettings(): AiSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AiSettings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function AdminAiSettingsPage() {
  const baseFileRef = useRef<HTMLInputElement>(null);
  const [initial] = useState(loadSettings);
  const [baseMaterials, setBaseMaterials] = useState<Material[]>(initial.baseMaterials);
  const [baseLink, setBaseLink] = useState("");
  const [prompt, setPrompt] = useState(initial.prompt);
  const [tone, setTone] = useState(initial.tone);
  const [rules, setRules] = useState(initial.rules);
  const [testMessage, setTestMessage] = useState("");
  const [testReply, setTestReply] = useState("플랫폼팀의 운영 맥락을 반영해 인수인계 내용을 검토할 준비가 되었어요.");
  const [saved, setSaved] = useState<"" | "browser" | "failed">("");
  const ruleOptions = ["근거가 있는 내용만 답변", "실행 항목을 체크리스트로 정리", "사내 용어를 그대로 사용", "모르는 내용은 추가 질문", "개인정보가 포함된 답변 제한"];
  const addBaseFiles = (files: FileList | null) => {
    if (!files?.length) return;
    // 파일 이름만 기록한다. 서버에 올릴 API 가 없어 내용은 어디에도 저장되지 않는다.
    setBaseMaterials((current) => [...current, ...Array.from(files).map((file): Material => ({ name: file.name, type: "파일" }))]);
    setSaved("");
  };
  const addBaseLink = () => {
    const nextLink = baseLink.trim();
    if (!nextLink) return;
    setBaseMaterials((current) => [...current, { name: nextLink, type: "링크" }]);
    setBaseLink("");
    setSaved("");
  };
  // 이 브라우저에만 저장한다. 서버 API 가 없어 다른 PC·다른 사용자에게는 적용되지 않는다.
  const saveToBrowser = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ baseMaterials, prompt, tone, rules } satisfies AiSettings));
      setSaved("browser");
    } catch {
      setSaved("failed");
    }
  };
  const sendTest = () => {
    if (!testMessage.trim()) return;
    setTestReply(`“${testMessage.trim()}” 요청을 플랫폼팀 기준으로 검토했습니다. 담당자와 완료 기준, 예외 상황 대응 절차를 함께 명시하면 더 명확한 인수인계가 됩니다.`);
    setTestMessage("");
  };

  return (
    <div className="admin-ai-page">
      <section className="members-page-title">
        <div><span><Icon name="sparkle" size={13} /> TEAM AI CONFIGURATION</span><h1>AI 맞춤 설정</h1><p>팀의 업무 방식과 용어를 이해하는 전용 AI를 직접 설정합니다.</p></div>
        <div className="ai-settings-status"><i /><span>개발용 미리보기 · 이 브라우저에만 저장</span></div>
      </section>
      <div className="ai-settings-layout">
        <div className="ai-settings-form">
          <section className="ai-settings-card">
            <header><span><Icon name="folder" size={16} /></span><div><small>KNOWLEDGE BASE</small><h2>AI 기본 자료</h2><p>팀 전용 AI가 답변할 때 우선 참고할 업무 자료를 등록하세요.</p></div></header>
            <div className="ai-base-materials">
              <input ref={baseFileRef} type="file" multiple onChange={(event) => addBaseFiles(event.target.files)} />
              <div className="ai-base-actions">
                <button onClick={() => baseFileRef.current?.click()}><Icon name="upload" size={15} /><span><strong>파일 등록</strong><small>PDF · Word · PPT · Excel</small></span></button>
                <div><Icon name="link" size={15} /><input value={baseLink} onChange={(event) => setBaseLink(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addBaseLink(); }} placeholder="Confluence 또는 업무 자료 링크" /><button onClick={addBaseLink}>추가</button></div>
              </div>
              <div className="ai-base-list">
                <div><strong>등록된 기본 자료</strong><span>{baseMaterials.length}개</span></div>
                {baseMaterials.map((material, index) => (
                  <div key={`${material.name}-${index}`}>
                    <span><Icon name={material.type === "파일" ? "file" : "link"} size={14} /></span>
                    <div><strong>{material.name}</strong><small>{material.type} · AI 답변 우선 참고</small></div>
                    <button onClick={() => { setBaseMaterials((current) => current.filter((_, materialIndex) => materialIndex !== index)); setSaved(""); }} aria-label={`${material.name} 삭제`}><Icon name="close" size={13} /></button>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="ai-settings-card prompt-card">
            <header><span><Icon name="message" size={16} /></span><div><small>SYSTEM PROMPT</small><h2>팀 전용 프롬프트</h2><p>AI가 항상 따라야 하는 역할과 판단 기준을 입력하세요.</p></div></header>
            <div className="system-prompt-editor">
              <div><span>시스템 지침</span><small>{prompt.length} / 2,000</small></div>
              <textarea value={prompt} maxLength={2000} onChange={(event) => { setPrompt(event.target.value); setSaved(""); }} />
              <footer><span><Icon name="shield" size={12} /> 서버에 지침 API 가 아직 없어 실제 문서 생성에는 반영되지 않습니다.</span></footer>
            </div>
          </section>
          <section className="ai-settings-card guide-card">
            <header><span><Icon name="check" size={16} /></span><div><small>RESPONSE GUIDE</small><h2>응답 방식</h2><p>팀에 맞는 말투와 답변 원칙을 선택하세요.</p></div></header>
            <div className="ai-tone-settings">
              <strong>기본 응답 톤</strong>
              <div>{["명확하고 간결하게", "친절하고 자세하게", "전문적이고 공식적으로"].map((item) => <button className={tone === item ? "active" : ""} key={item} onClick={() => { setTone(item); setSaved(""); }}>{item}</button>)}</div>
            </div>
            <div className="ai-rule-settings">
              <strong>필수 응답 원칙</strong>
              <div>{ruleOptions.map((rule) => <label key={rule}><input type="checkbox" checked={rules.includes(rule)} onChange={() => { setRules((current) => current.includes(rule) ? current.filter((item) => item !== rule) : [...current, rule]); setSaved(""); }} /><span><Icon name="check" size={11} /></span>{rule}</label>)}</div>
            </div>
          </section>
          <div className="ai-settings-save">
            <div>
              {saved === "browser" && <><Icon name="check" size={14} /><span>이 브라우저에 저장됐어요. 서버에는 저장되지 않아 문서 생성에 반영되지 않습니다.</span></>}
              {saved === "failed" && <span>브라우저 저장소를 쓸 수 없어 저장하지 못했어요.</span>}
              {saved === "" && <span>저장해도 이 브라우저에만 남고, 서버·문서 생성에는 반영되지 않습니다.</span>}
            </div>
            <button onClick={saveToBrowser}><Icon name="check" size={14} /> 이 브라우저에 저장</button>
          </div>
        </div>
        <aside className="ai-preview-panel">
          <header><div><span>LIVE PREVIEW</span><h2>AI 응답 미리보기</h2></div><em>예시 응답</em></header>
          <div className="ai-preview-profile">
            <span><Icon name="sparkle" size={21} /></span>
            <div><strong>플랫폼팀 업무 도우미</strong><small>플랫폼팀 전용 AI</small></div>
          </div>
          <div className="ai-preview-context"><small>현재 적용 중인 설정</small><p>{tone}</p><div>{rules.slice(0, 3).map((rule) => <span key={rule}>{rule}</span>)}</div></div>
          <div className="ai-preview-chat">
            <div className="ai-preview-message"><span><Icon name="sparkle" size={13} /></span><p>{testReply}</p></div>
          </div>
          <div className="ai-preview-compose">
            <textarea value={testMessage} onChange={(event) => setTestMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendTest(); } }} placeholder="AI에게 테스트 질문을 입력하세요." />
            <button onClick={sendTest} aria-label="테스트 질문 전송"><Icon name="send" size={14} /></button>
          </div>
          <p className="ai-preview-note"><Icon name="shield" size={12} /> 답변은 실제 AI 가 아닌 정해진 문장이며, 질문과 답변은 저장되지 않습니다.</p>
        </aside>
      </div>
    </div>
  );
}
