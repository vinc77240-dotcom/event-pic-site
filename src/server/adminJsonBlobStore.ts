import { promises as fs } from "node:fs";
import path from "node:path";
import { get, put } from "@vercel/blob";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

type AdminJsonArrayStoreConfig = {
  localPath: string;
  blobPath: string;
  backupBlobPrefix: string;
  fallback: unknown[];
  missingTokenMessage: string;
  blobAccess?: "private" | "public";
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hasBlobReadWriteToken() {
  return cleanText(process.env.BLOB_READ_WRITE_TOKEN).length > 0;
}

function isVercelRuntime() {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
}

function shouldUseBlobStorage() {
  return hasBlobReadWriteToken();
}

function shouldUseLocalStorage() {
  return !shouldUseBlobStorage() && !isVercelRuntime();
}

function backupTimestamp() {
  const stamp = new Date().toISOString().replace(/[-:.]/g, "");
  return `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

function serializeJsonArray(entries: unknown[]) {
  return `${JSON.stringify(entries, null, 2)}\n`;
}

function parseJsonArray(raw: string, fallback: unknown[]) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function ensureLocalArrayFile(filePath: string, fallback: unknown[]) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, serializeJsonArray(fallback), "utf8");
  }
}

async function readLocalRaw(config: AdminJsonArrayStoreConfig, options: { createIfMissing: boolean }) {
  try {
    if (options.createIfMissing) {
      await ensureLocalArrayFile(config.localPath, config.fallback);
    }
    return await fs.readFile(config.localPath, "utf8");
  } catch {
    return serializeJsonArray(config.fallback);
  }
}

async function readBlobRaw(config: AdminJsonArrayStoreConfig) {
  const access = config.blobAccess ?? "private";
  try {
    const result = await get(config.blobPath, {
      access,
      useCache: false
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }

    return await new Response(result.stream).text();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("not found")) {
      return null;
    }
    throw new Error(
      `Lecture Vercel Blob impossible pour ${config.blobPath}: ${message || "erreur inconnue"}`
    );
  }
}

async function writeBlobText(
  config: AdminJsonArrayStoreConfig,
  pathname: string,
  contents: string,
  allowOverwrite = true
) {
  await put(pathname, contents, {
    access: config.blobAccess ?? "private",
    addRandomSuffix: false,
    allowOverwrite,
    contentType: JSON_CONTENT_TYPE,
    cacheControlMaxAge: 60
  });
}

async function readBlobOrSeedRaw(config: AdminJsonArrayStoreConfig) {
  const blobRaw = await readBlobRaw(config);
  if (blobRaw !== null) {
    return blobRaw;
  }

  const seedRaw = await readLocalRaw(config, { createIfMissing: false });
  const seedEntries = parseJsonArray(seedRaw, config.fallback);
  const normalizedSeed = serializeJsonArray(seedEntries);
  await writeBlobText(config, config.blobPath, normalizedSeed);
  return normalizedSeed;
}

export async function readAdminJsonArray<T>(config: AdminJsonArrayStoreConfig): Promise<T[]> {
  if (shouldUseBlobStorage()) {
    const raw = await readBlobOrSeedRaw(config);
    return parseJsonArray(raw, config.fallback) as T[];
  }

  if (!shouldUseLocalStorage()) {
    throw new Error(config.missingTokenMessage);
  }

  const raw = await readLocalRaw(config, { createIfMissing: true });
  return parseJsonArray(raw, config.fallback) as T[];
}

export async function writeAdminJsonArray<T>(config: AdminJsonArrayStoreConfig, entries: T[]) {
  const serialized = serializeJsonArray(entries);

  if (shouldUseBlobStorage()) {
    const currentRaw = await readBlobRaw(config);
    if (currentRaw !== null && currentRaw.trim().length > 0) {
      const backupPath = `${config.backupBlobPrefix}-${backupTimestamp()}.json`;
      await writeBlobText(config, backupPath, currentRaw, false);
    }
    await writeBlobText(config, config.blobPath, serialized);
    return;
  }

  if (shouldUseLocalStorage()) {
    await ensureLocalArrayFile(config.localPath, config.fallback);
    await fs.writeFile(config.localPath, serialized, "utf8");
    return;
  }

  throw new Error(config.missingTokenMessage);
}
