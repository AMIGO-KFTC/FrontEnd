import { createContext, useContext, useEffect, useRef } from "react";

// '직접 수정하기' 중 표 칸·항목 이름을 그 자리에서 고치는 입력칸(editableCells.markCells 가 감싼 <span data-cell>).
// 글은 처음 한 번만 넣고 이후에는 브라우저가 고친 글을 그대로 둔다(다시 그리면 커서가 튀므로). 고친 글은 onChange 로 모은다.
export type EditCellsValue = {
  text: (id: number) => string; // 칸의 처음 글(이스케이프를 푼 글)
  onChange: (id: number, text: string) => void;
};

export const EditCellsContext = createContext<EditCellsValue | null>(null);

export function EditableCell({ id }: { id: number }) {
  const cells = useContext(EditCellsContext);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current && cells) ref.current.textContent = cells.text(id);
    // 처음 그릴 때만 글을 넣는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!cells) return null;
  return (
    <span
      ref={ref}
      className="cell-edit"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-label="내용 고치기"
      onInput={(event) => cells.onChange(id, event.currentTarget.innerText)}
    />
  );
}
