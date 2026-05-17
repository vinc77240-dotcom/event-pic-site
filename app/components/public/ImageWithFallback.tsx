"use client";

import { useMemo, useState } from "react";

type ImageWithFallbackProps = {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
};

export function ImageWithFallback({ src, fallbackSrc, alt, className }: ImageWithFallbackProps) {
  const [step, setStep] = useState(0);
  const sources = useMemo(() => {
    const values = [src, fallbackSrc].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    );
    return [...new Set(values)];
  }, [fallbackSrc, src]);

  const currentSrc = sources[step];
  if (!currentSrc) {
    return null;
  }

  return (
    <img
      alt={alt}
      className={className}
      decoding="async"
      loading="lazy"
      onError={() => {
        if (step < sources.length - 1) {
          setStep((current) => current + 1);
        }
      }}
      src={currentSrc}
    />
  );
}
