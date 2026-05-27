import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "public", "images", "visuels-situation");
const outputDir = path.join(sourceDir, "optimized");
const carouselOutputDir = path.join(outputDir, "carousel");

const sourcePattern = /^visuel-situation-\d{2}\.jpe?g$/i;
const targetMaxWidth = 960;
const targetMaxHeight = 720;
const webpQuality = 80;
const carouselWidth = 840;
const carouselHeight = 560;
const carouselQuality = 76;

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
  const carouselOutputPath = path.join(carouselOutputDir, outputName);
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

  await sharp(sourcePath)
    .rotate()
    .resize({
      width: carouselWidth,
      height: carouselHeight,
      fit: "cover",
      position: sharp.strategy.attention
    })
    .modulate({
      brightness: 1.035,
      saturation: 1.05
    })
    .linear(1.03, -2)
    .sharpen({ sigma: 0.45 })
    .webp({
      quality: carouselQuality,
      effort: 5,
      smartSubsample: true
    })
    .toFile(carouselOutputPath);

  const outputStat = await fs.stat(outputPath);
  const outputMeta = await sharp(outputPath).metadata();
  const carouselOutputStat = await fs.stat(carouselOutputPath);
  const carouselOutputMeta = await sharp(carouselOutputPath).metadata();

  return {
    source: `/images/visuels-situation/${fileName}`,
    optimized: `/images/visuels-situation/optimized/${outputName}`,
    carousel: `/images/visuels-situation/optimized/carousel/${outputName}`,
    sourceBytes: inputStat.size,
    optimizedBytes: outputStat.size,
    carouselBytes: carouselOutputStat.size,
    sourceWidth: sourceMeta.width,
    sourceHeight: sourceMeta.height,
    width: outputMeta.width,
    height: outputMeta.height,
    carouselWidth: carouselOutputMeta.width,
    carouselHeight: carouselOutputMeta.height
  };
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(carouselOutputDir, { recursive: true });

  const files = await getImageFiles();
  if (files.length === 0) {
    throw new Error(`Aucune photo source trouvÃ©e dans ${sourceDir}`);
  }

  const manifest = [];
  for (const fileName of files) {
    manifest.push(await optimizeImage(fileName));
  }

  const sourceTotal = manifest.reduce((total, item) => total + item.sourceBytes, 0);
  const optimizedTotal = manifest.reduce((total, item) => total + item.optimizedBytes, 0);
  const carouselTotal = manifest.reduce((total, item) => total + item.carouselBytes, 0);

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceDir: "public/images/visuels-situation",
    outputDir: "public/images/visuels-situation/optimized",
    carouselOutputDir: "public/images/visuels-situation/optimized/carousel",
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
      sharpenSigma: 0.55,
      carouselFormat: "webp",
      carouselQuality,
      carouselWidth,
      carouselHeight,
      carouselFit: "cover",
      carouselPosition: "attention",
      carouselSharpenSigma: 0.45
    },
    totals: {
      sourceBytes: sourceTotal,
      optimizedBytes: optimizedTotal,
      carouselBytes: carouselTotal,
      sourceHuman: formatBytes(sourceTotal),
      optimizedHuman: formatBytes(optimizedTotal),
      carouselHuman: formatBytes(carouselTotal),
      savedHuman: formatBytes(sourceTotal - optimizedTotal),
      carouselSavedHuman: formatBytes(sourceTotal - carouselTotal)
    },
    images: manifest
  };

  await fs.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(
    `Optimisation terminee: ${manifest.length} photos, ${payload.totals.sourceHuman} -> ${payload.totals.optimizedHuman} (${payload.totals.savedHuman} economises), variante carrousel ${payload.totals.carouselHuman} (${payload.totals.carouselSavedHuman} economises).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

