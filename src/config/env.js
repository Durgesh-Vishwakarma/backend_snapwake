import "dotenv/config";

export const PORT = Number(process.env.PORT || 4000);
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const NODE_ENV = process.env.NODE_ENV || "development";

if (!GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY is missing. Verification requests will fail.");
}
