import { useState, type KeyboardEvent } from "react";

// 입력란에서 Caps Lock 이 켜져 있는지 알려 준다. 브라우저는 키를 누르기 전에는 상태를 알려 주지 않으므로,
// 입력란에서 키를 한 번 누르거나 뗀 뒤부터 알 수 있다. 입력란을 벗어나면 경고를 지운다.
export function useCapsLock() {
  const [capsLock, setCapsLock] = useState(false);
  const update = (event: KeyboardEvent<HTMLElement>) => setCapsLock(event.getModifierState("CapsLock"));
  return { capsLock, handlers: { onKeyDown: update, onKeyUp: update, onBlur: () => setCapsLock(false) } };
}
