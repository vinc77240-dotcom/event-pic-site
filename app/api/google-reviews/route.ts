import { NextResponse } from "next/server";
import { EVENT_PIC_GOOGLE_REVIEW_URL } from "@/src/shared/eventPicPublic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LegacyGoogleReview = {
  author_name?: string;
  author_url?: string;
  profile_photo_url?: string;
  rating?: number;
  text?: string;
  relative_time_description?: string;
  time?: number;
};

type LegacyGooglePlaceDetailsResponse = {
  status?: string;
  result?: {
    rating?: number;
    user_ratings_total?: number;
    url?: string;
    reviews?: LegacyGoogleReview[];
  };
};

const UNAVAILABLE_MESSAGE = "Les avis Google seront bientot disponibles.";
const NO_TEXT_REVIEW_MESSAGE = "Avis 5/5 laisse sur Google.";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolveGoogleReviewsUrl() {
  return (
    cleanText(process.env.GOOGLE_REVIEWS_URL) ||
    cleanText(process.env.GOOGLE_REVIEW_URL) ||
    EVENT_PIC_GOOGLE_REVIEW_URL
  );
}

function jsonNoCache(payload: unknown) {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}

function buildUnavailableResponse(configured: boolean, message = UNAVAILABLE_MESSAGE) {
  return jsonNoCache({
    ok: false,
    configured,
    rating: null,
    userRatingCount: null,
    googleMapsUri: resolveGoogleReviewsUrl(),
    reviews: [],
    message
  });
}

function normalizeReviews(reviews: LegacyGoogleReview[] | undefined) {
  if (!Array.isArray(reviews)) {
    return [];
  }

  return reviews
    .map((review) => {
      const authorName = cleanText(review.author_name);
      const rating = cleanNumber(review.rating);
      const rawText = cleanText(review.text);
      const text =
        rawText || (rating !== null ? `Avis ${rating}/5 laisse sur Google.` : NO_TEXT_REVIEW_MESSAGE);
      const relativeTimeDescription = cleanText(review.relative_time_description);
      const publishTime =
        typeof review.time === "number" && Number.isFinite(review.time)
          ? new Date(review.time * 1000).toISOString()
          : "";

      return {
        authorName,
        authorUri: cleanText(review.author_url),
        profilePhotoUrl: cleanText(review.profile_photo_url),
        rating,
        text,
        relativeTimeDescription,
        publishTime
      };
    })
    .filter((review) => review.authorName && review.rating !== null)
    .sort((left, right) => Date.parse(right.publishTime) - Date.parse(left.publishTime))
    .slice(0, 5);
}

export async function GET() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    return buildUnavailableResponse(false);
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("fields", "name,rating,user_ratings_total,reviews,url");
    url.searchParams.set("language", "fr");
    url.searchParams.set("reviews_sort", "newest");
    url.searchParams.set("reviews_no_translations", "true");
    url.searchParams.set("key", apiKey);

    // Places Details Legacy permet explicitement d'exiger les avis les plus recents.
    // Pour afficher l'ensemble complet des avis Google (63+), il faut passer par
    // Google Business Profile API avec OAuth. Ne pas contourner via scraping.
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return buildUnavailableResponse(true);
    }

    const payload = (await response.json()) as LegacyGooglePlaceDetailsResponse;
    if (cleanText(payload.status) !== "OK" || !payload.result) {
      return buildUnavailableResponse(true);
    }

    const rating = cleanNumber(payload.result.rating);
    const userRatingCount = cleanNumber(payload.result.user_ratings_total);
    const reviews = normalizeReviews(payload.result.reviews);

    return jsonNoCache({
      ok: reviews.length > 0,
      configured: true,
      rating,
      userRatingCount,
      googleMapsUri: cleanText(payload.result.url) || resolveGoogleReviewsUrl(),
      reviews,
      message: reviews.length > 0 ? "" : UNAVAILABLE_MESSAGE
    });
  } catch {
    return buildUnavailableResponse(true);
  }
}
