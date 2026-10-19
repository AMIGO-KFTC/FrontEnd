// 확인 창(로그아웃·삭제). 모양은 index.css 의 .logout-overlay / .logout-modal 을 함께 쓴다.
import { Icon, type IconName } from "@/shared/Icon";

type Props = {
  icon?: IconName;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({ icon = "user", title, description, confirmLabel, busy = false, onCancel, onConfirm }: Props) {
  return (
    <div className="logout-overlay" role="presentation" onClick={onCancel}>
      <section className="logout-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(event) => event.stopPropagation()}>
        <span><Icon name={icon} size={22} /></span>
        <h2 id="confirm-title">{title}</h2>
        <p>{description}</p>
        <div><button onClick={onCancel} disabled={busy}>취소</button><button onClick={onConfirm} disabled={busy}>{busy ? "처리 중…" : confirmLabel}</button></div>
      </section>
    </div>
  );
}
