import { useCallback, useState } from "react";
import { sendCapture, sendPick, usePicked, type PickItem, type PickKind } from "@/shared/pickBridge";
import { ConfluenceWorkspace } from "./ConfluenceWorkspace";
import { MailWorkspace } from "./MailWorkspace";
import { MattermostWorkspace } from "./MattermostWorkspace";

// 새 탭으로 여는 선택 창(#/pick/mattermost · #/pick/confluence · #/pick/mail).
// 실제 Mattermost·컨플루언스처럼 보이는 전용 화면을 열고, 거기서 고른 항목을 등록하지 않고 원래 창으로 넘긴다
// (등록은 세션을 아는 원래 창이 한다).
export function IntegrationPickerPage({ kind }: { kind: PickKind }) {
  const picked = usePicked();
  const [warning, setWarning] = useState<string | null>(null);

  // 원래 창이 받았다고 응답해야 성공으로 안내한다. 응답이 없으면 고른 항목은 그대로 두어 다시 보낼 수 있게 한다.
  const send = useCallback(
    async (items: PickItem[]): Promise<string | undefined> => {
      setWarning(null);
      const ack = await sendPick(kind, items);
      if (!ack) {
        setWarning("원래 AMIGO 창을 찾지 못했어요. 자료 등록 화면이 열려 있는 창이 있는지 확인한 뒤 다시 보내 주세요. 고른 항목은 그대로 남아 있어요.");
        return undefined;
      }
      const skipped = ack.skipped ? ` (이미 등록된 ${ack.skipped}개는 제외)` : "";
      return `원래 창으로 ${ack.added}개를 보냈어요${skipped}. 원래 창에서 '자료로 등록'을 눌러 주세요.`;
    },
    [kind],
  );

  // 메일 캡처 그림은 고르는 목록을 거치지 않고 바로 원래 창으로 보내 자료로 올린다.
  const capture = useCallback(async (file: File): Promise<string | undefined> => {
    setWarning(null);
    if (!(await sendCapture(file))) {
      setWarning("원래 AMIGO 창을 찾지 못했어요. 자료 등록 화면이 열려 있는 창이 있는지 확인한 뒤 다시 캡처해 주세요.");
      return undefined;
    }
    return "캡처 그림을 원래 창에 자료로 올렸어요. 원래 창의 '등록된 자료'에서 확인할 수 있어요.";
  }, []);

  const props = { picked, onSend: send, warning, onClose: () => window.close() };
  if (kind === "mail") return <MailWorkspace {...props} onCapture={capture} />;
  return kind === "mattermost" ? <MattermostWorkspace {...props} /> : <ConfluenceWorkspace {...props} />;
}
