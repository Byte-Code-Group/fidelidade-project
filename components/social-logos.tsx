import { cn } from "@/lib/utils";

export type SocialKey = "instagram" | "facebook" | "youtube" | "x";

// Redes disponíveis (para selects no admin).
export const SOCIAL_NETWORKS: { key: SocialKey; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "youtube", label: "YouTube" },
  { key: "x", label: "X (Twitter)" },
];

export function isSocialKey(value: string | null | undefined): value is SocialKey {
  return value === "instagram" || value === "facebook" || value === "youtube" || value === "x";
}

const logos: Record<SocialKey, React.ReactNode> = {
  instagram: (
    <>
      <defs>
        <linearGradient id="ig-grad" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FEDA75" />
          <stop offset="0.35" stopColor="#FA7E1E" />
          <stop offset="0.6" stopColor="#D62976" />
          <stop offset="0.85" stopColor="#962FBF" />
          <stop offset="1" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
      <rect x="5" y="5" width="14" height="14" rx="4.5" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.4" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16.4" cy="7.6" r="1.1" fill="#fff" />
    </>
  ),
  facebook: (
    <>
      <rect width="24" height="24" rx="6" fill="#1877F2" />
      <path
        d="M15.4 12.6h-2v7h-2.9v-7H9.1v-2.5h1.4V8.7c0-1.9 1.1-3 2.9-3 .8 0 1.6.1 1.6.1v1.9h-.9c-.9 0-1.2.6-1.2 1.2v1.2h2.1l-.3 2.5Z"
        fill="#fff"
      />
    </>
  ),
  youtube: (
    <>
      <rect y="4" width="24" height="16" rx="4.5" fill="#FF0000" />
      <path d="M10 8.5 16 12l-6 3.5v-7Z" fill="#fff" />
    </>
  ),
  x: (
    <>
      <rect width="24" height="24" rx="6" fill="#000" />
      <path
        d="M13.9 10.6 18.4 5.5h-1.4l-3.9 4.4-3.1-4.4H5.4l4.8 6.8L5.4 18.5h1.4l4.1-4.7 3.3 4.7h4.6l-5-7.1Zm-1.5 1.6-.5-.7-3.6-5h1.7l3 4.2.5.7 3.9 5.5h-1.7l-3.3-4.7Z"
        fill="#fff"
      />
    </>
  ),
};

export function SocialLogo({ name, className }: { name: SocialKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-6 w-6", className)} aria-hidden>
      {logos[name]}
    </svg>
  );
}
