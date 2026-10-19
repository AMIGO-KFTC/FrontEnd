import { useCallback, useState } from "react";
import { Brand } from "@/shared/Brand";
import { PICK_KIND_LABEL, sendPick, usePicked, type PickItem, type PickKind } from "@/shared/pickBridge";
import { ConfluencePanel } from "./ConfluencePanel";
import { MattermostPanel } from "./MattermostPanel";

// 새 탭으로 여는 선택 창(#/pick/mattermost · #/pick/confluence).
// 자료 등록 화면과 같은 패널을 넓게 보여 주고, 고른 항목은 등록하지 않고 원래 창으로 넘긴다(등록은 세션을 아는 원래 창이 한다).
export function IntegrationPickerPage({ kind }: { kind: PickKind }) {
  const picked = usePicked();
  const [warning, setWarning] = useState<string | null>(null);
  const label = PICK_KIND_LABEL[kind];

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

  return (
    <div className="integration-picker-page">
      <header className="integration-picker-header">
        <Brand />
        <div>
          <strong>{label} 고르기</strong>
          <p>여기서 고른 항목은 원래 열려 있던 AMIGO 창으로 넘어가요. 등록은 원래 창에서 해요.</p>
        </div>
        <button type="button" onClick={() => window.close()}>이 탭 닫기</button>
      </header>
      <main>
        {warning && <p className="integration-error" role="alert">{warning}</p>}
        {kind === "mattermost" ? (
          <MattermostPanel sources={[]} busy={false} picked={picked} onSend={send} />
        ) : (
          <ConfluencePanel sources={[]} busy={false} picked={picked} onSend={send} />
        )}
      </main>
    </div>
  );
}
