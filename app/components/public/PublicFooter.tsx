import Link from "next/link";
import type { ReactNode } from "react";
import { FaEnvelope, FaInstagram, FaPhoneAlt, FaWhatsapp } from "react-icons/fa";
import { EVENT_PIC_CONTACT, EVENT_PIC_PUBLIC_NAV } from "@/src/shared/eventPicPublic";

const FOOTER_NAV_COLUMNS = [
  EVENT_PIC_PUBLIC_NAV.slice(0, 5),
  [...EVENT_PIC_PUBLIC_NAV.slice(5), { href: "/cgv", label: "CGV" }]
] as const;

type FooterNavItem = (typeof FOOTER_NAV_COLUMNS)[number][number];

function FooterBrand() {
  return (
    <div className="footer-brand" aria-label="Event Pic">
      <img
        alt="Logo Event Pic"
        className="footer-brand-logo"
        loading="lazy"
        src="/images/event-pic/logo-event-pic-officiel-rond.png"
      />
      <p>Photobooth premium en Île-de-France</p>
    </div>
  );
}

function FooterContactLink({
  href,
  icon,
  label,
  className = ""
}: {
  href: string;
  icon: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <a className={`footer-contact-link ${className}`.trim()} href={href}>
      <span className="footer-contact-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </a>
  );
}

function FooterSocialLink({
  href,
  icon,
  label
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <a className="footer-social-link" href={href} rel="noopener noreferrer" target="_blank">
      <span className="footer-contact-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </a>
  );
}

function FooterContact({ instagramUrl }: { instagramUrl: string }) {
  return (
    <div className="footer-contact" aria-label="Coordonnées Event Pic">
      <FooterContactLink href="tel:+33760421876" icon={<FaPhoneAlt />} label="07 60 42 18 76" />
      <FooterContactLink
        className="footer-contact-email"
        href={EVENT_PIC_CONTACT.emailHref}
        icon={<FaEnvelope />}
        label={EVENT_PIC_CONTACT.email}
      />
      <div className="footer-social-list" aria-label="Réseaux sociaux">
        <FooterSocialLink href={instagramUrl} icon={<FaInstagram />} label="Instagram" />
        <FooterSocialLink href="https://wa.me/33760421876" icon={<FaWhatsapp />} label="WhatsApp" />
      </div>
    </div>
  );
}

function FooterNavLinks({ items }: { items: readonly FooterNavItem[] }) {
  return (
    <>
      {items.map((item) => (
        <Link key={`footer-${item.href}`} href={item.href}>
          {item.label}
        </Link>
      ))}
    </>
  );
}

function FooterNavColumn({ items }: { items: readonly FooterNavItem[] }) {
  return (
    <div className="footer-nav-column">
      <FooterNavLinks items={items} />
    </div>
  );
}

function FooterNavigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav
      className={mobile ? "footer-nav footer-mobile-nav" : "footer-nav"}
      aria-label={mobile ? "Navigation du pied de page - mobile" : "Navigation du pied de page"}
    >
      {FOOTER_NAV_COLUMNS.map((column, index) => (
        <FooterNavColumn items={column} key={`footer-column-${index}`} />
      ))}
    </nav>
  );
}

export function PublicFooter() {
  const instagramUrl = EVENT_PIC_CONTACT.instagramUrl || "#";

  return (
    <footer className="public-footer">
      <div className="footer-shell">
        <div className="footer-desktop-layout">
          <FooterBrand />
          <FooterContact instagramUrl={instagramUrl} />
          <FooterNavigation />
        </div>

        <div className="footer-mobile-layout">
          <FooterBrand />
          <FooterContact instagramUrl={instagramUrl} />
          <FooterNavigation mobile />
        </div>
      </div>
    </footer>
  );
}
