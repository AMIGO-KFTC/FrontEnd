// 이해관계자 관계도: 인수인계서 Markdown 의 ```mermaid 블록을 SVG 로 그린다(mermaid 는 필요할 때만 불러온다).
import { useEffect, useId, useState } from "react";

export function MermaidDiagram({ code }: { code: string }) {
  const id = "mmd-" + useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral", flowchart: { htmlLabels: false } });
        const out = await mermaid.render(id, code);
        if (!cancelled) setSvg(out.svg);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (failed) return <pre className="mermaid-fallback">{code}</pre>;
  if (!svg) return <p className="muted small">관계도를 그리는 중…</p>;
  return <div className="mermaid-box" role="img" aria-label="이해관계자 관계도" dangerouslySetInnerHTML={{ __html: svg }} />;
}
