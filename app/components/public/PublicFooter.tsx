import Link from "next/link";
import {
  FaEnvelope,
  FaInstagram,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaWhatsapp
} from "react-icons/fa";
import { EVENT_PIC_CONTACT, EVENT_PIC_PUBLIC_NAV } from "@/src/shared/eventPicPublic";

const FOOTER_NAV_COLUMNS = [
  EVENT_PIC_PUBLIC_NAV.slice(0, 5),
  [...EVENT_PIC_PUBLIC_NAV.slice(5), { href: "/cgv", label: "CGV" }]
] as const;

export function PublicFooter() {
  const instagramUrl = EVENT_PIC_CONTACT.instagramUrl || "#";

  return (
    <footer className="public-footer">
      <div className="premium-container public-footer-grid">
        <div className="public-footer-brand">
          <strong>Event Pic</strong>
          <small>Photobooth premium en Ile-de-France</small>
        </div>
        <div className="public-footer-contact-list">
          <span className="public-footer-contact-item">
            <span className="public-footer-contact-icon" aria-hidden="true">
              <FaMapMarkerAlt />
            </span>
            <span>{EVENT_PIC_CONTACT.zone}</span>
          </span>
          <a className="public-footer-contact-item" href="tel:+33760421876">
            <span className="public-footer-contact-icon" aria-hidden="true">
              <FaPhoneAlt />
            </span>
            <span>07 60 42 18 76</span>
          </a>
          <a className="public-footer-contact-item" href="mailto:event_pic@outlook.fr">
            <span className="public-footer-contact-icon" aria-hidden="true">
              <FaEnvelope />
            </span>
            <span>event_pic@outlook.fr</span>
          </a>
          <a className="public-footer-contact-item" href={instagramUrl} rel="noopener noreferrer" target="_blank">
            <span className="public-footer-contact-icon" aria-hidden="true">
              <FaInstagram />
            </span>
            <span>Instagram</span>
          </a>
          <a
            className="public-footer-contact-item"
            href="https://wa.me/33760421876"
            rel="noopener noreferrer"
            target="_blank"
          >
            <span className="public-footer-contact-icon" aria-hidden="true">
              <FaWhatsapp />
            </span>
            <span>WhatsApp</span>
          </a>
        </div>
        <div className="public-footer-links">
          {FOOTER_NAV_COLUMNS.map((column, index) => (
            <div className="public-footer-link-column" key={`footer-column-${index}`}>
              {column.map((item) => (
                <Link key={`footer-${item.href}`} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
