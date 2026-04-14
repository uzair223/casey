import Header from "@/components/header";
import Footer from "@/components/footer";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="[--header-height:80px] relative min-h-screen flex flex-col">
      <Header />
      <main className="min-h-[calc(100vh-var(--header-height))] container pb-6 flex flex-col flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
