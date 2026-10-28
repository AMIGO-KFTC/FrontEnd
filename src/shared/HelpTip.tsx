import type { ReactNode } from "react";

// 라벨 옆 (?) 아이콘. 마우스를 올리거나(hover) 키보드로 포커스하면 설명 말풍선이 뜬다.
// 라벨(<label>) 안에 넣어도 입력칸으로 포커스가 넘어가지 않도록 button 대신 span 을 쓴다.
export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="help-tip" tabIndex={0} role="note" aria-label={`${label} 설명`}>
      <span className="help-tip-mark" aria-hidden="true">?</span>
      <span className="help-tip-pop" role="tooltip">{children}</span>
    </span>
  );
}
