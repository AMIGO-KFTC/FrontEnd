// Claude API 사용량 표시: 작업 화면 머리글의 배지와 시작 화면의 누적 사용량 줄.
// 비용은 모델 단가로 계산한 추정치이며, 실제 청구액은 Anthropic Console 에서 확인한다.
import { Coins } from "lucide-react";
import type { Usage, UsageTotal } from "../../shared/types";

export function formatUsd(value: number): string {
  return value < 0.01 && value > 0 ? "<$0.01" : `$${value.toFixed(2)}`;
}

export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function tokenCount(u: Usage): number {
  return u.input_tokens + u.output_tokens + u.cache_read_tokens + u.cache_write_tokens;
}

function budgetState(total: UsageTotal | null): "ok" | "warn" | "over" {
  if (!total || total.budget_usd <= 0) return "ok";
  if (total.cost_usd >= total.budget_usd) return "over";
  return total.cost_usd >= total.budget_usd * 0.8 ? "warn" : "ok";
}

export function UsageBadge({ usage, total }: { usage: Usage; total: UsageTotal | null }) {
  const detail = [
    `이번 작업: Claude 요청 ${usage.requests}회`,
    `입력 ${usage.input_tokens.toLocaleString()} · 출력 ${usage.output_tokens.toLocaleString()} 토큰`,
    `캐시 읽기 ${usage.cache_read_tokens.toLocaleString()} · 캐시 쓰기 ${usage.cache_write_tokens.toLocaleString()} 토큰`,
    `추정 비용 ${formatUsd(usage.cost_usd)}`,
  ];
  if (total) {
    detail.push(`전체 ${total.sessions}개 작업 누적 ${formatUsd(total.cost_usd)}`);
    if (total.budget_usd > 0) detail.push(`예산 ${formatUsd(total.budget_usd)} · 남은 금액 ${formatUsd(total.remaining_usd ?? 0)}`);
  }
  return (
    <span className={`usage-badge ${budgetState(total)}`} title={detail.join("\n")}>
      <Coins size={14} />
      {formatUsd(usage.cost_usd)} · {formatTokens(tokenCount(usage))} 토큰
      {total && total.budget_usd > 0 && (
        <span className="usage-budget">
          {" "}
          · 예산 {formatUsd(total.cost_usd)}/{formatUsd(total.budget_usd)}
        </span>
      )}
    </span>
  );
}

export function UsageSummary({ total }: { total: UsageTotal }) {
  if (total.requests === 0 && total.budget_usd <= 0) return null;
  const state = budgetState(total);
  return (
    <p className={`usage-summary ${state}`}>
      <Coins size={14} /> Claude API 누적 사용량 <strong>{formatUsd(total.cost_usd)}</strong> (요청 {total.requests}회 ·{" "}
      {formatTokens(tokenCount(total))} 토큰)
      {total.budget_usd > 0 && (
        <>
          {" "}
          · 예산 {formatUsd(total.budget_usd)} 중 남은 금액 <strong>{formatUsd(total.remaining_usd ?? 0)}</strong>
        </>
      )}
      {state === "over" && " · 예산을 모두 써서 새 AI 작업이 막혀 있어요."}
    </p>
  );
}
