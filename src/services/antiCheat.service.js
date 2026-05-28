import { VERIFICATION_STRICTNESS } from "../config/verification.js";
import { prepareVerificationImage } from "./imagePreparation.service.js";

export const runAntiCheatChecks = async ({
  image,
  mimetype,
  capturedAt,
  strictness = VERIFICATION_STRICTNESS,
}) => {
  const result = await prepareVerificationImage({
    image,
    mimetype,
    capturedAt,
    strictness,
  });

  return {
    passed: result.passed,
    reason: result.reason,
    metrics: result.metrics,
  };
};
