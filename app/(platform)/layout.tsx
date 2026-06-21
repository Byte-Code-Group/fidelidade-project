import Link from "next/link";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gray-50 font-sans text-gray-900">
      <nav className="border-b border-black/5 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Fideliza<span className="text-blue-600">.OS</span>
          </Link>
        </div>
      </nav>
      <main className="mx-auto w-full max-w-lg px-5 py-12">{children}</main>
    </div>
  );
}
