import { cn } from "@/lib/utils";

export type IconKey =
  | "home"
  | "chat"
  | "calendar"
  | "activity"
  | "document"
  | "award"
  | "card"
  | "user"
  | "menu"
  | "close"
  | "logout"
  | "sparkles"
  | "send"
  | "check"
  | "star"
  | "crown"
  | "clock"
  | "plus"
  | "search"
  | "dots"
  | "building"
  | "grid"
  | "template"
  | "receipt"
  | "chart"
  | "edit"
  | "arrowRight"
  | "chevronLeft"
  | "history"
  | "users"
  | "gift"
  | "store";

const paths: Record<IconKey, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />,
  chat: <path d="M21 11.5a8.38 8.38 0 0 1-9 8.3L3 21l1.2-3.6A8.38 8.38 0 1 1 21 11.5Z" />,
  calendar: (
    <path d="M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
  ),
  activity: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  document: (
    <path d="M14 3v5h5M7 3h8l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
  ),
  award: <path d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-3.5-1.5L7 22l5-3 5 3-1.5-8.5" />,
  card: <path d="M3 7h18M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />,
  user: <path d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />,
  users: (
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  logout: (
    <path d="M15 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2M10 12h11m0 0-3-3m3 3-3 3" />
  ),
  sparkles: (
    <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
  ),
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />,
  check: <path d="m5 12 4.5 4.5L19 7" />,
  star: <path d="m12 3 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.8 6.1 21l1.2-6.5L2.5 9.9l6.6-.9L12 3Z" />,
  crown: <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-1.5 12h-15L3 7Z" />,
  clock: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <path d="m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" />,
  dots: <path d="M12 6h.01M12 12h.01M12 18h.01" />,
  building: (
    <path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M9 8h.01M12 8h.01M9 12h.01M12 12h.01M16 21v-9h3a1 1 0 0 1 1 1v8" />
  ),
  grid: <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />,
  template: <path d="M4 4h16v5H4V4Zm0 9h7v7H4v-7Zm11 0h5v7h-5v-7Z" />,
  receipt: (
    <path d="M5 3l1.5 1.5L8 3l1.5 1.5L11 3l1.5 1.5L14 3l1.5 1.5L17 3v18l-1.5-1.5L14 21l-1.5-1.5L11 21l-1.5-1.5L8 21l-1.5-1.5L5 21V3Zm3 6h6M8 13h6" />
  ),
  chart: <path d="M3 21h18M7 21V11M12 21V5M17 21v-7" />,
  edit: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />,
  arrowRight: <path d="M5 12h14m0 0-6-6m6 6-6 6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  history: <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0 0V4m0 4h4M12 7v5l3 2" />,
  gift: (
    <path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8M2 7h20v5H2V7Zm10 0v14M12 7S11 3 8.5 3 6 5 6 5s.5 2 6 2Zm0 0s1-4 3.5-4S18 5 18 5s-.5 2-6 2Z" />
  ),
  store: (
    <path d="M4 9h16l-1 11H5L4 9Zm4 0V6a4 4 0 0 1 8 0v3M9 13h6" />
  ),
};

export function Icon({
  name,
  className,
}: {
  name: IconKey;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5 shrink-0", className)}
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}
