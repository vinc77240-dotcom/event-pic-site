"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BrandLogo } from "@/app/components/BrandLogo";
import { EVENT_PIC_PUBLIC_NAV } from "@/src/shared/eventPicPublic";

function unlockPageScroll() {
  if (typeof document === "undefined") {
    return;
  }

  const lockedClassNames = ["menu-open", "modal-open", "no-scroll", "locked"];

  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.height = "";
  document.body.style.touchAction = "";
  document.body.style.pointerEvents = "";
  document.body.classList.remove(...lockedClassNames);

  document.documentElement.style.overflow = "";
  document.documentElement.style.position = "";
  document.documentElement.style.height = "";
  document.documentElement.style.touchAction = "";
  document.documentElement.style.pointerEvents = "";
  document.documentElement.classList.remove(...lockedClassNames);
}

export function PublicNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const closeMenu = useCallback(() => {
    unlockPageScroll();
    setIsMenuOpen(false);
  }, []);

  useEffect(() => {
    closeMenu();
    return unlockPageScroll;
  }, [closeMenu, pathname]);

  useEffect(() => {
    const handlePageShow = () => unlockPageScroll();

    unlockPageScroll();
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      unlockPageScroll();
    };
  }, []);

  return (
    <header className="public-header">
      <div className="public-header-inner premium-container">
        <div className="public-logo-link-wrap">
          <Link className="public-logo-link" href="/" onClick={closeMenu}>
            <BrandLogo alt="Event Pic" className="public-logo" />
          </Link>
          <button
            aria-controls="public-main-nav"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            className="public-nav-toggle"
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            {isMenuOpen ? "Fermer" : "Menu"}
          </button>
        </div>
        <nav
          aria-label="Navigation principale"
          className={`public-nav ${isMenuOpen ? "is-open" : ""}`.trim()}
          id="public-main-nav"
        >
          {EVENT_PIC_PUBLIC_NAV.map((item) => (
            <Link key={item.href} href={item.href} onClick={closeMenu}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="public-header-cta">
          <Link className="public-button-dark" href="/contact-reserver" onClick={closeMenu}>
            Demander un devis
          </Link>
        </div>
      </div>
    </header>
  );
}
