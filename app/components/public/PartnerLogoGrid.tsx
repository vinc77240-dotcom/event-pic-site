"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type PartnerLogo = {
  name: string;
  filename: string;
  src: string;
};

type PartnerLogoGridProps = {
  logos: PartnerLogo[];
};

function normalizePartnerKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getPartnerLogoAltText(logo: PartnerLogo, partnerSlug: string) {
  if (
    partnerSlug === "iad-immobilier-logo" ||
    partnerSlug === "iad-logo" ||
    normalizePartnerKey(logo.name) === "iad-immobilier"
  ) {
    return "Logo IAD Immobilier";
  }

  if (partnerSlug === "boss-hugo-boss" || normalizePartnerKey(logo.name) === "hugo-boss") {
    return "Logo Hugo Boss";
  }

  if (
    partnerSlug === "vinci-construction-logo" ||
    partnerSlug === "vinci-construction" ||
    normalizePartnerKey(logo.name) === "vinci-construction"
  ) {
    return "Logo VINCI Construction";
  }

  if (partnerSlug === "naboo") {
    return "Logo Naboo";
  }

  if (partnerSlug === "cuisinella-logo" || normalizePartnerKey(logo.name) === "cuisinella") {
    return "Logo Cuisinella";
  }

  return logo.name;
}

export function PartnerLogoGrid({ logos }: PartnerLogoGridProps) {
  const [brokenLogos, setBrokenLogos] = useState<Record<string, boolean>>({});
  const [activeLogo, setActiveLogo] = useState<PartnerLogo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const loggedMissing = useRef<Record<string, boolean>>({});

  const normalized = useMemo(() => {
    const seen = new Set<string>();

    return logos.filter((logo) => {
      const keys = [
        `name:${normalizePartnerKey(logo.name)}`,
        `file:${normalizePartnerKey(logo.filename)}`,
        `src:${normalizePartnerKey(logo.src)}`
      ];

      if (keys.some((key) => seen.has(key))) {
        return false;
      }

      keys.forEach((key) => seen.add(key));
      return true;
    });
  }, [logos]);

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

  useEffect(() => {
    const element = marqueeRef.current;
    if (!element) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.16 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        ref={marqueeRef}
        className={`partner-logo-marquee ${activeLogo ? "is-paused" : ""} ${isVisible ? "is-visible" : ""}`}
        aria-label="Logos partenaires"
      >
        <div className="partner-logo-track">
          {normalized.map((logo, index) => {
            const broken = brokenLogos[logo.filename] === true;
            const partnerSlug = logo.filename.replace(/\.[^.]+$/, "");
            const altText = getPartnerLogoAltText(logo, partnerSlug);

            return (
              <button
                key={logo.filename}
                className="partner-logo-card"
                data-partner={partnerSlug}
                type="button"
                style={{ "--partner-logo-index": index } as CSSProperties}
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
              <img
                alt={getPartnerLogoAltText(activeLogo, activeLogo.filename.replace(/\.[^.]+$/, ""))}
                className="partner-logo-modal-image"
                src={activeLogo.src}
              />
            </div>
            <strong className="partner-logo-modal-name">{activeLogo.name}</strong>
            <p className="partner-logo-modal-note">Reference Event Pic</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
