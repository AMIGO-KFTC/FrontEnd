import {
  AlertTriangle,
  Archive,
  Briefcase,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Globe,
  KeyRound,
  ListChecks,
  Mail,
  Presentation,
  Repeat,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Source } from "../../shared/types";

const CODE = new Set([
  ".py", ".java", ".kt", ".js", ".jsx", ".ts", ".tsx", ".vue", ".go", ".rb", ".php", ".c", ".h", ".cpp", ".hpp",
  ".cs", ".swift", ".scala", ".sql", ".sh", ".bat", ".ps1", ".xml", ".yml", ".yaml", ".properties", ".gradle",
  ".jsp", ".css", ".scss", ".ini", ".toml", ".json", ".tf",
]);

export function sourceIcon(source: Source): LucideIcon {
  if (source.kind === "link") return Globe;
  const ext = source.extension;
  if ([".xlsx", ".xlsm", ".csv", ".tsv"].includes(ext)) return FileSpreadsheet;
  if (ext === ".pptx") return Presentation;
  if ([".eml", ".msg"].includes(ext)) return Mail;
  if (ext === ".zip") return Archive;
  if (CODE.has(ext)) return FileCode2;
  return FileText;
}

export function sourceLabel(source: Source): string {
  if (source.kind === "link") {
    return { confluence: "컨플루언스", nanumi: "나누미", web: "웹 링크" }[source.link_type] ?? "링크";
  }
  const ext = source.extension;
  const labels: Record<string, string> = {
    ".pdf": "PDF", ".hwpx": "한글", ".hwp": "한글", ".docx": "Word", ".pptx": "PowerPoint", ".xlsx": "Excel",
    ".xlsm": "Excel", ".eml": "메일", ".msg": "메일", ".zip": "압축", ".md": "마크다운", ".txt": "텍스트",
    ".csv": "CSV", ".html": "HTML", ".htm": "HTML",
  };
  if (labels[ext]) return labels[ext];
  return CODE.has(ext) ? "소스코드" : ext.replace(".", "").toUpperCase();
}

export const SLOT_ICONS: Record<string, LucideIcon> = {
  duties: Briefcase,
  recurring: Repeat,
  projects: ListChecks,
  contacts: Users,
  systems: KeyRound,
  issues: AlertTriangle,
};

export function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
