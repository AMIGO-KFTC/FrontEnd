import { useState } from "react";
import { Icon } from "@/shared/Icon";
import type { Picked } from "@/shared/pickBridge";
import type { IntegrationImportResult } from "@/shared/types";
import { PickedChips } from "./PickedChips";

type Props = {
  busy: boolean;
  picked: Picked; // Mattermost 창에서 보내 온 대화
  onImport: (conversationIds: string[]) => Promise<IntegrationImportResult | undefined>;
  onOpen: () => void; // Mattermost 창(새 탭)을 연다
  opened: boolean; // 가장 최근에 Mattermost 창을 열려던 시도가 성공했는지(false 면 팝업 차단 안내)
};

// 자료 등록 화면의 Mattermost 영역. 대화는 새 탭의 Mattermost 화면에서 고르고, 여기서는 넘어온 대화를 확인해 자료로 등록한다.
export function MattermostLauncher({ busy, picked, onImport, onOpen, opened }: Props) {
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const submit = async () => {
    if (!picked.items.length) return;
    setImporting(true);
    setNotice(null);
    const result = await onImport(picked.items.map((item) => item.id));
    setImporting(false);
    if (result) {
      picked.clear();
      setNotice(result.message);
    }
  };

  return (
    <section className="integration-panel">
      <div className="integration-head mattermost-launcher-head">
        <span><Icon name="message" size={15} /></span>
        <div>
          <strong>Mattermost 에서 대화 고르기</strong>
          <p>Mattermost 창이 새 탭으로 열려요. 거기서 인수인계에 쓸 대화를 고르면 이 화면으로 넘어와요.</p>
        </div>
        <button type="button" className="integration-popout" onClick={onOpen}>
          <Icon name="chevron" size={11} /> Mattermost 열기
        </button>
      </div>
      {!opened && (
        <p className="integration-error" role="alert">
          새 탭이 열리지 않았어요. 브라우저가 팝업을 막았을 수 있어요. 위의 'Mattermost 열기' 를 다시 누르거나 팝업을 허용해 주세요.
        </p>
      )}
      {!picked.items.length && !notice && <p className="integration-empty">아직 고른 대화가 없어요. 열린 Mattermost 창에서 대화를 골라 보내 주세요.</p>}
      <PickedChips picked={picked} />
      <div className="integration-foot">
        <span>{picked.items.length ? `${picked.items.length}개 대화가 넘어왔어요` : ""}</span>
        {notice && <em className="integration-notice">{notice}</em>}
        <button type="button" className="integration-submit" disabled={!picked.items.length || busy || importing} onClick={submit}>
          <Icon name="check" size={13} /> 선택한 대화 자료로 등록
        </button>
      </div>
    </section>
  );
}
