import "dotenv/config";

export const PORT = Number(process.env.PORT || 4000);
export const DATABASE_URL = process.env.DATABASE_URL;
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";
export const JWT_SECRET = process.env.JWT_SECRET;
export const NODE_ENV = process.env.NODE_ENV || "development";

if (!GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY is missing. Verification requests will fail.");
}

if (!GOOGLE_WEB_CLIENT_ID) {
  console.warn("WARNING: GOOGLE_WEB_CLIENT_ID is missing. Google sign-in will fail.");
}

if (!JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET is missing. Google sign-in will fail.");
}
