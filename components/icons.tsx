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
  | "chevronRight"
  | "history"
  | "users"
  | "gift"
  | "store"
  | "sun"
  | "moon"
  | "gripVertical"
  | "eye"
  | "eyeOff"
  | "inbox"
  | "alert"
  | "lock"
  | "mapPin"
  | "globe"
  | "thumbsUp"
  | "checkCircle"
  | "searchX"
  | "target"
  | "trendUp"
  | "external"
  | "link"
  | "copy"
  | "stamp"
  | "hand"
  | "qr"
  | "settings"
  | "tooth"
  | "dumbbell"
  | "scissors"
  | "utensils"
  | "tag";

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
  chevronRight: <path d="m9 18 6-6-6-6" />,
  history: <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0 0V4m0 4h4M12 7v5l3 2" />,
  gift: (
    <path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8M2 7h20v5H2V7Zm10 0v14M12 7S11 3 8.5 3 6 5 6 5s.5 2 6 2Zm0 0s1-4 3.5-4S18 5 18 5s-.5 2-6 2Z" />
  ),
  store: (
    <path d="M4 9h16l-1 11H5L4 9Zm4 0V6a4 4 0 0 1 8 0v3M9 13h6" />
  ),
  sun: (
    <path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  ),
  moon: (
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
  ),
  gripVertical: (
    <path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01" strokeWidth={2.6} />
  ),
  eye: (
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
  ),
  eyeOff: (
    <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.36 5.6A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a13.2 13.2 0 0 1-3.22 3.9M6.6 6.6C3.9 8.3 2 11 2 11a13.2 13.2 0 0 0 5.3 5.3" />
  ),
  inbox: <path d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />,
  alert: <path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />,
  lock: <path d="M7 11V7a5 5 0 0 1 10 0v4M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />,
  mapPin: <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  globe: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />,
  thumbsUp: <path d="M7 10v11M15 5.9 14 10h5.8a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 18.6 21H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3l4-8a3 3 0 0 1 4 3.9Z" />,
  checkCircle: <path d="M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3" />,
  searchX: <path d="m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM8.5 8.5l5 5m0-5-5 5" />,
  target: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />,
  trendUp: <path d="m22 7-8.5 8.5-5-5L2 17M16 7h6v6" />,
  external: <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />,
  link: <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />,
  copy: <path d="M9 9h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1ZM5 15H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1" />,
  stamp: <path d="M5 22h14M5 18h14v-2a3 3 0 0 0-3-3h-1.5l.8-4.2A3.3 3.3 0 0 0 12 5a3.3 3.3 0 0 0-3.3 3.8l.8 4.2H8a3 3 0 0 0-3 3v2Z" />,
  hand: <path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />,
  qr: <path d="M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h3v3h-3v-3Zm4 4h3v3h-3v-3Zm-4 3v-1M21 14v1" />,
  settings: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />,
  tooth: <path d="M12 5.5C10.5 4 8.6 3 6.8 3 4.1 3 3 5.4 3 7.6c0 2.6 1 4.4 1.7 6.6.6 2 .8 4.4 1.6 6.1.4.9 1.6.9 2 0 .7-1.6.9-4.8 2.5-4.8h2.4c1.6 0 1.8 3.2 2.5 4.8.4.9 1.6.9 2 0 .8-1.7 1-4.1 1.6-6.1.7-2.2 1.7-4 1.7-6.6C21 5.4 19.9 3 17.2 3c-1.8 0-3.7 1-5.2 2.5Z" />,
  dumbbell: <path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21" />,
  scissors: <path d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />,
  utensils: <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />,
  tag: <path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4l-8.7-8.7ZM7.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z" />,
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
