import { useState } from "react";
import { Icon } from "@/shared/Icon";
import type { Picked, PickKind } from "@/shared/pickBridge";
import type { IntegrationImportResult } from "@/shared/types";
import { PickedChips } from "./PickedChips";

type Props = {
  kind: PickKind;
  busy: boolean;
  picked: Picked; // 새 탭(선택 창)에서 보내 온 대화·페이지
  onImport: (ids: string[]) => Promise<IntegrationImportResult | undefined>;
  onOpen: () => void; // 선택 창(새 탭)을 연다
  opened: boolean; // 가장 최근에 선택 창을 열려던 시도가 성공했는지(false 면 팝업 차단 안내)
};

const TEXT: Record<PickKind, { icon: "message" | "folder"; title: string; app: string; noun: string }> = {
  mattermost: { icon: "message", title: "Mattermost 에서 대화 고르기", app: "Mattermost", noun: "대화" },
  confluence: { icon: "folder", title: "컨플루언스에서 페이지 고르기", app: "컨플루언스", noun: "페이지" },
};

// 자료 등록 화면의 Mattermost·컨플루언스 영역. 고르기는 새 탭의 전용 화면에서 하고, 여기서는 넘어온 항목을 확인해 자료로 등록한다.
export function IntegrationLauncher({ kind, busy, picked, onImport, onOpen, opened }: Props) {
  const text = TEXT[kind];
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
        <span><Icon name={text.icon} size={15} /></span>
        <div>
          <strong>{text.title}</strong>
          <p>{text.app} 창이 새 탭으로 열려요. 거기서 인수인계에 쓸 {text.noun}를 고르면 이 화면으로 넘어와요.</p>
        </div>
        <button type="button" className="integration-popout" onClick={onOpen}>
          <Icon name="chevron" size={11} /> {text.app} 열기
        </button>
      </div>
      {!opened && (
        <p className="integration-error" role="alert">
          새 탭이 열리지 않았어요. 브라우저가 팝업을 막았을 수 있어요. 위의 '{text.app} 열기' 를 다시 누르거나 팝업을 허용해 주세요.
        </p>
      )}
      {!picked.items.length && !notice && <p className="integration-empty">아직 고른 {text.noun}가 없어요. 열린 {text.app} 창에서 {text.noun}를 골라 보내 주세요.</p>}
      <PickedChips picked={picked} />
      <div className="integration-foot">
        <span>{picked.items.length ? `${picked.items.length}개 ${text.noun}가 넘어왔어요` : ""}</span>
        {notice && <em className="integration-notice">{notice}</em>}
        <button type="button" className="integration-submit" disabled={!picked.items.length || busy || importing} onClick={submit}>
          <Icon name="check" size={13} /> 선택한 {text.noun} 자료로 등록
        </button>
      </div>
    </section>
  );
}
