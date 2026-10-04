// 인수인계서 항목(슬롯)별 정보 충족 현황: 충분 / 부분 / 부족 + 항목·근거 미리보기
import { ChevronDown, Loader2, MessageCircleQuestion } from "lucide-react";
import { useState } from "react";
import type { AppConfig, Coverage, SessionDetail, SlotSpec } from "../types";
import { SLOT_ICONS } from "./icons";

const COVERAGE: Record<Coverage, { label: string; className: string }> = {
  sufficient: { label: "충분", className: "ok" },
  partial: { label: "부분", className: "warn" },
  missing: { label: "부족", className: "bad" },
};

export function SlotBoard({ session, config }: { session: SessionDetail; config: AppConfig | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const specs: SlotSpec[] = config?.slots ?? [];
  const analyzed = Object.keys(session.slots).length > 0;
  const counts = { sufficient: 0, partial: 0, missing: 0 };
  specs.forEach((s) => {
    const coverage = session.slots[s.key]?.coverage;
    if (coverage) counts[coverage] += 1;
  });

  return (
    <section className="panel slot-board" aria-label="항목별 충족 현황">
      <header className="panel-head">
        <h2>항목 충족 현황</h2>
        {analyzed && (
          <span className="muted small">
            충분 {counts.sufficient} · 부분 {counts.partial} · 부족 {counts.missing}
          </span>
        )}
      </header>
      {analyzed && (
        <div className="coverage-bar" aria-hidden>
          <span className="ok" style={{ flex: counts.sufficient }} />
          <span className="warn" style={{ flex: counts.partial }} />
          <span className="bad" style={{ flex: counts.missing }} />
        </div>
      )}
      {!analyzed && session.stage === "setup" && (
        <p className="muted small pad">분석을 시작하면 인수인계서 항목별로 자료에서 찾은 내용과 부족한 정보가 표시돼요.</p>
      )}

      <ul className="slots">
        {specs.map((spec) => {
          const slot = session.slots[spec.key];
          const Icon = SLOT_ICONS[spec.key];
          const openGaps = session.gaps.filter((g) => g.slot === spec.key && (g.status === "open" || g.status === "asked")).length;
          const isOpen = open === spec.key;
          const pending = !slot && session.stage === "analyzing";
          return (
            <li key={spec.key} className={`slot ${slot ? COVERAGE[slot.coverage].className : ""}`}>
              <button className="slot-head" onClick={() => setOpen(isOpen ? null : spec.key)} aria-expanded={isOpen} disabled={!slot}>
                {Icon && <Icon size={18} className="slot-icon" />}
                <span className="slot-title">
                  {spec.title}
                  {slot && (
                    <span className="slot-sub">
                      항목 {slot.items.length}
                      {openGaps > 0 && (
                        <>
                          {" · "}
                          <MessageCircleQuestion size={12} /> 확인 {openGaps}
                        </>
                      )}
                    </span>
                  )}
                </span>
                {slot ? (
                  <span className={`badge ${COVERAGE[slot.coverage].className}`}>{COVERAGE[slot.coverage].label}</span>
                ) : pending ? (
                  <span className="badge idle">
                    <Loader2 size={12} className="spin" /> 분석 중
                  </span>
                ) : (
                  <span className="badge idle">대기</span>
                )}
                {slot && <ChevronDown size={16} className={`chev ${isOpen ? "up" : ""}`} />}
              </button>
              {slot && isOpen && (
                <div className="slot-detail">
                  {slot.note && <p className="note">{slot.note}</p>}
                  {slot.items.length === 0 && <p className="muted small">자료에서 찾은 내용이 없어요. 질의응답으로 보완해요.</p>}
                  {slot.items.map((item) => (
                    <article key={item.id} className="item">
                      <h4>
                        {item.title}
                        {item.origin !== "document" && <span className="tag user">인계자 답변</span>}
                      </h4>
                      <dl>
                        {spec.fields
                          .filter((f) => item.fields[f.key] && f.key !== spec.fields[0].key)
                          .map((f) => (
                            <div key={f.key}>
                              <dt>{f.label}</dt>
                              <dd>{item.fields[f.key]}</dd>
                            </div>
                          ))}
                        {spec.required
                          .filter((key) => !item.fields[key])
                          .map((key) => (
                            <div key={key} className="missing">
                              <dt>{spec.fields.find((f) => f.key === key)?.label}</dt>
                              <dd>확인 필요</dd>
                            </div>
                          ))}
                      </dl>
                      {item.citations.length > 0 && (
                        <div className="cites">
                          {item.citations.slice(0, 3).map((c, i) => (
                            <span key={i} className="cite" title={c.quote}>
                              {c.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
