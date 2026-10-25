// 새 탭(선택 창)에서 고른 Mattermost 대화·컨플루언스 페이지·메일, 그리고 메일 캡처 그림을 원래 창(자료 등록 화면)으로 넘기는 다리.
//
//   원래 창  자료 등록 화면이 listenPicks() 로 항상 듣고 있다가, 받은 항목을 선택 상태에 넣고 "받았어요" 응답(ack)을 돌려준다.
//   새 탭    #/pick/mattermost · #/pick/confluence · #/pick/mail 주소로 열린다. sendPick() 으로 보내고, 응답이 오면 전달된 것이다.
//
// 같은 사이트(origin)의 창끼리만 통하는 BroadcastChannel 을 쓰므로 서버를 거치지 않는다. 등록(자료 저장)은 세션을 아는 원래 창이 한다.
import { useCallback, useEffect, useMemo, useState } from "react";

export type PickKind = "mattermost" | "confluence" | "mail" | "jira";
export type PickItem = { id: string; title: string; url: string };
export type PickAck = { added: number; skipped: number };

type PickMessage =
  | { type: "pick"; requestId: string; kind: PickKind; items: PickItem[] }
  | { type: "ack"; requestId: string; kind: PickKind; added: number; skipped: number }
  | { type: "capture"; requestId: string; file: File } // 메일 캡처 그림(바로 파일 자료로 올린다)
  | { type: "capture-ack"; requestId: string; ok: boolean };

const CHANNEL = "amigo-integration-pick";
const ACK_TIMEOUT_MS = 1500;

export const PICK_KIND_LABEL: Record<PickKind, string> = { mattermost: "Mattermost 대화", confluence: "컨플루언스 페이지", mail: "메일", jira: "지라 항목" };

function openChannel(): BroadcastChannel | null {
  return typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);
}

// "#/pick/mattermost" → "mattermost". 선택 창 주소가 아니면 null.
export function parsePickHash(hash: string): PickKind | null {
  const match = /^#\/pick\/(mattermost|confluence|mail|jira)\/?$/.exec(hash);
  return match ? (match[1] as PickKind) : null;
}

// 선택 창을 새 탭으로 연다. 같은 이름의 탭이 이미 있으면 새로 만들지 않고 그 탭을 다시 쓴다.
// 팝업 차단 등으로 열리지 않으면 false.
export function openPickerTab(kind: PickKind): boolean {
  const url = `${window.location.pathname}${window.location.search}#/pick/${kind}`;
  const tab = window.open(url, `amigo-pick-${kind}`);
  tab?.focus();
  return tab !== null;
}

// 선택 창 → 원래 창. 원래 창의 응답을 기다렸다가 결과를 돌려주고, 응답이 없으면(원래 창이 닫혔거나 다른 곳) null.
export function sendPick(kind: PickKind, items: PickItem[]): Promise<PickAck | null> {
  const channel = openChannel();
  if (!channel) return Promise.resolve(null);
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve) => {
    const finish = (ack: PickAck | null) => {
      window.clearTimeout(timer);
      channel.close();
      resolve(ack);
    };
    const timer = window.setTimeout(() => finish(null), ACK_TIMEOUT_MS);
    channel.onmessage = (event: MessageEvent<PickMessage>) => {
      const message = event.data;
      if (message?.type === "ack" && message.requestId === requestId) finish({ added: message.added, skipped: message.skipped });
    };
    channel.postMessage({ type: "pick", requestId, kind, items } satisfies PickMessage);
  });
}

// 원래 창이 듣는 쪽. handler 가 돌려준 처리 결과를 보낸 창에 응답으로 알려 준다.
export function listenPicks(handler: (kind: PickKind, items: PickItem[]) => PickAck): () => void {
  const channel = openChannel();
  if (!channel) return () => {};
  channel.onmessage = (event: MessageEvent<PickMessage>) => {
    const message = event.data;
    if (message?.type !== "pick" || !Array.isArray(message.items)) return;
    const ack = handler(message.kind, message.items);
    channel.postMessage({ type: "ack", requestId: message.requestId, kind: message.kind, ...ack } satisfies PickMessage);
  };
  return () => channel.close();
}

// 선택 창 → 원래 창: 메일 캡처 그림을 보낸다. 원래 창이 자료로 올렸다고 응답하면 true, 응답이 없으면 false.
export function sendCapture(file: File): Promise<boolean> {
  const channel = openChannel();
  if (!channel) return Promise.resolve(false);
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      window.clearTimeout(timer);
      channel.close();
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), ACK_TIMEOUT_MS * 2);
    channel.onmessage = (event: MessageEvent<PickMessage>) => {
      const message = event.data;
      if (message?.type === "capture-ack" && message.requestId === requestId) finish(message.ok);
    };
    channel.postMessage({ type: "capture", requestId, file } satisfies PickMessage);
  });
}

// 원래 창이 듣는 쪽: 받은 캡처 그림을 handler 가 자료로 올리고, 올렸는지를 보낸 창에 알려 준다.
export function listenCaptures(handler: (file: File) => boolean): () => void {
  const channel = openChannel();
  if (!channel) return () => {};
  channel.onmessage = (event: MessageEvent<PickMessage>) => {
    const message = event.data;
    if (message?.type !== "capture" || !(message.file instanceof File)) return;
    channel.postMessage({ type: "capture-ack", requestId: message.requestId, ok: handler(message.file) } satisfies PickMessage);
  };
  return () => channel.close();
}

// 패널이 쓰는 "고른 항목" 상태. 화면 이동으로 패널이 사라져도 고른 항목이 남도록 패널 바깥(화면)에서 들고 있는다.
export type Picked = {
  items: PickItem[];
  has: (id: string) => boolean;
  toggle: (item: PickItem) => void;
  addMany: (items: PickItem[]) => void;
  removeMany: (ids: string[]) => void;
  clear: () => void;
};

export function usePicked(): Picked {
  const [map, setMap] = useState<Record<string, PickItem>>({});
  const toggle = useCallback((item: PickItem) => {
    setMap((prev) => {
      const next = { ...prev };
      if (item.id in next) delete next[item.id];
      else next[item.id] = item;
      return next;
    });
  }, []);
  const addMany = useCallback((items: PickItem[]) => setMap((prev) => ({ ...prev, ...Object.fromEntries(items.map((item) => [item.id, item])) })), []);
  const removeMany = useCallback(
    (ids: string[]) =>
      setMap((prev) => {
        const next = { ...prev };
        ids.forEach((id) => delete next[id]);
        return next;
      }),
    [],
  );
  const clear = useCallback(() => setMap({}), []);
  return useMemo(
    () => ({ items: Object.values(map), has: (id: string) => id in map, toggle, addMany, removeMany, clear }),
    [map, toggle, addMany, removeMany, clear],
  );
}

// 원래 창 쪽: 자료 등록 화면이 켜져 있는 동안 선택 창에서 오는 항목을 받는다.
// accept 는 종류별로 받을 수 있는 항목만 걸러(이미 등록된 것 제외) 선택 상태에 넣고 결과를 돌려준다.
export function usePickReceiver(accept: (kind: PickKind, items: PickItem[]) => PickAck): void {
  useEffect(() => listenPicks(accept), [accept]);
}

// 원래 창 쪽: 자료 등록 화면이 켜져 있는 동안 선택 창에서 오는 메일 캡처 그림을 받는다.
export function useCaptureReceiver(accept: (file: File) => boolean): void {
  useEffect(() => listenCaptures(accept), [accept]);
}
