import { createContext, useContext, useEffect, useRef, useState } from "react";
import { needsFill } from "./editableCells";

// '직접 수정하기' 중 표 칸·항목 이름을 그 자리에서 고치는 입력칸(editableCells.markCells 가 감싼 <span data-cell>).
// 글은 처음 한 번만 넣고 이후에는 브라우저가 고친 글을 그대로 둔다(다시 그리면 커서가 튀므로). 고친 글은 onChange 로 모은다.
// 꼭 적어야 하는 칸(비어 있거나 ID/PW 수기 빈칸이 남은 칸)은 노랗게 표시하고, 다 적으면 표시가 사라진다.
export type EditCellsValue = {
  text: (id: number) => string; // 칸의 처음 글(이스케이프를 푼 글)
  onChange: (id: number, text: string) => void;
};

export const EditCellsContext = createContext<EditCellsValue | null>(null);

export function EditableCell({ id }: { id: number }) {
  const cells = useContext(EditCellsContext);
  const ref = useRef<HTMLSpanElement>(null);
  const [required, setRequired] = useState(() => (cells ? needsFill(cells.text(id)) : false));
  useEffect(() => {
    if (ref.current && cells) ref.current.textContent = cells.text(id);
    // 처음 그릴 때만 글을 넣는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!cells) return null;
  return (
    <span
      ref={ref}
      className={`cell-edit${required ? " needs-fill" : ""}`}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-label={required ? "내용 고치기 (꼭 작성해야 하는 칸)" : "내용 고치기"}
      onInput={(event) => {
        const text = event.currentTarget.innerText;
        setRequired(needsFill(text));
        cells.onChange(id, text);
      }}
    />
  );
}
