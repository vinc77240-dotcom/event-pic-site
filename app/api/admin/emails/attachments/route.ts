import { NextResponse } from "next/server";
import {
  deleteUploadedEmailAttachment,
  saveUploadedEmailAttachment
} from "@/src/server/emailService";

type DeletePayload = {
  stored_name?: string;
};

function isBlobLike(value: unknown): value is Blob {
  return Boolean(
    value &&
      typeof value === "object" &&
      "arrayBuffer" in value &&
      typeof (value as Blob).arrayBuffer === "function"
  );
}

function isExpectedAttachmentError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("Type de fichier non autorise") ||
    message.includes("piece jointe depasse") ||
    message.includes("Piece jointe invalide")
  );
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fileField = formData.get("file");

    if (!isBlobLike(fileField)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Aucun fichier recu."
        },
        { status: 400 }
      );
    }

    const fileName =
      typeof (fileField as File).name === "string" && (fileField as File).name.trim().length > 0
        ? (fileField as File).name.trim()
        : "piece-jointe";
    const mimeType =
      typeof (fileField as File).type === "string" && (fileField as File).type.trim().length > 0
        ? (fileField as File).type.trim()
        : "application/octet-stream";
    const buffer = Buffer.from(await fileField.arrayBuffer());

    const attachment = await saveUploadedEmailAttachment({
      file_name: fileName,
      mime_type: mimeType,
      content: buffer
    });

    return NextResponse.json({
      ok: true,
      attachment
    });
  } catch (error) {
    if (!isExpectedAttachmentError(error)) {
      console.error("[Event Pic] POST /api/admin/emails/attachments", error);
    }
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Upload piece jointe impossible."
      },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as DeletePayload;
    const storedName = typeof body.stored_name === "string" ? body.stored_name.trim() : "";

    if (!storedName) {
      return NextResponse.json(
        { ok: false, error: "stored_name requis." },
        { status: 400 }
      );
    }

    await deleteUploadedEmailAttachment(storedName);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Event Pic] DELETE /api/admin/emails/attachments", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Suppression piece jointe impossible."
      },
      { status: 400 }
    );
  }
}
