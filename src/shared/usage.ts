import type { UsageTotal } from "./types";

// 예산이 설정돼 있고 80% 이상 썼을 때만 안내문을 돌려준다(평소에는 null → 화면에 아무것도 나오지 않는다).
export function budgetNotice(total: UsageTotal | null): { message: string; tone: "info" | "error" } | null {
  if (!total || total.budget_usd <= 0) return null;
  if (total.cost_usd >= total.budget_usd) {
    return { message: "Claude API 예산을 모두 사용해서 새 AI 작업이 막혀 있어요. 관리자에게 예산 증액을 요청해 주세요.", tone: "error" };
  }
  if (total.cost_usd >= total.budget_usd * 0.8) {
    const remaining = total.remaining_usd ?? Math.max(total.budget_usd - total.cost_usd, 0);
    return { message: `Claude API 예산의 ${Math.floor((total.cost_usd / total.budget_usd) * 100)}%를 사용했어요. 남은 금액은 약 $${remaining.toFixed(2)}예요.`, tone: "info" };
  }
  return null;
}
