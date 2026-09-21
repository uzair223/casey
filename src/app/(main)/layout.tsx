import Header from "@/components/header";
import Footer from "@/components/footer";
import { SkipLink } from "@/components/skip-link";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden [--header-gap:2rem] [--header-height:68px]">
      <SkipLink />
      <Header />
      <main
        id="main-content"
        className="container flex min-h-[calc(100vh-var(--header-height))] flex-1 flex-col pb-24 pt-[calc(var(--header-height)+var(--header-gap))]"
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}
