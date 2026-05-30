"use client";

import { useEffect, useId, useRef, useState } from "react";
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

const EMPTY_MESSAGE =
  "Les avis Google seront bientôt disponibles. En attendant, consultez notre fiche Google.";
const GOOGLE_SELECTION_NOTICE =
  "Google affiche ici une sélection des avis les plus récents. Consultez notre fiche Google pour voir tous les avis.";

function renderStars(rating: number | null) {
  const safeRating =
    typeof rating === "number" ? Math.max(0, Math.min(5, Math.round(rating))) : 0;
  return "★".repeat(safeRating) + "☆".repeat(5 - safeRating);
}

export function GoogleReviewsSection({
  maxReviews = 5,
  compact = false
}: GoogleReviewsSectionProps = {}) {
  const [data, setData] = useState<GoogleReviewsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<GoogleReview | null>(null);
  const modalTitleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

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

  useEffect(() => {
    if (!selectedReview) {
      return;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedReview(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedReview]);

  const reviews = (data?.reviews ?? []).slice(0, Math.max(1, maxReviews));
  const googleMapsUri = data?.googleMapsUri || EVENT_PIC_GOOGLE_REVIEW_URL;
  const hasReviews = reviews.length > 0;
  const hasGoogleSummary =
    typeof data?.rating === "number" || typeof data?.userRatingCount === "number";
  const hasGoogleData = hasReviews || hasGoogleSummary;
  const formattedRating =
    typeof data?.rating === "number" ? data.rating.toFixed(1).replace(".", ",") : null;

  return (
    <PublicSection
      className={compact ? "google-reviews-compact-section" : undefined}
      eyebrow={compact ? "Avis Google" : hasGoogleData ? "Avis Google" : "Avis clients"}
      title={compact ? "Ils parlent de leur expérience" : hasGoogleData ? "Ils parlent de leur expérience" : "Avis clients"}
      description={
        compact
          ? "Une sélection récente d’avis Google Event Pic."
          : hasGoogleData
            ? "Les retours réels publiés sur la fiche Google Event Pic."
            : "Les avis Google seront bientôt disponibles. En attendant, consultez notre fiche Google."
      }
    >
      <div className="google-reviews-panel">
        {isLoading ? (
          <p className="google-reviews-empty">Chargement des avis Google...</p>
        ) : hasGoogleData ? (
          <>
            <div className="google-reviews-summary">
              {compact && formattedRating && typeof data?.userRatingCount === "number" ? (
                <strong>{formattedRating} / 5 — {data.userRatingCount} avis Google</strong>
              ) : formattedRating ? (
                <strong>{formattedRating} / 5</strong>
              ) : null}
              <span className="google-review-stars" aria-hidden="true">
                {renderStars(data?.rating ?? null)}
              </span>
              {!compact && typeof data?.userRatingCount === "number" ? (
                <small>{data.userRatingCount} avis Google</small>
              ) : null}
            </div>
            {hasReviews ? (
              <>
                <div className={`public-grid ${compact ? "public-grid-3" : "public-grid-3"}`}>
                  {reviews.map((review) => {
                    const reviewKey = `${review.authorName}-${review.publishTime || review.relativeTimeDescription}`;
                    const cardContent = (
                      <>
                        <p className="google-review-stars" aria-label={`${review.rating ?? 0} étoiles`}>
                          {renderStars(review.rating)}
                        </p>
                        <p className="google-review-copy">{review.text}</p>
                        <div className="google-review-meta">
                          <strong>{review.authorName}</strong>
                          {review.relativeTimeDescription || review.publishTime ? (
                            <span>{review.relativeTimeDescription || review.publishTime}</span>
                          ) : null}
                        </div>
                        {compact ? <span className="google-review-read-more">Lire l'avis complet</span> : null}
                      </>
                    );

                    return compact ? (
                      <button
                        aria-label={`Lire l'avis complet de ${review.authorName}`}
                        className="public-card google-review-card google-review-card-button"
                        key={reviewKey}
                        onClick={() => setSelectedReview(review)}
                        type="button"
                      >
                        {cardContent}
                      </button>
                    ) : (
                      <article className="public-card google-review-card" key={reviewKey}>
                        {cardContent}
                      </article>
                    );
                  })}
                </div>
                <p className="google-review-note">{GOOGLE_SELECTION_NOTICE}</p>
              </>
            ) : (
              <p className="google-reviews-empty">{data?.message || EMPTY_MESSAGE}</p>
            )}
          </>
        ) : (
          <p className="google-reviews-empty">{data?.message || EMPTY_MESSAGE}</p>
        )}
      </div>

      <div className="google-review-cta">
        {googleMapsUri ? (
          <a className="public-button-outline" href={googleMapsUri} rel="noreferrer" target="_blank">
            {hasGoogleData ? "Voir tous nos avis Google" : "Voir notre fiche Google"}
          </a>
        ) : null}
        <Link className="public-button-dark" href="/contact-reserver">
          Demander un devis
        </Link>
      </div>

      {selectedReview ? (
        <div className="google-review-modal-backdrop" onClick={() => setSelectedReview(null)}>
          <div
            aria-labelledby={modalTitleId}
            aria-modal="true"
            className="google-review-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="google-review-modal-header">
              <div className="google-review-modal-heading">
                <span>Avis Google complet</span>
                <strong id={modalTitleId}>{selectedReview.authorName}</strong>
                {selectedReview.relativeTimeDescription || selectedReview.publishTime ? (
                  <small>{selectedReview.relativeTimeDescription || selectedReview.publishTime}</small>
                ) : null}
              </div>
              <button
                aria-label="Fermer l'avis complet"
                className="google-review-modal-icon-close"
                onClick={() => setSelectedReview(null)}
                ref={closeButtonRef}
                type="button"
              >
                ×
              </button>
            </div>
            <div className="google-review-modal-rating">
              <p className="google-review-stars" aria-label={`${selectedReview.rating ?? 0} étoiles`}>
                {renderStars(selectedReview.rating)}
              </p>
              {typeof selectedReview.rating === "number" ? <span>{selectedReview.rating} / 5</span> : null}
            </div>
            <div className="google-review-modal-scroll">
              <p className="google-review-modal-copy">{selectedReview.text}</p>
            </div>
            <div className="google-review-modal-footer">
              <span>Merci pour ce retour d'expérience.</span>
              <button
                className="public-button-dark google-review-modal-close"
                onClick={() => setSelectedReview(null)}
                type="button"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PublicSection>
  );
}
