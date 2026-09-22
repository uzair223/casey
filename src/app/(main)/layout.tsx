import Header from "@/components/header";
import Footer from "@/components/footer";
import { PrismStreak } from "@/components/marketing/prism-streak";
import { SkipLink } from "@/components/skip-link";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden [--header-height:68px]">
      <PrismStreak />
      <SkipLink />
      <Header />
      <main
        id="main-content"
        className="relative z-10 container flex min-h-[calc(100vh-var(--header-height))] flex-1 flex-col pb-24 pt-[var(--header-height)]"
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}
