import { GoogleGenerativeAI } from "@google/generative-ai";
import sharp from "sharp";
import { GEMINI_API_KEY } from "../config/env.js";
import {
  GEMINI_MODEL,
  GEMINI_TIMEOUT_MS,
  IMAGE_JPEG_QUALITY,
  IMAGE_OPTIMIZE_WIDTH,
} from "../config/verification.js";
import { verificationResponse } from "../utils/response.js";

const getClient = () => {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  return new GoogleGenerativeAI(GEMINI_API_KEY);
};

const buildPrompt = ({ challengeTitle, targets = [] }) => {
  const targetText = targets.length > 0 ? targets.join(", ") : challengeTitle;

  return [
    "You are verifying a wake-up alarm challenge.",
    `The image must clearly show: "${targetText}".`,
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
  targets = [],
}) => {
  const optimizedImage = await sharp(image)
    .resize({ width: IMAGE_OPTIMIZE_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: IMAGE_JPEG_QUALITY })
    .toBuffer();

  const model = getClient().getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2,
    },
  });

  const result = await withTimeout(
    model.generateContent([
      {
        inlineData: {
          data: optimizedImage.toString("base64"),
          mimeType: "image/jpeg",
        },
      },
      buildPrompt({ challengeTitle, targets }),
    ]),
    GEMINI_TIMEOUT_MS,
  );

  const text = (await result.response).text().trim().toUpperCase();
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
