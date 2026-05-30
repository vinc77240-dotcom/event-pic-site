"use client";

import { useMemo, useState } from "react";
import {
  EVENT_PIC_METAL_ANTHRACITE_IMAGE,
  EVENT_PIC_WOOD_PREMIUM_IMAGE,
  PhotoboothGalleryItem
} from "@/src/shared/eventPicPublic";

type PhotoboothShowcaseProps = {
  items: PhotoboothGalleryItem[];
};

type ShowcaseItem = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  booth_type: PhotoboothGalleryItem["booth_type"];
};

const DEFAULT_SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    id: "default-bois-reelle",
    title: "Borne bois premium",
    description:
      "Notre borne bois premium allie élégance, simplicité et qualité photo pour sublimer mariages, anniversaires, événements privés et professionnels.",
    image_url: EVENT_PIC_WOOD_PREMIUM_IMAGE,
    booth_type: "bois"
  },
  {
    id: "default-metal-premium",
    title: "Borne métal premium",
    description:
      "Une borne métal moderne, élégante et professionnelle, idéale pour les soirées privées, événements d'entreprise, anniversaires et réceptions haut de gamme.",
    image_url: EVENT_PIC_METAL_ANTHRACITE_IMAGE,
    booth_type: "metal"
  },
  {
    id: "default-ambiance-evenement",
    title: "Ambiance événement premium",
    description:
      "Une mise en scène élégante pour valoriser vos photos et l'expérience invité.",
    image_url: "/photobooths/visuel-premium.jpg",
    booth_type: "signature"
  }
];

const FALLBACK_SHOWCASE_IMAGE = EVENT_PIC_WOOD_PREMIUM_IMAGE;

function boothTypeLabel(value: PhotoboothGalleryItem["booth_type"]) {
  if (value === "bois") {
    return "Borne bois premium";
  }
  if (value === "metal") {
    return "Borne métal premium";
  }
  if (value === "noir") {
    return "Borne métal";
  }
  if (value === "signature") {
    return "Borne design signature";
  }
  return "Photobooth Event Pic";
}

export function PhotoboothShowcase({ items }: PhotoboothShowcaseProps) {
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const list = useMemo(
    () => {
      const customItems = items.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        image_url: item.image_url,
        booth_type: item.booth_type
      }));
      const merged = [...DEFAULT_SHOWCASE_ITEMS, ...customItems];
      const seen = new Set<string>();

      return merged.filter((item) => {
        const normalizedTitle = item.title.toLowerCase();
        const isTechnical = normalizedTitle.includes("technique") || normalizedTitle.includes("fiche");
        if (isTechnical) {
          return false;
        }

        const imageKey = item.image_url.trim().toLowerCase();
        if (imageKey.includes("borne-bois-reelle")) {
          return false;
        }

        if (seen.has(imageKey)) {
          return false;
        }
        seen.add(imageKey);
        return true;
      });
    },
    [items]
  );

  return (
    <div className="public-grid public-grid-3">
      {list.map((item) => {
        const isBroken = brokenImages[item.id] === true;
        const displayImage = isBroken ? FALLBACK_SHOWCASE_IMAGE : item.image_url;

        return (
          <article className="public-card photobooth-card" key={item.id}>
            <div className="photobooth-image-wrap">
              <img
                alt={item.title}
                loading="lazy"
                src={displayImage}
                onError={() => {
                  if (isBroken || item.image_url === FALLBACK_SHOWCASE_IMAGE) {
                    return;
                  }

                  setBrokenImages((current) => ({
                    ...current,
                    [item.id]: true
                  }));
                }}
              />
            </div>
            <small className="photobooth-type">{boothTypeLabel(item.booth_type)}</small>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        );
      })}
    </div>
  );
}
