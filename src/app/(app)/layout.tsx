import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <div className="shell-scroll">{children}</div>
      <BottomNav />
    </div>
  );
}
