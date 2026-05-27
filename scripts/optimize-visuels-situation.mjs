import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "public", "images", "visuels-situation");
const outputDir = path.join(sourceDir, "optimized");

const sourcePattern = /^visuel-situation-\d{2}\.jpe?g$/i;
const targetMaxWidth = 960;
const targetMaxHeight = 720;
const webpQuality = 80;

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function getImageFiles() {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && sourcePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "fr"));
}

async function optimizeImage(fileName) {
  const sourcePath = path.join(sourceDir, fileName);
  const outputName = fileName.replace(/\.(jpe?g)$/i, ".webp");
  const outputPath = path.join(outputDir, outputName);
  const inputStat = await fs.stat(sourcePath);

  const sourceMeta = await sharp(sourcePath).metadata();

  const image = sharp(sourcePath)
    .rotate()
    .resize({
      width: targetMaxWidth,
      height: targetMaxHeight,
      fit: "inside",
      withoutEnlargement: true
    })
    .modulate({
      brightness: 1.035,
      saturation: 1.055
    })
    .linear(1.035, -3)
    .sharpen({ sigma: 0.55 })
    .webp({
      quality: webpQuality,
      effort: 5,
      smartSubsample: true
    });

  await image.toFile(outputPath);

  const outputStat = await fs.stat(outputPath);
  const outputMeta = await sharp(outputPath).metadata();

  return {
    source: `/images/visuels-situation/${fileName}`,
    optimized: `/images/visuels-situation/optimized/${outputName}`,
    sourceBytes: inputStat.size,
    optimizedBytes: outputStat.size,
    sourceWidth: sourceMeta.width,
    sourceHeight: sourceMeta.height,
    width: outputMeta.width,
    height: outputMeta.height
  };
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const files = await getImageFiles();
  if (files.length === 0) {
    throw new Error(`Aucune photo source trouvée dans ${sourceDir}`);
  }

  const manifest = [];
  for (const fileName of files) {
    manifest.push(await optimizeImage(fileName));
  }

  const sourceTotal = manifest.reduce((total, item) => total + item.sourceBytes, 0);
  const optimizedTotal = manifest.reduce((total, item) => total + item.optimizedBytes, 0);

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceDir: "public/images/visuels-situation",
    outputDir: "public/images/visuels-situation/optimized",
    count: manifest.length,
    settings: {
      format: "webp",
      quality: webpQuality,
      maxWidth: targetMaxWidth,
      maxHeight: targetMaxHeight,
      fit: "inside",
      brightness: 1.035,
      contrastLinearMultiplier: 1.035,
      contrastLinearOffset: -3,
      saturation: 1.055,
      sharpenSigma: 0.55
    },
    totals: {
      sourceBytes: sourceTotal,
      optimizedBytes: optimizedTotal,
      sourceHuman: formatBytes(sourceTotal),
      optimizedHuman: formatBytes(optimizedTotal),
      savedHuman: formatBytes(sourceTotal - optimizedTotal)
    },
    images: manifest
  };

  await fs.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(
    `Optimisation terminée: ${manifest.length} photos, ${payload.totals.sourceHuman} -> ${payload.totals.optimizedHuman} (${payload.totals.savedHuman} économisés).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
