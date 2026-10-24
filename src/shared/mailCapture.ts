// 메일 한 통을 그림 파일(PNG)로 '캡처'한다. 메일 화면을 그대로 찍는 대신, 머리글(보낸 사람·받는 사람·날짜·첨부)과 본문을
// 캔버스에 직접 그려 만든다. 글자가 크고 또렷해서 AI 가 읽기 좋고, 브라우저 화면 공유 권한이 필요 없다.
import type { MailAddress, MailDetail } from "./types";

export const MAIL_CAPTURE_PREFIX = "메일캡처_"; // 이 이름으로 올린 그림은 '메일' 자료로 모아 보여 준다

const WIDTH = 880; // 화면 픽셀 기준 너비
const SCALE = 2; // 선명하게 보이도록 2배 해상도로 그린다
const PAD = 36;
const BODY_FONT = '15px "Pretendard Variable", Pretendard, "Malgun Gothic", sans-serif';
const BOLD_FONT = '700 15px "Pretendard Variable", Pretendard, "Malgun Gothic", sans-serif';
const TITLE_FONT = '700 23px "Pretendard Variable", Pretendard, "Malgun Gothic", sans-serif';
const SMALL_FONT = '12.5px "Pretendard Variable", Pretendard, "Malgun Gothic", sans-serif';
const LINE = 24;
const MAX_HEIGHT = 7000; // 아주 긴 메일은 여기서 자르고 '이하 생략'을 붙인다(그림이 너무 커지지 않게)

const pad2 = (n: number) => String(n).padStart(2, "0");

export function formatMailDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}. ${pad2(d.getMonth() + 1)}. ${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const person = (a: MailAddress) => (a.name ? `${a.name} <${a.email}>` : a.email);
const people = (list: MailAddress[]) => list.map(person).join(", ");

// 글자 너비를 재며 줄바꿈한다(한글은 글자 단위로 끊는다).
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let line = "";
    let width = 0;
    for (const ch of paragraph) {
      const w = ctx.measureText(ch).width;
      if (width + w > maxWidth && line) {
        lines.push(line);
        line = ch;
        width = w;
      } else {
        line += ch;
        width += w;
      }
    }
    lines.push(line);
  }
  return lines;
}

function fileSafe(text: string): string {
  return text.replace(/[\\/:*?"<>|\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40) || "제목없음";
}

export function mailCaptureName(mail: Pick<MailDetail, "subject" | "sent_at">): string {
  const d = new Date(mail.sent_at);
  const day = Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_`;
  return `${MAIL_CAPTURE_PREFIX}${day}${fileSafe(mail.subject)}.png`;
}

export async function captureMail(mail: MailDetail, mailbox: MailAddress | null): Promise<File> {
  await document.fonts?.ready; // 화면 글꼴이 다 불러와진 뒤에 그려야 글자 너비가 맞는다
  const inner = WIDTH - PAD * 2;
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("이 브라우저에서는 캡처를 만들 수 없어요.");

  measure.font = TITLE_FONT;
  const titleLines = wrap(measure, mail.subject || "(제목 없음)", inner);
  measure.font = BODY_FONT;
  const meta: [string, string][] = [
    ["보낸 사람", person(mail.sender)],
    ["받는 사람", people(mail.to)],
    ...(mail.cc.length ? ([["참조", people(mail.cc)]] as [string, string][]) : []),
    ["보낸 날짜", formatMailDate(mail.sent_at)],
    ...(mail.attachments.length ? ([["첨부파일", mail.attachments.map((a) => `${a.name} (${Math.max(1, Math.round(a.size / 1024))}KB)`).join(", ")]] as [string, string][]) : []),
  ];
  const metaLines = meta.map(([label, value]) => ({ label, lines: wrap(measure, value, inner - 84) }));
  let bodyLines = wrap(measure, mail.body || "", inner);

  const headHeight = 28 + titleLines.length * 32 + 14 + metaLines.reduce((sum, m) => sum + m.lines.length * LINE, 0) + 18;
  const room = Math.floor((MAX_HEIGHT - headHeight - PAD * 2) / LINE);
  let truncated = false;
  if (bodyLines.length > room) {
    bodyLines = bodyLines.slice(0, Math.max(room, 1));
    truncated = true;
  }
  const height = Math.ceil(headHeight + 1 + 22 + bodyLines.length * LINE + (truncated ? LINE : 0) + PAD);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이 브라우저에서는 캡처를 만들 수 없어요.");
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.fillStyle = "#f6f3fb";
  ctx.fillRect(0, 0, WIDTH, headHeight);

  let y = PAD - 6;
  ctx.fillStyle = "#8a83a0";
  ctx.font = SMALL_FONT;
  ctx.fillText(`메일 캡처 · ${mailbox?.email ?? ""} · ${mail.folder === "sent" ? "보낸 메일함" : "받은 메일함"}`, PAD, y);
  y += 30;
  ctx.fillStyle = "#1f1b2d";
  ctx.font = TITLE_FONT;
  for (const line of titleLines) {
    ctx.fillText(line, PAD, y);
    y += 32;
  }
  y += 2;
  for (const row of metaLines) {
    ctx.font = BOLD_FONT;
    ctx.fillStyle = "#6b6483";
    ctx.fillText(row.label, PAD, y);
    ctx.font = BODY_FONT;
    ctx.fillStyle = "#2d2938";
    for (const line of row.lines) {
      ctx.fillText(line, PAD + 84, y);
      y += LINE;
    }
  }
  ctx.fillStyle = "#e3def0";
  ctx.fillRect(0, headHeight, WIDTH, 1);

  y = headHeight + 1 + 22 + 16;
  ctx.font = BODY_FONT;
  ctx.fillStyle = "#26222f";
  for (const line of bodyLines) {
    ctx.fillText(line, PAD, y);
    y += LINE;
  }
  if (truncated) {
    ctx.fillStyle = "#8a83a0";
    ctx.fillText("… (이하 생략: 본문이 길어 앞부분만 캡처했어요)", PAD, y);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("캡처 그림을 만들지 못했어요.");
  return new File([blob], mailCaptureName(mail), { type: "image/png" });
}
