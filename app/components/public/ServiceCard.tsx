"use client";

import Link from "next/link";
import { ReactNode, useMemo, useState } from "react";

type ServiceCardProps = {
  id?: string;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
  href?: string;
  ctaLabel?: string;
  imageSrc?: string;
  fallbackImageSrc?: string;
  imageAlt?: string;
  imageFit?: "cover" | "contain";
  mediaContent?: ReactNode;
  mediaClassName?: string;
};

export function ServiceCard({
  id,
  title,
  description,
  children,
  className,
  href,
  ctaLabel = "Decouvrir",
  imageSrc,
  fallbackImageSrc,
  imageAlt,
  imageFit = "cover",
  mediaContent,
  mediaClassName
}: ServiceCardProps) {
  const [imageStep, setImageStep] = useState(0);
  const sources = useMemo(() => {
    const values = [imageSrc, fallbackImageSrc].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    );
    return [...new Set(values)];
  }, [fallbackImageSrc, imageSrc]);

  const currentSource = sources[imageStep] ?? null;
  const showImage = Boolean(currentSource);

  function handleImageError() {
    if (imageStep < sources.length - 1) {
      setImageStep((current) => current + 1);
      return;
    }
    setImageStep(sources.length);
  }

  return (
    <article id={id} className={`public-card service-card ${className ?? ""}`.trim()}>
      {mediaContent ? (
        <div className={`service-card-media custom-media ${mediaClassName ?? ""}`.trim()}>
          {mediaContent}
        </div>
      ) : showImage ? (
        <div className={`service-card-media image-fit-${imageFit} ${mediaClassName ?? ""}`.trim()}>
          <img
            src={currentSource!}
            alt={imageAlt || title}
            loading="lazy"
            decoding="async"
            onError={handleImageError}
          />
        </div>
      ) : (
        <div className="service-card-media service-card-placeholder">
          <span>{title}</span>
        </div>
      )}

      <div className="service-card-content">
        <h3>{title}</h3>
        <p>{description}</p>
        {href ? (
          <Link className="service-card-link" href={href}>
            {ctaLabel}
          </Link>
        ) : null}
        {children}
      </div>
    </article>
  );
}
