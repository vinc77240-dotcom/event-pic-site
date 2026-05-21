import { ReactNode } from "react";
import { PublicFooter } from "@/app/components/public/PublicFooter";
import { PublicHero } from "@/app/components/public/PublicHero";
import { PublicNavbar } from "@/app/components/public/PublicNavbar";

type PublicSiteShellProps = {
  children: ReactNode;
};

export function PublicSiteShell({ children }: PublicSiteShellProps) {
  return (
    <main className="public-page public-site-page">
      <PublicNavbar />
      {children}
      <PublicFooter />
    </main>
  );
}

export { PublicHero };
