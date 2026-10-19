import { Icon } from "@/shared/Icon";
import type { Picked } from "@/shared/pickBridge";

// 고른 항목을 이름표로 보여 준다. 검색어를 바꿔 목록에서 사라졌거나 다른 탭에서 보내 온 항목도 여기서 확인하고 뺄 수 있다.
export function PickedChips({ picked }: { picked: Picked }) {
  if (!picked.items.length) return null;
  return (
    <div className="picked-chips" aria-label="선택한 항목">
      {picked.items.map((item) => (
        <span key={item.id} className="picked-chip">
          <b>{item.title}</b>
          <button type="button" onClick={() => picked.toggle(item)} aria-label={`${item.title} 선택 해제`}>
            <Icon name="close" size={9} />
          </button>
        </span>
      ))}
    </div>
  );
}
