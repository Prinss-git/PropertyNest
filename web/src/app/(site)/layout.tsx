import { DevPanel } from "@/components/DevPanel";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { devToolsEnabled } from "@/lib/devTools";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
      {devToolsEnabled() && <DevPanel />}
    </>
  );
}
