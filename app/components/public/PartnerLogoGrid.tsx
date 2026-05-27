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
  variant?: "grid" | "marquee";
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

export function PartnerLogoGrid({ logos, variant = "grid" }: PartnerLogoGridProps) {
  const [brokenLogos, setBrokenLogos] = useState<Record<string, boolean>>({});
  const [isVisible, setIsVisible] = useState(false);
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const loggedMissing = useRef<Record<string, boolean>>({});
  const isMarquee = variant === "marquee";

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
      isMarquee
        ? { rootMargin: "420px 0px 180px 0px", threshold: 0.01 }
        : { rootMargin: "0px 0px -10% 0px", threshold: 0.16 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [isMarquee]);

  const displayLogos =
    isMarquee
      ? [
          ...normalized.map((logo) => ({ logo, clone: false })),
          ...normalized.map((logo) => ({ logo, clone: true }))
        ]
      : normalized.map((logo) => ({ logo, clone: false }));

  return (
    <div
      ref={marqueeRef}
      className={`partner-logo-marquee partner-logo-marquee--${variant} ${
        isVisible ? "is-visible" : ""
      }`}
      aria-label="Logos partenaires"
    >
      <div className="partner-logo-track">
        {displayLogos.map(({ logo, clone }, index) => {
          const broken = brokenLogos[logo.filename] === true;
          const partnerSlug = logo.filename.replace(/\.[^.]+$/, "");
          const altText = getPartnerLogoAltText(logo, partnerSlug);
          const baseIndex = normalized.length > 0 ? index % normalized.length : index;
          const shouldPrioritizeLogo = isMarquee && !clone && baseIndex < 5;
          const shouldEagerLoadLogo = isMarquee && !clone && (shouldPrioritizeLogo || isVisible);

          return (
            <article
              key={`${clone ? "clone" : "logo"}-${logo.filename}`}
              aria-hidden={clone ? "true" : undefined}
              className="partner-logo-card"
              data-clone={clone ? "true" : undefined}
              data-partner={partnerSlug}
              style={{ "--partner-logo-index": baseIndex } as CSSProperties}
            >
              <div className="partner-logo-visual">
                {broken ? (
                  <div className="partner-logo-placeholder" aria-label={logo.name}>
                    <strong>{logo.name}</strong>
                  </div>
                ) : (
                  <img
                    alt={clone ? "" : altText}
                    className="partner-logo-image"
                    decoding={shouldPrioritizeLogo ? "sync" : "async"}
                    fetchPriority={
                      shouldPrioritizeLogo ? "high" : shouldEagerLoadLogo ? "auto" : "low"
                    }
                    height={96}
                    loading={shouldEagerLoadLogo ? "eager" : "lazy"}
                    src={logo.src}
                    width={220}
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
            </article>
          );
        })}
      </div>
    </div>
  );
}
