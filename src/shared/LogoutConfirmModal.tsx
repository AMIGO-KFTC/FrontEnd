import { ConfirmModal } from "@/shared/ConfirmModal";

export function LogoutConfirmModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return <ConfirmModal title="정말 로그아웃 하시겠습니까?" description="로그아웃하면 로그인 화면으로 이동합니다." confirmLabel="로그아웃" onCancel={onCancel} onConfirm={onConfirm} />;
}
