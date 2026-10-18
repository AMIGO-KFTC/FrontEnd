import type { ReactNode } from "react";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 검색어(여러 개)가 들어간 자리를 <mark> 로 감싼다. 대소문자는 구분하지 않는다.
export function highlight(text: string, terms: string[]): ReactNode {
  const words = terms.map((t) => t.trim()).filter(Boolean);
  if (!words.length || !text) return text;
  const pattern = new RegExp(`(${words.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, index) => (index % 2 === 1 ? <mark key={index}>{part}</mark> : part));
}

// "2026-10-16 17:50" → "10/16 17:50", "2026-10-16" → "2026.10.16"
export function shortDate(value: string): string {
  if (!value) return "";
  if (value.length <= 10) return value.replace(/-/g, ".");
  const [date, time] = value.split(" ");
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)} ${time ?? ""}`.trim();
}
