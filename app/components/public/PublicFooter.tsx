import Link from "next/link";
import { EVENT_PIC_CONTACT, EVENT_PIC_PUBLIC_NAV } from "@/src/shared/eventPicPublic";

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="premium-container public-footer-grid">
        <div>
          <strong>Event Pic</strong>
          <small>{EVENT_PIC_CONTACT.zone}</small>
        </div>
        <div>
          <a href={EVENT_PIC_CONTACT.phoneHref}>{EVENT_PIC_CONTACT.phoneDisplay}</a>
          <a href={EVENT_PIC_CONTACT.emailHref}>{EVENT_PIC_CONTACT.email}</a>
          <a href={EVENT_PIC_CONTACT.instagramUrl} rel="noopener noreferrer" target="_blank">
            Instagram
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
