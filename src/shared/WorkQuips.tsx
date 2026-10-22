// 분석·문서 생성을 기다리는 동안 보여 주는 귀여운 대기 문구. 금융결제원 직장인이 할 법한 행동이 하나 나타나고, 다음 것이 나오면 날아간다.
import { useEffect, useMemo, useState } from "react";

const QUIPS = [
  "결재선 확인하는 중 📋",
  "커피 한 잔 내리는 중 ☕",
  "엑셀 VLOOKUP 돌리는 중 📊",
  "전결 규정 뒤져 보는 중 📚",
  "회의록 초안 쓰는 중 📝",
  "금융인증서로 로그인하는 중 🔐",
  "오픈뱅킹 API 점검하는 중 🏦",
  "타행 이체 정산 대사하는 중 💸",
  "'확인 부탁드립니다' 쓰는 중 ✉️",
  "파일명 '최종_진짜최종_v3' 정리하는 중 📁",
  "PPT 정렬 1픽셀 맞추는 중 📐",
  "보고서 글꼴 맑은 고딕으로 통일하는 중 🔤",
  "스마트보안카드 번호 입력하는 중 💳",
  "구내식당 줄 서는 중 🍚",
  "계장님께 중간보고 드리는 중 🙇",
  "참조(CC)에 팀장님 넣는 중 📨",
  "CMS 출금 내역 맞춰 보는 중 🧾",
  "점심 메뉴 투표하는 중 🍜",
  "복사기 용지 채우는 중 🖨️",
  "야근 식대 영수증 붙이는 중 🧾",
  "퇴근까지 남은 시간 계산하는 중 🕕",
  "사내 메신저 '읽음' 확인하는 중 💬",
  "PC-OFF 유연근무 신청 중 🖥️",
  "탄천 걷는 중 🚶",
  "명동역 3번출구에서 나오는 중 🚇",
  "출근 도장 찍는 중 ⏰",
  "엘리베이터 기다리는 중 🛗",
  "사원증 목에 거는 중 🪪",
  "모니터 앞에서 멍 때리는 중 😶",
  "아이스 아메리카노 수혈하는 중 🧊",
  "회의실 예약하는 중 🗓️",
  "화상회의 음소거 푸는 중 🎤",
  "'제 화면 보이시나요?' 하는 중 🖥️",
  "결재 반려 사유 읽는 중 📑",
  "오탈자 한 번 더 확인하는 중 🔍",
  "보고서 목차 번호 맞추는 중 🔢",
  "엑셀 셀 병합 풀어 주는 중 🧮",
  "피벗 테이블 돌리는 중 📈",
  "매크로 오류 달래는 중 🤖",
  "이체 한도 확인하는 중 💰",
  "어음교환 마감 기다리는 중 ⏳",
  "전자금융 점검 공지 쓰는 중 📢",
  "장애 대응 메신저방 만드는 중 🚨",
  "로그 한 줄씩 뒤져 보는 중 🔎",
  "배포 전 체크리스트 확인하는 중 ✅",
  "테스트 서버에 먼저 올려 보는 중 🧪",
  "보안 점검 문서 서명받는 중 ✍️",
  "망분리 PC로 갈아타는 중 🔌",
  "비밀번호 만료일 갱신하는 중 🔑",
  "회식 장소 정하는 중 🍻",
  "줄 짧은 식당 찾아 헤매는 중 🏃",
  "커피 내기 가위바위보 하는 중 ✌️",
  "탕비실 간식 서랍 열어 보는 중 🍪",
  "안마의자 대기 줄 서는 중 💆",
  "화분에 물 주는 중 🪴",
  "책상 정리정돈 하는 중 🗂️",
  "포스트잇에 할 일 적는 중 📌",
  "다이어리에 일정 옮겨 적는 중 📔",
  "캘린더 알림 미루는 중 🔔",
  "안 읽은 메일 세어 보는 중 📬",
  "자동 회신 설정하는 중 📭",
  "울리는 전화 당겨 받는 중 ☎️",
  "팀장님 눈치 살피는 중 👀",
  "연차 사용 계획서 쓰는 중 🏖️",
  "교육 이수 시간 채우는 중 🎓",
  "사내 게시판 공지 확인하는 중 📣",
  "복지포인트 쓸 곳 찾는 중 🎁",
  "퇴근길 지하철 시간 보는 중 🚉",
  "점심 먹고 산책 다녀오는 중 🌳",
  "비 오는데 우산 챙기는 중 ☔",
  "법인카드 영수증 모으는 중 💳",
  "출장비 정산 올리는 중 ✈️",
  "인수인계서 한 번 더 읽는 중 📖",
  "마감 5분 전 저장하는 중 💾",
  "거의 다 됐어요, 조금만요 🙏",
];

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// 하얀 몽글이(파란 모자). 문구 옆에서 콩콩 뛴다.
function Mascot() {
  return (
    <svg className="quip-mascot" viewBox="0 0 44 44" aria-hidden="true">
      <ellipse cx="22" cy="27" rx="15" ry="13.5" fill="#fff" stroke="#cfc8e0" strokeWidth="2" />
      <path d="M8.5 22 Q22 3 35.5 22 Z" fill="#5b72df" />
      <rect x="5" y="20" width="22" height="3.4" rx="1.7" fill="#4a60c8" />
      <circle cx="17" cy="28" r="1.9" fill="#3b3442" />
      <circle cx="27" cy="28" r="1.9" fill="#3b3442" />
      <ellipse cx="12.6" cy="32" rx="2.4" ry="1.5" fill="#ffb8c6" />
      <ellipse cx="31.4" cy="32" rx="2.4" ry="1.5" fill="#ffb8c6" />
      <path d="M19.6 32 Q22 34.6 24.4 32" stroke="#3b3442" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function WorkQuips({ intervalMs = 2600 }: { intervalMs?: number }) {
  const order = useMemo(() => shuffled(QUIPS), []);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStep((current) => current + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  const current = order[step % order.length];
  const previous = step > 0 ? order[(step - 1) % order.length] : null;
  return (
    <div className="quips" role="status" aria-live="polite">
      {previous && (
        <span key={`out-${step}`} className="quip quip-out" aria-hidden="true">
          <Mascot />{previous}
        </span>
      )}
      <span key={`in-${step}`} className="quip quip-in">
        <Mascot />{current}
      </span>
    </div>
  );
}

// 서버가 퍼센트를 주지 않는 대기(문서 생성)용 추정치. 처음엔 빠르고 점점 느려져 94%에서 멈추고, 끝나면 100%가 된다.
export function useEstimatedProgress(running: boolean, done: boolean): number {
  const [percent, setPercent] = useState(6);
  useEffect(() => {
    if (done) {
      setPercent(100);
      return;
    }
    if (!running) return;
    const timer = window.setInterval(() => setPercent((current) => current + (94 - current) * 0.06), 500);
    return () => window.clearInterval(timer);
  }, [running, done]);
  return Math.round(percent);
}
