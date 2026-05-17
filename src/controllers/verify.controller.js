import { randomUUID } from "node:crypto";
import { z } from "zod";
import { VERIFICATION_STRICTNESS } from "../config/verification.js";
import { runAntiCheatChecks } from "../services/antiCheat.service.js";
import { verifyImageWithGemini } from "../services/gemini.service.js";
import { logEvent } from "../utils/logger.js";
import { errorResponse, verificationResponse } from "../utils/response.js";

const bodySchema = z.object({
  challengeId: z.string().min(1),
  challengeTitle: z.string().min(1),
  capturedAt: z.string().datetime(),
  targets: z.string().optional(),
});

const parseTargets = (targets) => {
  if (!targets) return [];

  try {
    const parsed = JSON.parse(targets);
    return Array.isArray(parsed) ? parsed.filter((target) => typeof target === "string") : [];
  } catch {
    return [];
  }
};

const logComplete = ({ level = "info", requestId, challengeId, status, startedAt, reason }) => {
  logEvent(level, "complete", {
    requestId,
    challengeId,
    status,
    durationMs: Date.now() - startedAt,
    reason,
  });
};

export const verifyWakeChallenge = async (req, res) => {
  const startedAt = Date.now();
  const requestId = randomUUID();

  try {
    if (!req.file) {
      logComplete({
        level: "warn",
        requestId,
        status: 400,
        startedAt,
        reason: "missing_image",
      });

      return res.status(400).json(errorResponse("Image capture is required."));
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      logComplete({
        level: "warn",
        requestId,
        status: 400,
        startedAt,
        reason: "invalid_payload",
      });

      return res.status(400).json(
        errorResponse("Invalid verification payload.", {
          errors: parsed.error.flatten(),
        }),
      );
    }

    const payload = parsed.data;
    const targets = parseTargets(payload.targets);

    const antiCheat = await runAntiCheatChecks({
      image: req.file.buffer,
      mimetype: req.file.mimetype,
      capturedAt: payload.capturedAt,
      strictness: VERIFICATION_STRICTNESS,
    });

    if (!antiCheat.passed) {
      logComplete({
        level: "warn",
        requestId,
        challengeId: payload.challengeId,
        status: 422,
        startedAt,
        reason: antiCheat.reason,
      });

      return res.status(422).json(
        verificationResponse({
          success: false,
          confidence: 0,
          provider: "anti-cheat",
          message: antiCheat.reason,
        }),
      );
    }

    const result = await verifyImageWithGemini({
      image: req.file.buffer,
      challengeTitle: payload.challengeTitle,
      targets,
    });
    const status = result.success ? 200 : 422;

    logComplete({
      level: result.success ? "info" : "warn",
      requestId,
      challengeId: payload.challengeId,
      status,
      startedAt,
      reason: result.success ? undefined : result.message,
    });

    return res.status(status).json(result);
  } catch (error) {
    logComplete({
      level: "error",
      requestId,
      status: 500,
      startedAt,
      reason: error?.message,
    });

    return res.status(500).json(errorResponse("Verification failed."));
  }
};
