import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { GanttAwareTable } from "./GanttTable";
import { Icon } from "./Icon";

// 인수인계서 '부서·팀(반, 사무소)별 추가자료' 표('추가자료 | 등록 여부')를 항목별 카드로 그린다.
// 카드를 펼치면 자료를 끌어다 놓거나 눌러서 올리고, 서버가 등록 여부를 반영한 문서를 돌려주면 표(카드)가 갱신된다.
type Hast = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: Hast[] };

export type DeptFilesContextValue = {
  // 항목(item)에 파일을 올린다. 형식·크기로 걸러진 파일이 있으면 그 이유를 돌려준다. null 이면 올리지 못하고 상태만 보여 준다(읽기 전용·직접 수정 중)
  upload: ((item: string, files: File[]) => Promise<string | null>) | null;
};

export const DeptFilesContext = createContext<DeptFilesContextValue>({ upload: null });

const elements = (node: Hast, tag: string) => (node.children ?? []).filter((child) => child.type === "element" && child.tagName === tag);
const textOf = (node: Hast): string => (node.type === "text" ? node.value ?? "" : (node.children ?? []).map(textOf).join(""));
const rowsOf = (table: Hast) => elements(table, "thead").concat(elements(table, "tbody")).flatMap((part) => elements(part, "tr")).concat(elements(table, "tr"));

const HEADER = ["추가자료", "등록 여부"];

type DeptItem = { name: string; files: string[]; registered: boolean };

/** 머리글이 정확히 '추가자료 | 등록 여부'인 표의 항목 목록. 아니면 null. */
function deptItems(table: Hast): DeptItem[] | null {
  const [head, ...rows] = rowsOf(table);
  if (!head) return null;
  const titles = elements(head, "th").map((cell) => textOf(cell).trim());
  if (titles.length !== HEADER.length || titles.some((title, i) => title !== HEADER[i])) return null;
  return rows
    .map((row) => elements(row, "td").map((cell) => textOf(cell).trim()))
    .filter((cells) => cells[0])
    .map(([name, status = ""]) => {
      // "등록됨: a.pdf, b.xlsx" 또는 "자료 등록 필요"
      const registered = status.startsWith("등록됨");
      const files = registered ? status.replace(/^등록됨\s*[:：·]?\s*/, "").split(/\s*,\s*/).filter(Boolean) : [];
      return { name, files, registered };
    });
}

function DeptFileCard({ item, open, onToggle }: { item: DeptItem; open: boolean; onToggle: () => void }) {
  const { upload } = useContext(DeptFilesContext);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const send = async (files: File[]) => {
    if (!upload || uploading || !files.length) return;
    setUploading(true);
    setMessage("");
    try {
      setMessage((await upload(item.name, files)) ?? "");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setUploading(false);
    }
  };
  const status = item.registered ? `등록됨 · ${item.files.join(", ") || "파일"}` : "자료 등록 필요";
  const head = (
    <>
      <span className="dept-file-icon"><Icon name="file" size={16} /></span>
      <span className="dept-file-text"><strong>{item.name}</strong><small>{item.registered && <Icon name="check" size={12} />}{status}</small></span>
    </>
  );
  return (
    <div className={`dept-file-card ${open && upload ? "open" : ""} ${item.registered ? "done" : ""}`.trim()}>
      {upload ? (
        <button type="button" className="dept-file-head" aria-expanded={open} onClick={onToggle}>{head}<span className="dept-file-chevron"><Icon name="chevron" size={14} /></span></button>
      ) : (
        <div className="dept-file-head">{head}</div>
      )}
      {open && upload && (
        <div
          className={`dept-file-drop ${dragging ? "dragging" : ""} ${uploading ? "uploading" : ""}`.trim()}
          role="button"
          tabIndex={0}
          aria-label={`${item.name} 자료 올리기`}
          onClick={() => !uploading && inputRef.current?.click()}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !uploading) {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void send(Array.from(event.dataTransfer.files));
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = ""; // 같은 파일을 다시 골라도 올라가게 비운다
              void send(files);
            }}
          />
          <span className="dept-file-drop-icon"><Icon name="cloudUpload" size={22} /></span>
          <strong>{uploading ? "자료를 올리고 있어요…" : "관련 추가자료를 올려주세요"}</strong>
          <small>파일을 끌어다 놓거나 눌러서 선택</small>
        </div>
      )}
      {open && upload && message && <p className="dept-file-error" role="alert">{message}</p>}
    </div>
  );
}

function DeptFilesCards({ items }: { items: DeptItem[] }) {
  // 처음에는 아직 등록하지 않은 첫 항목을 펼쳐 둔다
  const [openName, setOpenName] = useState<string | null>(() => items.find((item) => !item.registered)?.name ?? null);
  return (
    <div className="dept-files">
      {items.map((item, index) => (
        <DeptFileCard key={`${item.name}-${index}`} item={item} open={openName === item.name} onToggle={() => setOpenName(openName === item.name ? null : item.name)} />
      ))}
    </div>
  );
}

/** react-markdown 의 table 자리에 끼우는 컴포넌트. 추가자료 표는 카드로, 나머지는 월별 일정표·평범한 표로 그린다. */
export function DocumentTable({ node, children }: { node?: Hast; children?: ReactNode }) {
  const items = node ? deptItems(node) : null;
  if (items) return <DeptFilesCards items={items} />;
  return <GanttAwareTable node={node}>{children}</GanttAwareTable>;
}
