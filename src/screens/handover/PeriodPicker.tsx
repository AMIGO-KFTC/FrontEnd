// 수행 시기 질문의 답 고르기: 정기 업무면 주기(매일·매주·매월·매년) 중 하나를 고르고,
// 정기적으로 하지 않는 업무면 달력에서 수행 기간(시작일 ~ 종료일)을 고른다. 고른 값은 답변 글로 보낸다('매월', '2026-03-02 ~ 2026-05-29').
import { useState } from "react";
import { Icon } from "@/shared/Icon";

type Props = {
  choices: string[];
  disabled: boolean;
  onPick: (value: string) => void;
};

export function PeriodPicker({ choices, disabled, onPick }: Props) {
  const [calendar, setCalendar] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const invalid = Boolean(start && end && end < start);
  return (
    <div className="period-picker">
      <div className="period-choices" role="group" aria-label="수행 주기">
        {choices.map((choice) => (
          <button key={choice} type="button" disabled={disabled} onClick={() => onPick(choice)}>{choice}</button>
        ))}
        <button type="button" className={calendar ? "active" : ""} disabled={disabled} aria-expanded={calendar} onClick={() => setCalendar((open) => !open)}>
          <Icon name="clock" size={15} /> 정기적이지 않아요 · 기간 선택
        </button>
      </div>
      {calendar && (
        <div className="period-range">
          <label>
            <span>시작일</span>
            <input type="date" value={start} max={end || undefined} onChange={(event) => setStart(event.target.value)} />
          </label>
          <span className="period-range-sep">~</span>
          <label>
            <span>종료일</span>
            <input type="date" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} />
          </label>
          <button type="button" className="answer-send" disabled={disabled || !start || !end || invalid} onClick={() => onPick(`${start} ~ ${end}`)}>
            이 기간으로 답하기 <Icon name="arrow" size={16} />
          </button>
          {invalid && <small className="period-range-error">종료일은 시작일보다 빠를 수 없어요.</small>}
        </div>
      )}
    </div>
  );
}
