import Icon from "@/components/Icon";

export default function LogoutConfirmModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="logout-overlay" role="presentation" onClick={onCancel}>
      <section className="logout-modal" role="alertdialog" aria-modal="true" aria-labelledby="logout-title" onClick={(event) => event.stopPropagation()}>
        <span><Icon name="user" size={22} /></span>
        <h2 id="logout-title">정말 로그아웃 하시겠습니까?</h2>
        <p>로그아웃하면 로그인 화면으로 이동합니다.</p>
        <div><button onClick={onCancel}>취소</button><button onClick={onConfirm}>로그아웃</button></div>
      </section>
    </div>
  );
}
