"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandLogo } from "@/app/components/BrandLogo";
import { EVENT_PIC_PUBLIC_NAV } from "@/src/shared/eventPicPublic";

export function PublicNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function closeMenu() {
    setIsMenuOpen(false);
  }

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
          <Link className="public-button-dark" href="/contact" onClick={closeMenu}>
            Demander un devis
          </Link>
        </div>
      </div>
    </header>
  );
}
