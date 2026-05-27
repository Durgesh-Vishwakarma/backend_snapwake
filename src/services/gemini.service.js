import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { GEMINI_API_KEY } from "../config/env.js";
import {
  GEMINI_MODEL,
  GEMINI_TIMEOUT_MS,
  IMAGE_JPEG_QUALITY,
  IMAGE_OPTIMIZE_WIDTH,
} from "../config/verification.js";
import { logEvent } from "../utils/logger.js";
import { verificationResponse } from "../utils/response.js";

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const buildPrompt = ({ challengeTitle, targets = [] }) => {
  const targetText = targets.length > 0
    ? targets.map((target) => `- ${target}`).join("\n")
    : `- ${challengeTitle}`;

  return [
     "You are verifying a wake-up alarm challenge.",
      "Decide whether the photo clearly shows at least one of these visual targets:",
      targetText,
      "Accept normal real-camera photos when the requested subject is visible, even if the framing or angle is not perfect.",
      "Reject only if the requested subject is missing, too blurry, too dark, blocked, or the photo shows an unrelated subject.",
      "Reply with exactly one word only: YES or NO.",
  ].join("\n");
};

const withTimeout = (promise, timeoutMs) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Gemini request timeout")), timeoutMs);
    }),
  ]);

export const verifyImageWithGemini = async ({
  image,
  challengeTitle,
  challengeId,
  requestId,
  targets = [],
}) => {
  const optimizeStartedAt = Date.now();
  const optimizedImage = await sharp(image)
    .rotate()
    .resize({ width: IMAGE_OPTIMIZE_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: IMAGE_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  const optimizeDurationMs = Date.now() - optimizeStartedAt;

  logEvent("info", "image.optimized", {
    requestId,
    challengeId,
    durationMs: optimizeDurationMs,
    inputBytes: image.length,
    outputBytes: optimizedImage.length,
    width: IMAGE_OPTIMIZE_WIDTH,
    quality: IMAGE_JPEG_QUALITY,
  });

  const geminiStartedAt = Date.now();
  const response = await withTimeout(
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          inlineData: {
            data: optimizedImage.toString("base64"),
            mimeType: "image/jpeg",
          },
        },
        {
          text: buildPrompt({ challengeTitle, targets }),
        },
      ],
      config: {
        temperature: 0,
        maxOutputTokens: 2,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    }),
    GEMINI_TIMEOUT_MS,
  );
  const geminiDurationMs = Date.now() - geminiStartedAt;

  logEvent("info", "gemini.complete", {
    requestId,
    challengeId,
    durationMs: geminiDurationMs,
    model: GEMINI_MODEL,
    timeoutMs: GEMINI_TIMEOUT_MS,
  });

  const text = (response.text ?? "").trim().toUpperCase();
  const success = text === "YES";

  return verificationResponse({
    success,
    confidence: success ? 0.9 : 0.1,
    provider: "gemini-lite",
    message: success
      ? `${challengeTitle} verified.`
      : `Could not verify "${challengeTitle}".`,
  });
};
