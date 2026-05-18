import Link from "next/link";
import {
  FaEnvelope,
  FaInstagram,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaWhatsapp
} from "react-icons/fa";
import { EVENT_PIC_CONTACT, EVENT_PIC_PUBLIC_NAV } from "@/src/shared/eventPicPublic";

export function PublicFooter() {
  const instagramUrl = EVENT_PIC_CONTACT.instagramUrl || "#";

  return (
    <footer className="public-footer">
      <div className="premium-container public-footer-grid">
        <div className="public-footer-brand">
          <strong>Event Pic</strong>
          <small className="public-footer-contact-item">
            <span className="public-footer-contact-icon" aria-hidden="true">
              <FaMapMarkerAlt />
            </span>
            <span>{EVENT_PIC_CONTACT.zone}</span>
          </small>
        </div>
        <div className="public-footer-contact-list">
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
          {EVENT_PIC_PUBLIC_NAV.map((item) => (
            <Link key={`footer-${item.href}`} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link href="/cgv">CGV</Link>
        </div>
      </div>
    </footer>
  );
}
