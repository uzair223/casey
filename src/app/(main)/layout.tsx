import Header from "@/components/header";
import Footer from "@/components/footer";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden [--header-height:68px]">
      <Header />
      <main className="container flex min-h-[calc(100vh-var(--header-height))] flex-1 flex-col pb-24 pt-[var(--header-height)]">
        {children}
      </main>
      <Footer />
    </div>
  );
}
