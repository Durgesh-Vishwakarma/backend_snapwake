import sharp from "sharp";
import {
  IMAGE_JPEG_QUALITY,
  IMAGE_OPTIMIZE_WIDTH,
  VERIFICATION_STRICTNESS,
} from "../config/verification.js";

const maxAgeByStrictness = {
  Standard: 60_000,
  Strict: 30_000,
  Lockdown: 15_000,
};

const MIN_WIDTH = 320;
const MIN_HEIGHT = 320;
const MIN_BRIGHTNESS = 18;
const MIN_VARIATION_STANDARD = 1;

const fail = (reason, metrics = {}, timings = {}) => ({
  passed: false,
  reason,
  metrics,
  timings,
});

function validateCaptureFreshness({ capturedAt, strictness }) {
  const captureTime = new Date(capturedAt).getTime();

  if (Number.isNaN(captureTime)) {
    return fail("Invalid capture timestamp.");
  }

  const age = Date.now() - captureTime;
  if (age < -5_000) {
    return fail("Device time appears incorrect.", { ageMs: age });
  }

  const maxAge = maxAgeByStrictness[strictness] ?? maxAgeByStrictness.Standard;
  if (age > maxAge) {
    return fail("Capture is not fresh. Use live camera.", { ageMs: age, maxAgeMs: maxAge });
  }

  return { passed: true, ageMs: age };
}

function validateImageStats({ metadata, stats, ageMs }) {
  if (!metadata.width || !metadata.height) {
    return fail("Image dimensions are invalid.", { ageMs });
  }

  const metrics = {
    ageMs,
    width: metadata.width,
    height: metadata.height,
  };

  if (metadata.width < MIN_WIDTH || metadata.height < MIN_HEIGHT) {
    return fail("Image resolution is too low.", metrics);
  }

  const brightness = stats.channels?.[0]?.mean ?? 0;
  const variation = stats.channels?.[0]?.stdev ?? 0;
  const measuredMetrics = {
    ...metrics,
    brightness: Number(brightness.toFixed(2)),
    variation: Number(variation.toFixed(2)),
  };

  if (brightness < MIN_BRIGHTNESS) {
    return fail("Frame is too dark. Improve lighting.", measuredMetrics);
  }

  if (variation < MIN_VARIATION_STANDARD) {
    return fail("Frame appears too flat or blank.", measuredMetrics);
  }

  return {
    passed: true,
    metrics: measuredMetrics,
  };
}

export const prepareVerificationImage = async ({
  image,
  mimetype,
  capturedAt,
  strictness = VERIFICATION_STRICTNESS,
}) => {
  const analysisStartedAt = Date.now();

  if (!mimetype?.startsWith("image/")) {
    return fail("Invalid image format.");
  }

  const freshness = validateCaptureFreshness({ capturedAt, strictness });
  if (!freshness.passed) {
    return freshness;
  }

  let metadata;
  let stats;
  try {
    const source = sharp(image, { failOn: "none" }).rotate();
    [metadata, stats] = await Promise.all([
      source.clone().metadata(),
      source.clone().greyscale().stats(),
    ]);
  } catch {
    return fail("Uploaded image could not be processed.", { ageMs: freshness.ageMs });
  }

  const checked = validateImageStats({ metadata, stats, ageMs: freshness.ageMs });
  const analysisDurationMs = Date.now() - analysisStartedAt;

  if (!checked.passed) {
    return {
      ...checked,
      timings: { analysisDurationMs },
    };
  }

  try {
    const optimizationStartedAt = Date.now();
    const optimizedImage = await sharp(image, { failOn: "none" })
      .rotate()
      .resize({ width: IMAGE_OPTIMIZE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: IMAGE_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    const optimizationDurationMs = Date.now() - optimizationStartedAt;

    return {
      passed: true,
      metrics: checked.metrics,
      optimizedBytes: optimizedImage.length,
      optimizedImage,
      timings: {
        analysisDurationMs,
        optimizationDurationMs,
      },
    };
  } catch {
    return fail("Uploaded image could not be optimized.", checked.metrics, {
      analysisDurationMs,
    });
  }
};
