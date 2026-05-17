import { NextResponse } from "next/server";
import {
  deletePhotoboothGalleryItem,
  updatePhotoboothGalleryItem
} from "@/src/server/photoboothGalleryService";
import { PhotoboothGalleryBoothType } from "@/src/shared/eventPicPublic";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseSortOrder(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const id = cleanText(params.id);
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "ID photo manquant." },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      title?: string;
      description?: string;
      booth_type?: PhotoboothGalleryBoothType;
      sort_order?: number | string;
      visible?: boolean;
      image_url?: string;
    };

    const updated = await updatePhotoboothGalleryItem(id, {
      title: body.title,
      description: body.description,
      booth_type: body.booth_type,
      sort_order: parseSortOrder(body.sort_order),
      visible: body.visible,
      image_url: body.image_url
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Mise a jour photo photobooth impossible."
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const id = cleanText(params.id);
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "ID photo manquant." },
        { status: 400 }
      );
    }
    await deletePhotoboothGalleryItem(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Suppression photo photobooth impossible."
      },
      { status: 400 }
    );
  }
}

