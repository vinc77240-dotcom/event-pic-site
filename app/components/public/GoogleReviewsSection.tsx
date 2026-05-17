"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicSection } from "@/app/components/public/PublicSection";
import { EVENT_PIC_GOOGLE_REVIEW_URL } from "@/src/shared/eventPicPublic";

type GoogleReview = {
  authorName: string;
  authorUri: string;
  profilePhotoUrl: string;
  rating: number | null;
  text: string;
  relativeTimeDescription: string;
  publishTime: string;
};

type GoogleReviewsPayload = {
  ok: boolean;
  configured: boolean;
  rating: number | null;
  userRatingCount: number | null;
  googleMapsUri: string;
  reviews: GoogleReview[];
  message?: string;
};

type GoogleReviewsSectionProps = {
  maxReviews?: number;
  compact?: boolean;
};

const EMPTY_MESSAGE = "Les avis Google seront bientot disponibles.";
const GOOGLE_SELECTION_NOTICE =
  "Google affiche ici une selection des avis les plus recents. Consultez notre fiche Google pour voir tous les avis.";

function renderStars(rating: number | null) {
  const safeRating =
    typeof rating === "number" ? Math.max(0, Math.min(5, Math.round(rating))) : 0;
  return "★★★★★".slice(0, safeRating) + "☆☆☆☆☆".slice(0, 5 - safeRating);
}

export function GoogleReviewsSection({
  maxReviews = 5,
  compact = false
}: GoogleReviewsSectionProps = {}) {
  const [data, setData] = useState<GoogleReviewsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/google-reviews", { cache: "no-store" })
      .then((response) => response.json() as Promise<GoogleReviewsPayload>)
      .then((payload) => {
        if (isMounted) {
          setData(payload);
        }
      })
      .catch(() => {
        if (isMounted) {
          setData({
            ok: false,
            configured: false,
            rating: null,
            userRatingCount: null,
            googleMapsUri: EVENT_PIC_GOOGLE_REVIEW_URL,
            reviews: [],
            message: EMPTY_MESSAGE
          });
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const reviews = (data?.reviews ?? []).slice(0, Math.max(1, maxReviews));
  const googleMapsUri = data?.googleMapsUri || EVENT_PIC_GOOGLE_REVIEW_URL;
  const hasReviews = reviews.length > 0;

  return (
    <PublicSection
      className={compact ? "google-reviews-compact-section" : undefined}
      eyebrow={hasReviews ? "Avis Google" : "Avis clients"}
      title={hasReviews ? "Avis Google" : "Avis clients"}
      description={
        hasReviews
          ? compact
            ? "Une selection recente d'avis Google Event Pic."
            : "Les retours reels publies sur la fiche Google Event Pic."
          : "Les retours Google seront affiches ici des que la connexion sera disponible."
      }
    >
      <div className="google-reviews-panel">
        {isLoading ? (
          <p className="google-reviews-empty">Chargement des avis Google...</p>
        ) : hasReviews ? (
          <>
            <div className="google-reviews-summary">
              {typeof data?.rating === "number" ? (
                <strong>{data.rating.toFixed(1).replace(".", ",")} / 5</strong>
              ) : null}
              <span className="google-review-stars" aria-hidden="true">
                {renderStars(data?.rating ?? null)}
              </span>
              {typeof data?.userRatingCount === "number" ? (
                <small>{data.userRatingCount} avis Google</small>
              ) : null}
            </div>
            <div className={`public-grid ${compact ? "public-grid-3" : "public-grid-3"}`}>
              {reviews.map((review) => (
                <article
                  className="public-card google-review-card"
                  key={`${review.authorName}-${review.publishTime || review.relativeTimeDescription}`}
                >
                  <p className="google-review-stars" aria-label={`${review.rating ?? 0} etoiles`}>
                    {renderStars(review.rating)}
                  </p>
                  <p className="google-review-copy">{review.text}</p>
                  <div className="google-review-meta">
                    <strong>{review.authorName}</strong>
                    {review.relativeTimeDescription || review.publishTime ? (
                      <span>{review.relativeTimeDescription || review.publishTime}</span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            <p className="google-review-note">{GOOGLE_SELECTION_NOTICE}</p>
          </>
        ) : (
          <p className="google-reviews-empty">{data?.message || EMPTY_MESSAGE}</p>
        )}
      </div>

      <div className="google-review-cta">
        {googleMapsUri ? (
          <a className="public-button-outline" href={googleMapsUri} rel="noreferrer" target="_blank">
            {hasReviews ? "Voir tous nos avis Google" : "Voir notre fiche Google"}
          </a>
        ) : null}
        <Link className="public-button-dark" href="/contact">
          Demander un devis
        </Link>
      </div>
    </PublicSection>
  );
}
