import type { HandoverMode, HandoverUnit } from "./types";

// units 는 단위업무와 세부업무(정기·비정기). task 는 그걸 읽기 쉬운 여러 줄 글로 풀어 둔 것(서버의 duties)이다.
// plans·issues 는 팀장(관리자) 인사발령에서만 쓴다: 고른 주요 사업계획과 그중 주요 현안사항이 있는 사업계획(직접 더한 현안 포함).
// successorLoginId 는 인수자가 이 시스템 계정일 때 그 아이디(선택). 적으면 그 계정의 '받은 인수인계'에 나타난다.
export type StartData = { mode: HandoverMode; name: string; division: string; team: string; role: string; task: string; date: string; successor: string; successorLoginId: string; leaveStart: string; leaveEnd: string; units: HandoverUnit[]; plans: string[]; issues: string[] };

// 세부업무를 하나도 안 적으면 단위업무 이름 자체를 정기 업무(세부업무)로 넣는 단위업무. 이 업무는 따로 나눌 세부업무가 없어서
// 비워 두면 정기업무 장에 아무것도 안 나왔다. (인사발령만. 다른 단위업무까지 늘리려면 여기에 이름을 더한다.)
export const AUTO_REGULAR_UNITS = ["규정/규약 심사"];
export const isAutoRegularUnit = (name: string) => AUTO_REGULAR_UNITS.includes(name.trim());

export function withAutoRegular(units: HandoverUnit[]): HandoverUnit[] {
  return units.map((unit) => (isAutoRegularUnit(unit.name) && !unit.regular.length && !unit.irregular.length ? { ...unit, regular: [unit.name.trim()] } : unit));
}

// 서버에 보낼 duties(읽기 쉬운 담당 업무 글). 인사발령은 "단위업무 — 정기: A, B / 비정기: C" 한 줄씩, 장기휴가는 "정기: … / 비정기: …".
export function dutiesText(units: HandoverUnit[]): string {
  return units
    .map((unit) => {
      const parts = [unit.regular.length ? `정기: ${unit.regular.join(", ")}` : "", unit.irregular.length ? `비정기: ${unit.irregular.join(", ")}` : ""].filter(Boolean).join(" / ");
      return unit.name ? (parts ? `${unit.name} — ${parts}` : unit.name) : parts;
    })
    .filter(Boolean)
    .join("\n");
}

// 서버에 보낼 단위 업무명. 인사발령은 고른 단위업무를 ", " 로 잇고, 장기휴가는 첫 세부업무를 쓴다.
export function unitTaskName(mode: HandoverMode, units: HandoverUnit[]): string {
  if (mode === "leave") return units.flatMap((unit) => [...unit.regular, ...unit.irregular])[0] ?? "";
  return units.map((unit) => unit.name).filter(Boolean).join(", ");
}
