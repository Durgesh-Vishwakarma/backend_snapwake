import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from "../config/env.js";
import { GEMINI_MODEL, GEMINI_TIMEOUT_MS } from "../config/verification.js";
import { logEvent } from "../utils/logger.js";
import { verificationResponse } from "../utils/response.js";

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const buildPrompt = ({ challengeTitle, targets = [] }) => {
  if (targets.length > 0) {
    return `Target can be one of: ${targets.join(", ")}. Does the image clearly show at least one target? Reply only YES or NO.`;
  }

  return `Target: ${challengeTitle}. Does the image clearly show this target? Reply only YES or NO.`;
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
  imageMimeType = "image/jpeg",
  requestId,
  targets = [],
}) => {
  const geminiStartedAt = Date.now();
  const response = await withTimeout(
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          inlineData: {
            data: image.toString("base64"),
            mimeType: imageMimeType,
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
    imageBytes: image.length,
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
