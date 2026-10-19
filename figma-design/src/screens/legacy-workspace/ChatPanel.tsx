import { useState } from "react";
import Icon from "@/components/Icon";

type Message = { from: "ai" | "me"; text: string; label?: string };

export default function ChatPanel({ onGenerate }: { onGenerate: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { from: "ai", label: "자료 분석 완료", text: "등록하신 3개 자료에서 주요 업무 12개와 확인이 필요한 항목 4개를 찾았어요." },
    { from: "ai", text: "매주 월요일 진행하는 ‘운영 지표 리뷰’의 참석자와 공유 채널을 확인해 주세요." },
    { from: "me", text: "플랫폼팀 전원이 참석하고, 결과는 #platform-weekly 채널에 공유해요." },
    { from: "ai", label: "확인 요청 · 2/4", text: "좋아요. 장애 발생 시 1차 담당자가 이지윤님으로 되어 있는데, 현재도 맞나요?" },
  ]);
  const [value, setValue] = useState("");
  const send = (text = value) => {
    if (!text.trim()) return;
    setMessages([...messages, { from: "me", text }]);
    setValue("");
  };
  return (
    <section className="chat-panel">
      <div className="chat-header"><div><span className="ai-avatar"><Icon name="sparkle" size={17} /></span><div><h2>이어봄 AI</h2><p><span /> 자료를 바탕으로 확인 중이에요</p></div></div><button><Icon name="more" /></button></div>
      <div className="chat-body">
        <div className="date-divider"><span>오늘</span></div>
        {messages.map((message, index) => (
          <div className={`message ${message.from}`} key={index}>
            {message.from === "ai" && <span className="tiny-avatar"><Icon name="sparkle" size={13} /></span>}
            <div>{message.label && <small className="message-label">{message.label}</small>}<p>{message.text}</p><time>{message.from === "me" ? "오후 2:34" : "오후 2:35"}</time></div>
          </div>
        ))}
        <div className="quick-replies">
          <button onClick={() => send("네, 맞아요.")}>네, 맞아요</button>
          <button onClick={() => send("이 질문은 건너뛸게요.")}>건너뛰기</button>
          <button className="accent-reply" onClick={onGenerate}><Icon name="file" size={14} /> 지금 문서 생성</button>
        </div>
        <div className="typing"><span /><span /><span /> AI가 다음 질문을 준비하고 있어요</div>
      </div>
      <div className="chat-compose">
        <button title="자료 첨부"><Icon name="paperclip" size={19} /></button>
        <textarea value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="답변을 입력하거나 추가 자료를 첨부하세요" />
        <button className="send-button" onClick={() => send()}><Icon name="send" size={17} /></button>
      </div>
    </section>
  );
}
