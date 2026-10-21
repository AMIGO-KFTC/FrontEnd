import type { HandoverMode } from "./types";

// successorLoginId 는 인수자가 이 시스템 계정일 때 그 아이디(선택). 적으면 그 계정의 '받은 인수인계'에 나타난다.
export type StartData = { mode: HandoverMode; name: string; division: string; team: string; role: string; task: string; date: string; successor: string; successorLoginId: string };
