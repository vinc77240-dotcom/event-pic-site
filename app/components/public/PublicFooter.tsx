import Link from "next/link";
import type { ReactNode } from "react";
import {
  FaEnvelope,
  FaInstagram,
  FaPhoneAlt,
  FaWhatsapp
} from "react-icons/fa";
import { EVENT_PIC_CONTACT, EVENT_PIC_PUBLIC_NAV } from "@/src/shared/eventPicPublic";

const FOOTER_NAV_COLUMNS = [
  EVENT_PIC_PUBLIC_NAV.slice(0, 5),
  [...EVENT_PIC_PUBLIC_NAV.slice(5), { href: "/cgv", label: "CGV" }]
] as const;

type FooterNavItem = (typeof FOOTER_NAV_COLUMNS)[number][number];

function FooterBrand() {
  return (
    <div className="footer-brand">
      <img
        alt="Logo Event Pic"
        className="footer-brand-logo"
        loading="lazy"
        src="/images/event-pic/logo-event-pic-officiel-rond.png"
      />
      <div className="footer-brand-copy">
        <strong className="event-pic-signature footer-brand-signature">Event Pic</strong>
        <small>Photobooth premium en Île-de-France</small>
      </div>
    </div>
  );
}

function FooterMobileBrand() {
  return (
    <div className="footer-brand">
      <img
        alt="Logo Event Pic"
        className="footer-brand-logo"
        loading="lazy"
        src="/images/event-pic/logo-event-pic-officiel-rond.png"
      />
      <small>Photobooth premium en Île-de-France</small>
    </div>
  );
}

function FooterDesktopContact({ instagramUrl }: { instagramUrl: string }) {
  return (
    <div className="footer-contact footer-desktop-contact">
      <a className="footer-contact-row" href="tel:+33760421876">
        <span className="footer-contact-icon" aria-hidden="true">
          <FaPhoneAlt />
        </span>
        <span>07 60 42 18 76</span>
      </a>
      <a className="footer-contact-row" href="mailto:event_pic@outlook.fr">
        <span className="footer-contact-icon" aria-hidden="true">
          <FaEnvelope />
        </span>
        <span className="footer-contact-email">event_pic@outlook.fr</span>
      </a>
      <div className="footer-desktop-social-actions" aria-label="Réseaux sociaux">
        <FooterSocialLink href={instagramUrl} icon={<FaInstagram />} label="Instagram" />
        <FooterSocialLink href="https://wa.me/33760421876" icon={<FaWhatsapp />} label="WhatsApp" />
      </div>
    </div>
  );
}

function FooterPrimaryContact() {
  return (
    <div className="footer-contact footer-mobile-primary-contact-list">
      <a className="footer-contact-row" href="tel:+33760421876">
        <span className="footer-contact-icon" aria-hidden="true">
          <FaPhoneAlt />
        </span>
        <span>07 60 42 18 76</span>
      </a>
      <a className="footer-contact-row" href="mailto:event_pic@outlook.fr">
        <span className="footer-contact-icon" aria-hidden="true">
          <FaEnvelope />
        </span>
        <span className="footer-contact-email">event_pic@outlook.fr</span>
      </a>
    </div>
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
    <a className="footer-social-link footer-mobile-social-link" href={href} rel="noopener noreferrer" target="_blank">
      <span className="footer-contact-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </a>
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

export function PublicFooter() {
  const instagramUrl = EVENT_PIC_CONTACT.instagramUrl || "#";

  return (
    <footer className="public-footer">
      <div className="footer-inner footer-desktop-grid">
        <FooterBrand />
        <FooterDesktopContact instagramUrl={instagramUrl} />
        <nav className="footer-nav" aria-label="Navigation du pied de page">
          {FOOTER_NAV_COLUMNS.map((column, index) => (
            <FooterNavColumn items={column} key={`footer-column-${index}`} />
          ))}
        </nav>
      </div>
      <div className="footer-mobile-grid">
        <div className="footer-mobile-brand">
          <FooterMobileBrand />
        </div>
        <div className="footer-mobile-primary-contact">
          <FooterPrimaryContact />
        </div>
        <div className="footer-mobile-social-actions">
          <FooterSocialLink href={instagramUrl} icon={<FaInstagram />} label="Instagram" />
          <FooterSocialLink href="https://wa.me/33760421876" icon={<FaWhatsapp />} label="WhatsApp" />
        </div>
        <nav className="footer-mobile-nav-grid" aria-label="Navigation du pied de page - mobile">
          <div className="footer-nav-column">
            <FooterNavLinks items={FOOTER_NAV_COLUMNS[0]} />
          </div>
          <div className="footer-nav-column">
            <FooterNavLinks items={FOOTER_NAV_COLUMNS[1]} />
          </div>
        </nav>
      </div>
    </footer>
  );
}
