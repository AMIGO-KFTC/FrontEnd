// 아직 BackEnd 에 없는 기능(회원가입·비밀번호 재설정)임을 화면 위쪽에 알린다. 모양은 index.css 의 .auth-pending-note.
import { Icon } from "@/shared/Icon";

export function PendingNote({ children }: { children: string }) {
  return (
    <div className="auth-pending-note" role="status">
      <Icon name="sparkle" size={14} />
      <span><strong>준비 중</strong> · {children}</span>
    </div>
  );
}
