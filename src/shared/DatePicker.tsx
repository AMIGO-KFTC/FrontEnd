// 날짜 고르기(YYYY-MM-DD). 브라우저 기본 <input type="date"> 대신 쓰는, 앱 디자인에 맞춘 달력 팝업.
//   - 눌러서 달력을 열고 날짜를 고르면 바로 닫힌다. 달 이동(‹ ›), 오늘로 가기, (clearable 이면) 지우기.
//   - min · max 밖의 날짜는 누를 수 없다. Esc · 바깥 클릭으로 닫는다.
//   - 팝업은 document.body 로 꺼내 그려서 모달·장기휴가 테마의 쌓임 맥락(z-index)에 가려지거나 잘리지 않는다.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/shared/Icon";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const POPOVER_WIDTH = 292;

const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function fromKey(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) || toKey(d) !== value ? null : d;
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  openMonth?: string; // 아직 고른 날짜가 없을 때 달력이 열릴 달(예: 종료일은 시작일의 달부터)
  clearable?: boolean; // 값을 비울 수 있으면 팝업에 '지우기'가 보인다
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function DatePicker({ value, onChange, min, max, openMonth, placeholder = "날짜 선택", clearable = false, disabled = false, ariaLabel, className = "" }: Props) {
  const selected = fromKey(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => new Date((selected ?? new Date()).getFullYear(), (selected ?? new Date()).getMonth(), 1)); // 보고 있는 달의 1일
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const todayKey = toKey(new Date());

  // 열 때마다 고른 날짜의 달(없으면 openMonth, 그것도 없으면 이번 달)부터 보여 준다
  const openPicker = () => {
    const base = selected ?? (openMonth ? fromKey(openMonth) : null) ?? new Date();
    setView(new Date(base.getFullYear(), base.getMonth(), 1));
    setOpen(true);
  };
  const close = (focusTrigger = false) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };

  // 팝업 위치: 버튼 아래(자리가 없으면 위)에 두고, 화면 가장자리에서는 안쪽으로 당긴다. 스크롤·창 크기가 바뀌면 다시 계산한다.
  const place = () => {
    const trigger = triggerRef.current;
    const pop = popRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const height = pop?.offsetHeight ?? 340;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8));
    const below = rect.bottom + 6;
    const top = below + height > window.innerHeight - 8 && rect.top - height - 6 > 8 ? rect.top - height - 6 : below;
    setPos({ top, left });
  };
  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!popRef.current?.contains(target) && !triggerRef.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const inRange = (key: string) => (!min || key >= min) && (!max || key <= max);
  const pick = (key: string) => {
    if (!inRange(key)) return;
    onChange(key);
    close(true);
  };

  // 그 달 달력(일요일 시작, 6줄 고정)
  const first = view.getDay();
  const days = Array.from({ length: 42 }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i - first + 1));
  const shiftMonth = (offset: number) => setView(new Date(view.getFullYear(), view.getMonth() + offset, 1));

  const label = selected ? `${selected.getFullYear()}. ${selected.getMonth() + 1}. ${selected.getDate()}. (${WEEKDAYS[selected.getDay()]})` : placeholder;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`date-picker-trigger${selected ? "" : " empty"}${open ? " open" : ""} ${className}`.trim()}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}${selected ? ` ${label}` : ""}` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openPicker())}
      >
        <Icon name="calendar" size={15} />
        <span>{label}</span>
        <Icon name="chevron" size={14} />
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            className="date-picker-popover"
            role="dialog"
            aria-label={`${ariaLabel ?? "날짜"} 고르기`}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: POPOVER_WIDTH, visibility: pos ? "visible" : "hidden" }}
            // 포털 안의 이벤트도 React 트리를 타고 올라가므로(모달 바깥 클릭으로 닫히는 등) 여기서 막는다
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <button type="button" className="prev" onClick={() => shiftMonth(-1)} aria-label="이전 달"><Icon name="chevron" size={15} /></button>
              <strong>{view.getFullYear()}년 {view.getMonth() + 1}월</strong>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="다음 달"><Icon name="chevron" size={15} /></button>
            </header>
            <div className="date-picker-weekdays">{WEEKDAYS.map((day, i) => <span key={day} className={i === 0 ? "sun" : i === 6 ? "sat" : ""}>{day}</span>)}</div>
            <div className="date-picker-grid" role="grid">
              {days.map((day) => {
                const key = toKey(day);
                const other = day.getMonth() !== view.getMonth();
                const cls = [other ? "other" : "", key === value ? "selected" : "", key === todayKey ? "today" : "", day.getDay() === 0 ? "sun" : day.getDay() === 6 ? "sat" : ""].filter(Boolean).join(" ");
                return (
                  <button key={key} type="button" className={cls} disabled={!inRange(key)} aria-pressed={key === value} aria-label={`${day.getFullYear()}년 ${day.getMonth() + 1}월 ${day.getDate()}일`} onClick={() => pick(key)}>
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            <footer>
              <button type="button" onClick={() => pick(todayKey)} disabled={!inRange(todayKey)}>오늘</button>
              {clearable && value && <button type="button" className="clear" onClick={() => { onChange(""); close(true); }}>지우기</button>}
            </footer>
          </div>,
          document.body,
        )}
    </>
  );
}
