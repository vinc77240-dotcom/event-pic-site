import { NextResponse } from "next/server";
import {
  createPhotoboothGalleryItem,
  listPhotoboothGalleryItems,
  savePhotoboothUpload
} from "@/src/server/photoboothGalleryService";
import { PhotoboothGalleryBoothType } from "@/src/shared/eventPicPublic";

function cleanText(value: FormDataEntryValue | string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBool(value: FormDataEntryValue | string | null | undefined, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["true", "1", "yes", "oui"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "non"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function parseIntSafe(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export async function GET() {
  try {
    const items = await listPhotoboothGalleryItems();
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Chargement de la galerie photobooth impossible."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const fileEntry = form.get("image");

      if (!(fileEntry instanceof File)) {
        return NextResponse.json(
          { ok: false, error: "Image obligatoire." },
          { status: 400 }
        );
      }

      const imageUrl = await savePhotoboothUpload(fileEntry);
      const created = await createPhotoboothGalleryItem({
        title: cleanText(form.get("title")) || fileEntry.name,
        description: cleanText(form.get("description")),
        booth_type: (cleanText(form.get("booth_type")) || "autre") as PhotoboothGalleryBoothType,
        sort_order: parseIntSafe(form.get("sort_order"), 0),
        visible: parseBool(form.get("visible"), true),
        image_url: imageUrl
      });

      return NextResponse.json({
        ok: true,
        item: created
      });
    }

    const body = (await request.json()) as {
      title?: string;
      description?: string;
      booth_type?: PhotoboothGalleryBoothType;
      sort_order?: number;
      visible?: boolean;
      image_url?: string;
    };

    const imageUrl = cleanText(body.image_url);
    if (!imageUrl) {
      return NextResponse.json(
        { ok: false, error: "image_url obligatoire." },
        { status: 400 }
      );
    }

    const created = await createPhotoboothGalleryItem({
      title: cleanText(body.title) || "Photo photobooth",
      description: cleanText(body.description),
      booth_type: (cleanText(body.booth_type) || "autre") as PhotoboothGalleryBoothType,
      sort_order: parseIntSafe(body.sort_order, 0),
      visible: typeof body.visible === "boolean" ? body.visible : true,
      image_url: imageUrl
    });

    return NextResponse.json({ ok: true, item: created });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Creation photo photobooth impossible."
      },
      { status: 400 }
    );
  }
}
