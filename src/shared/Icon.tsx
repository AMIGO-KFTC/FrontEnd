import type { ReactNode } from "react";

export type IconName =
  | "arrow"
  | "bolt"
  | "check"
  | "chevron"
  | "clock"
  | "close"
  | "download"
  | "file"
  | "folder"
  | "link"
  | "mail"
  | "message"
  | "more"
  | "paperclip"
  | "print"
  | "send"
  | "shield"
  | "sparkle"
  | "upload"
  | "user";

const paths: Record<IconName, ReactNode> = {
  arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
  bolt: <path d="m13 2-7 11h6l-1 9 7-12h-6l1-8Z" />,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  close: <path d="m7 7 10 10M17 7 7 17" />,
  download: <><path d="M12 3v12m-4-4 4 4 4-4M5 20h14" /></>,
  file: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h4M10 13h5m-5 4h5" /></>,
  folder: <path d="M3 7h7l2 2h9v10H3z" />,
  link: <><path d="M10 13a5 5 0 0 0 7.1.1l1.4-1.4a5 5 0 0 0-7.1-7.1L10.6 5" /><path d="M14 11a5 5 0 0 0-7.1-.1l-1.4 1.4a5 5 0 0 0 7.1 7.1l.8-.4" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  message: <path d="M4 5h16v12H9l-5 4z" />,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  paperclip: <path d="m8 12 6.5-6.5a3 3 0 1 1 4 4L10 18a5 5 0 0 1-7-7l8-8" />,
  print: <><path d="M7 9V3h10v6M7 17H4V9h16v8h-3M7 14h10v7H7z" /></>,
  send: <path d="m3 4 18 8-18 8 3-8zM6 12h15" />,
  shield: <path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5z" />,
  sparkle: <><path d="m12 2 1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></>,
  upload: <><path d="M12 16V4m-4 4 4-4 4 4M5 14v6h14v-6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
