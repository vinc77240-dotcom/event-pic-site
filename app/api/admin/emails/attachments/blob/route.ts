import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const EMAIL_ATTACHMENTS_BLOB_PREFIX = "admin/email-attachments";
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".zip"]);
const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/zip",
  "application/x-zip-compressed",
  "multipart/x-zip"
];

type AttachmentClientPayload = {
  file_name?: string;
  mime_type?: string;
  size?: number;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseClientPayload(value: string | null) {
  if (!value) {
    return {} as AttachmentClientPayload;
  }
  try {
    return JSON.parse(value) as AttachmentClientPayload;
  } catch {
    return {} as AttachmentClientPayload;
  }
}

function isAllowedAttachment(fileName: string, mimeType: string) {
  const extension = `.${fileName.split(".").pop()?.toLowerCase() || ""}`;
  return ALLOWED_ATTACHMENT_EXTENSIONS.has(extension) && ALLOWED_ATTACHMENT_MIME_TYPES.includes(mimeType.toLowerCase());
}

function inferMimeType(fileName: string, mimeType: string) {
  if (mimeType) {
    return mimeType;
  }
  const extension = `.${fileName.split(".").pop()?.toLowerCase() || ""}`;
  if (extension === ".pdf") {
    return "application/pdf";
  }
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".zip") {
    return "application/zip";
  }
  return "";
}

function assertSafeBlobPath(pathname: string) {
  const prefix = `${EMAIL_ATTACHMENTS_BLOB_PREFIX}/`;
  if (!pathname.startsWith(prefix) || pathname.includes("..") || pathname.includes("\\")) {
    throw new Error("Chemin Blob de piece jointe invalide.");
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          ok: false,
          error: "Stockage Blob non configure pour les pieces jointes."
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as HandleUploadBody;
    const jsonResponse = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        assertSafeBlobPath(pathname);
        const payload = parseClientPayload(clientPayload);
        const fileName = cleanText(payload.file_name);
        const mimeType = inferMimeType(fileName, cleanText(payload.mime_type));
        const size = typeof payload.size === "number" && Number.isFinite(payload.size) ? payload.size : 0;

        if (!fileName || size <= 0) {
          throw new Error("Piece jointe invalide.");
        }

        if (!isAllowedAttachment(fileName, mimeType)) {
          throw new Error("Type de fichier non autorise. Formats autorises: PDF, PNG, JPG, JPEG, ZIP.");
        }

        if (size > MAX_ATTACHMENT_SIZE_BYTES) {
          throw new Error("La piece jointe depasse 10 MB.");
        }

        return {
          allowedContentTypes: ALLOWED_ATTACHMENT_MIME_TYPES,
          maximumSizeInBytes: MAX_ATTACHMENT_SIZE_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({
            file_name: fileName,
            mime_type: mimeType,
            size
          })
        };
      }
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[Event Pic] POST /api/admin/emails/attachments/blob", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Upload Blob piece jointe impossible."
      },
      { status: 400 }
    );
  }
}
