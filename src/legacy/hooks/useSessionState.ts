// 세션 상태 폴링 훅: /state?after=<마지막 메시지 ID> 를 주기적으로 불러 새 메시지만 이어 붙인다.
// AI 가 처리 중이거나 자료를 적재 중이면 1초, 그 외에는 4초 간격.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { ChatMessage, SessionDetail, UsageTotal } from "../types";

export function isBusy(session: SessionDetail | null): boolean {
  if (!session) return false;
  return session.status === "running" || session.sources.some((s) => s.status === "pending" || s.status === "processing");
}

export function useSessionState(sessionId: string | null) {
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usageTotal, setUsageTotal] = useState<UsageTotal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cursor = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const busyRef = useRef(false);
  const alive = useRef(true);

  const addMessages = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const merged = [...prev, ...incoming.filter((m) => !seen.has(m.id))];
      merged.sort((a, b) => a.id - b.id);
      return merged;
    });
    cursor.current = Math.max(cursor.current, ...incoming.map((m) => m.id));
  }, []);

  const poll = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await api.state(sessionId, cursor.current);
      if (!alive.current) return;
      setSession(data.session);
      setUsageTotal(data.usage_total ?? null);
      addMessages(data.messages);
      busyRef.current = isBusy(data.session);
      setError(null);
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    }
  }, [sessionId, addMessages]);

  const schedule = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      await poll();
      if (alive.current) schedule();
    }, busyRef.current ? 1000 : 4000);
  }, [poll]);

  // 사용자 동작 직후에는 바로 한 번 갱신하고 빠른 주기로 전환한다.
  const refresh = useCallback(async () => {
    busyRef.current = true;
    await poll();
    schedule();
  }, [poll, schedule]);

  useEffect(() => {
    alive.current = true;
    cursor.current = 0;
    setSession(null);
    setMessages([]);
    setError(null);
    if (sessionId) {
      void poll().then(() => alive.current && schedule());
    }
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, [sessionId, poll, schedule]);

  return { session, messages, usageTotal, error, refresh, addMessages };
}
