import sharp from "sharp";
import { VERIFICATION_STRICTNESS } from "../config/verification.js";

const maxAgeByStrictness = {
  Standard: 60_000,
  Strict: 30_000,
  Lockdown: 15_000,
};

const MIN_WIDTH = 320;
const MIN_HEIGHT = 320;
const MIN_BRIGHTNESS = 18;
const MIN_VARIATION_STANDARD = 1;

export const runAntiCheatChecks = async ({
  image,
  mimetype,
  capturedAt,
  strictness = VERIFICATION_STRICTNESS,
}) => {
  if (!mimetype?.startsWith("image/")) {
    return { passed: false, reason: "Invalid image format." };
  }

  const captureTime = new Date(capturedAt).getTime();
  if (Number.isNaN(captureTime)) {
    return { passed: false, reason: "Invalid capture timestamp." };
  }

  const age = Date.now() - captureTime;
  if (age < -5_000) {
    return { passed: false, reason: "Device time appears incorrect." };
  }

  const maxAge = maxAgeByStrictness[strictness] ?? maxAgeByStrictness.Standard;
  if (age > maxAge) {
    return { passed: false, reason: "Capture is not fresh. Use live camera." };
  }

  let metadata;
  let stats;
  try {
    const sharpImage = sharp(image);
    [metadata, stats] = await Promise.all([
      sharpImage.metadata(),
      sharpImage.greyscale().stats(),
    ]);
  } catch {
    return { passed: false, reason: "Uploaded image could not be processed." };
  }

  if (!metadata.width || !metadata.height) {
    return { passed: false, reason: "Image dimensions are invalid." };
  }

  if (metadata.width < MIN_WIDTH || metadata.height < MIN_HEIGHT) {
    return { passed: false, reason: "Image resolution is too low." };
  }

  const brightness = stats.channels?.[0]?.mean ?? 0;
  const variation = stats.channels?.[0]?.stdev ?? 0;

  if (brightness < MIN_BRIGHTNESS) {
    return { passed: false, reason: "Frame is too dark. Improve lighting." };
  }

  if (variation < MIN_VARIATION_STANDARD) {
    return { passed: false, reason: "Frame appears too flat or blank." };
  }

  return {
    passed: true,
    metrics: {
      brightness: Number(brightness.toFixed(2)),
      variation: Number(variation.toFixed(2)),
      width: metadata.width,
      height: metadata.height,
      ageMs: age,
    },
  };
};
