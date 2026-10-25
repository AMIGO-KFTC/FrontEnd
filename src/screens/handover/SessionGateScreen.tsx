// 작업(세션)을 불러오는 동안, 또는 불러오지 못했을 때 보여 주는 화면. 원인을 구분해 안내한다.
import { Brand } from "@/shared/Brand";
import { Icon } from "@/shared/Icon";

export type GateState =
  | { kind: "loading" }
  | { kind: "missing" } // 404·403: 삭제됐거나 내 작업이 아님
  | { kind: "server"; message: string }; // 네트워크·5xx 등

export function SessionGateScreen({ state, onRetry, onHome }: { state: GateState; onRetry: () => void; onHome: () => void }) {
  return (
    <div className="session-gate-page">
      <header className="onboarding-header"><Brand onClick={onHome} /></header>
      <main className="session-gate-main">
        {state.kind === "loading" && (
          <>
            <div className="session-gate-visual"><span><Icon name="sparkle" size={22} /></span></div>
            <h1>작업을 불러오고 있어요</h1>
            <p>저장된 단계를 확인해 이어서 열어 드릴게요.</p>
          </>
        )}
        {state.kind === "missing" && (
          <>
            <div className="session-gate-visual missing"><span><Icon name="close" size={22} /></span></div>
            <h1>열 수 없는 작업이에요</h1>
            <p>삭제됐거나 내 계정의 작업이 아니에요.{"\n"}홈의 진행 중 목록에서 다른 작업을 열어 주세요.</p>
            <div className="session-gate-actions"><button className="primary-button onboarding-next" onClick={onHome}><Icon name="home" size={15} /> 홈으로 돌아가기</button></div>
          </>
        )}
        {state.kind === "server" && (
          <>
            <div className="session-gate-visual failed"><span><Icon name="shield" size={22} /></span></div>
            <h1>서버에서 작업을 가져오지 못했어요</h1>
            <p>{state.message}</p>
            <div className="session-gate-actions">
              <button className="primary-button onboarding-next" onClick={onRetry}>다시 시도 <Icon name="arrow" size={15} /></button>
              <button className="processing-back" onClick={onHome}><Icon name="arrow" size={14} /> 홈으로 돌아가기</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
