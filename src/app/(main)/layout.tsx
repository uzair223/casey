import Header from "@/components/header";
import { UserProvider } from "@/contexts/UserContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <div className="relative min-h-screen flex flex-col">
        <Header />
        <main className="container pb-6 flex flex-col flex-1">{children}</main>
      </div>
    </UserProvider>
  );
}
