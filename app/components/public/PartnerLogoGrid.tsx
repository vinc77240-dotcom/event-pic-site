"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PartnerLogo = {
  name: string;
  filename: string;
  src: string;
};

type PartnerLogoGridProps = {
  logos: PartnerLogo[];
};

export function PartnerLogoGrid({ logos }: PartnerLogoGridProps) {
  const [brokenLogos, setBrokenLogos] = useState<Record<string, boolean>>({});
  const [activeLogo, setActiveLogo] = useState<PartnerLogo | null>(null);
  const loggedMissing = useRef<Record<string, boolean>>({});

  const normalized = useMemo(() => logos, [logos]);
  const repeatedLogos = useMemo(() => [...normalized, ...normalized], [normalized]);

  useEffect(() => {
    if (!activeLogo) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveLogo(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeLogo]);

  return (
    <>
      <div className={`partner-logo-marquee ${activeLogo ? "is-paused" : ""}`} aria-label="Logos partenaires">
        <div className="partner-logo-track">
          {repeatedLogos.map((logo, index) => {
            const broken = brokenLogos[logo.filename] === true;
            const partnerSlug = logo.filename.replace(/\.[^.]+$/, "");
            const altText = partnerSlug === "naboo" ? "Logo Naboo" : logo.name;

            return (
              <button
                key={`${logo.filename}-${index}`}
                className="partner-logo-card"
                data-partner={partnerSlug}
                type="button"
                onClick={() => setActiveLogo(logo)}
              >
                <div className="partner-logo-visual">
                  {broken ? (
                    <div className="partner-logo-placeholder" aria-label={logo.name}>
                      <strong>{logo.name}</strong>
                    </div>
                  ) : (
                    <img
                      alt={altText}
                      className="partner-logo-image"
                      loading="lazy"
                      src={logo.src}
                      onError={() => {
                        if (
                          process.env.NODE_ENV !== "production" &&
                          loggedMissing.current[logo.filename] !== true
                        ) {
                          loggedMissing.current[logo.filename] = true;
                          console.warn(`Logo partenaire manquant : ${logo.filename}`);
                        }

                        setBrokenLogos((current) => ({
                          ...current,
                          [logo.filename]: true
                        }));
                      }}
                    />
                  )}
                </div>
                <span className="partner-logo-name">{logo.name}</span>
                <span className="partner-logo-hover-note">Reference Event Pic</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeLogo ? (
        <div className="partner-logo-modal-backdrop" onClick={() => setActiveLogo(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Zoom logo ${activeLogo.name}`}
            className="partner-logo-modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Fermer l'apercu du logo"
              className="partner-logo-modal-close"
              onClick={() => setActiveLogo(null)}
            >
              x
            </button>
            <div className="partner-logo-modal-visual">
              <img alt={activeLogo.name} className="partner-logo-modal-image" src={activeLogo.src} />
            </div>
            <strong className="partner-logo-modal-name">{activeLogo.name}</strong>
            <p className="partner-logo-modal-note">Reference Event Pic</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
