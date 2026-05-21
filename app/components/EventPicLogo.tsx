"use client";

import { useState } from "react";

export type EventPicLogoProps = {
  alt?: string;
  className?: string;
  imageClassName?: string;
};

const EVENT_PIC_LOGO_SRC = "/images/event-pic/logo-event-pic-officiel-rond.png";

export function EventPicLogo({
  alt = "Event Pic",
  className,
  imageClassName
}: EventPicLogoProps) {
  const [hasRenderableSource, setHasRenderableSource] = useState(true);

  return (
    <div className={`logo-mark logo-round event-pic-logo-shared ${className ?? ""}`.trim()}>
      {!hasRenderableSource ? (
        <span className="logo-fallback event-pic-signature logo-fallback-signature" aria-label={alt}>
          Event Pic
        </span>
      ) : (
        <img
          alt={alt}
          className={`logo-image event-pic-logo-image ${imageClassName ?? ""}`.trim()}
          decoding="async"
          loading="eager"
          onError={() => setHasRenderableSource(false)}
          onLoad={() => setHasRenderableSource(true)}
          src={EVENT_PIC_LOGO_SRC}
        />
      )}
    </div>
  );
}
