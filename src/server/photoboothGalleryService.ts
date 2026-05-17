import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  EVENT_PIC_METAL_ANTHRACITE_IMAGE,
  PhotoboothGalleryBoothType,
  PhotoboothGalleryItem
} from "@/src/shared/eventPicPublic";

const galleryPath = path.join(process.cwd(), "data", "photobooth-gallery.json");
const uploadsDir = path.join(process.cwd(), "public", "uploads", "photobooths");

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
]);

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const BUILTIN_METAL_IMAGE_CANDIDATES = [
  {
    path: path.join(
      process.cwd(),
      "public",
      "images",
      "event-pic",
      "borne-metal-gris-anthracite-event-pic.png"
    ),
    url: EVENT_PIC_METAL_ANTHRACITE_IMAGE
  }
] as const;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanPositiveInt(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return fallback;
}

function normalizeBoothType(value: unknown): PhotoboothGalleryBoothType {
  const normalized = cleanText(value).toLowerCase();
  if (
    normalized === "bois" ||
    normalized === "metal" ||
    normalized === "noir" ||
    normalized === "signature" ||
    normalized === "autre"
  ) {
    return normalized;
  }
  return "autre";
}

function normalizeVisible(value: unknown, fallback = true) {
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

function normalizeItem(item: PhotoboothGalleryItem): PhotoboothGalleryItem {
  const now = new Date().toISOString();
  return {
    id: cleanText(item.id),
    title: cleanText(item.title),
    description: cleanText(item.description),
    image_url: cleanText(item.image_url),
    booth_type: normalizeBoothType(item.booth_type),
    visible: normalizeVisible(item.visible, true),
    sort_order: cleanPositiveInt(item.sort_order, 0),
    created_at: cleanText(item.created_at) || now,
    updated_at: cleanText(item.updated_at) || now
  };
}

async function ensureGalleryFile() {
  await fs.mkdir(path.dirname(galleryPath), { recursive: true });

  try {
    await fs.access(galleryPath);
  } catch {
    await fs.writeFile(galleryPath, "[]", "utf8");
  }
}

async function ensureBuiltinMetalItem(items: PhotoboothGalleryItem[]) {
  const builtinAsset = await (async () => {
    for (const asset of BUILTIN_METAL_IMAGE_CANDIDATES) {
      try {
        await fs.access(asset.path);
        return asset;
      } catch {
        // Ignore and test next candidate.
      }
    }
    return null;
  })();

  if (!builtinAsset) {
    return items;
  }

  const hasMetalItem = items.some((item) => {
    const normalizedTitle = cleanText(item.title).toLowerCase();
    const normalizedImage = cleanText(item.image_url);
    return (
      item.booth_type === "metal" ||
      normalizedImage === builtinAsset.url ||
      /\/images\/event-pic\/borne-metal-gris-anthracite-event-pic\.png$/i.test(normalizedImage) ||
      normalizedTitle.includes("borne metal premium")
    );
  });

  if (hasMetalItem) {
    return items;
  }

  const now = new Date().toISOString();
  const nextItems = [
    ...items,
    normalizeItem({
      id: "builtin-borne-metal-premium",
      title: "Borne metal premium",
      description:
        "Borne metal gris anthracite avec ecran tactile, flash et design evenementiel haut de gamme.",
      image_url: builtinAsset.url,
      booth_type: "metal",
      visible: true,
      sort_order: 2,
      created_at: now,
      updated_at: now
    })
  ];

  await writeGalleryItems(nextItems);
  return nextItems;
}

async function readGalleryItems() {
  await ensureGalleryFile();
  const raw = await fs.readFile(galleryPath, "utf8");
  const parsed = JSON.parse(raw) as PhotoboothGalleryItem[];
  if (!Array.isArray(parsed)) {
    return [] as PhotoboothGalleryItem[];
  }

  const normalizedItems = parsed.map(normalizeItem);
  const withBuiltinItems = await ensureBuiltinMetalItem(normalizedItems);

  return withBuiltinItems
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
}

async function writeGalleryItems(items: PhotoboothGalleryItem[]) {
  await ensureGalleryFile();
  await fs.writeFile(galleryPath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

export async function listPhotoboothGalleryItems() {
  return readGalleryItems();
}

export async function listVisiblePhotoboothGalleryItems() {
  const items = await readGalleryItems();
  return items.filter((item) => item.visible);
}

export async function createPhotoboothGalleryItem(input: {
  title: string;
  description: string;
  booth_type: PhotoboothGalleryBoothType;
  sort_order?: number;
  visible?: boolean;
  image_url: string;
}) {
  const now = new Date().toISOString();
  const items = await readGalleryItems();
  const item: PhotoboothGalleryItem = {
    id: randomUUID(),
    title: cleanText(input.title) || "Photo photobooth",
    description: cleanText(input.description),
    image_url: cleanText(input.image_url),
    booth_type: normalizeBoothType(input.booth_type),
    visible: normalizeVisible(input.visible, true),
    sort_order: cleanPositiveInt(input.sort_order, items.length + 1),
    created_at: now,
    updated_at: now
  };

  items.push(item);
  await writeGalleryItems(items);
  return item;
}

export async function updatePhotoboothGalleryItem(
  id: string,
  updates: Partial<
    Pick<
      PhotoboothGalleryItem,
      "title" | "description" | "booth_type" | "sort_order" | "visible" | "image_url"
    >
  >
) {
  const items = await readGalleryItems();
  const index = items.findIndex((item) => item.id === id);

  if (index === -1) {
    throw new Error("Photo photobooth introuvable.");
  }

  const current = items[index];
  items[index] = normalizeItem({
    ...current,
    title:
      updates.title !== undefined ? cleanText(updates.title) || current.title : current.title,
    description:
      updates.description !== undefined
        ? cleanText(updates.description)
        : current.description,
    booth_type:
      updates.booth_type !== undefined
        ? normalizeBoothType(updates.booth_type)
        : current.booth_type,
    sort_order:
      updates.sort_order !== undefined
        ? cleanPositiveInt(updates.sort_order, current.sort_order)
        : current.sort_order,
    visible:
      updates.visible !== undefined
        ? normalizeVisible(updates.visible, current.visible)
        : current.visible,
    image_url:
      updates.image_url !== undefined
        ? cleanText(updates.image_url)
        : current.image_url,
    updated_at: new Date().toISOString()
  });

  await writeGalleryItems(items);
  return items[index];
}

export async function deletePhotoboothGalleryItem(id: string) {
  const items = await readGalleryItems();
  const nextItems = items.filter((item) => item.id !== id);

  if (nextItems.length === items.length) {
    throw new Error("Photo photobooth introuvable.");
  }

  await writeGalleryItems(nextItems);
  return true;
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === "image/png") {
    return "png";
  }
  if (mimeType === "image/webp") {
    return "webp";
  }
  return "jpg";
}

export async function savePhotoboothUpload(file: File) {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Type de fichier non autorise. Utilisez JPG, PNG ou WEBP.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Image trop lourde. Maximum 8 MB.");
  }

  await fs.mkdir(uploadsDir, { recursive: true });

  const extension = extensionFromMimeType(file.type);
  const storedName = `${Date.now()}-${randomUUID()}.${extension}`;
  const outputPath = path.join(uploadsDir, storedName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(outputPath, bytes);

  return `/uploads/photobooths/${storedName}`;
}
