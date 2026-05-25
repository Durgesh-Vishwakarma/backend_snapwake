import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { GOOGLE_WEB_CLIENT_ID, JWT_EXPIRES_IN, JWT_SECRET } from "../config/env.js";
import { upsertGoogleUser } from "../repositories/user.repository.js";
import { logEvent } from "../utils/logger.js";
import { errorResponse } from "../utils/response.js";

const googleClient = new OAuth2Client(GOOGLE_WEB_CLIENT_ID);

function getSafeErrorMessage(error) {
  if (error.message?.includes("DATABASE_URL")) {
    return "Database is not configured.";
  }

  if (error.message?.includes("GOOGLE_WEB_CLIENT_ID")) {
    return "Google sign-in is not configured.";
  }

  if (error.message?.includes("JWT_SECRET")) {
    return "Authentication token signing is not configured.";
  }

  return "Google sign-in failed.";
}

async function verifyGoogleToken(idToken) {
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error("GOOGLE_WEB_CLIENT_ID is not configured.");
  }

  let ticket;

  try {
    ticket = await googleClient.verifyIdToken({
      audience: GOOGLE_WEB_CLIENT_ID,
      idToken,
    });
  } catch {
    const error = new Error("Google token is invalid or expired.");
    error.statusCode = 401;
    throw error;
  }

  return ticket.getPayload();
}

function signSnapwakeToken(user) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    {
      email: user.email,
      provider: "google",
      sub: user.id,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      issuer: "snapwake",
    },
  );
}

export async function googleAuth(req, res) {
  const idToken = req.body?.idToken;

  if (!idToken || typeof idToken !== "string") {
    return res.status(400).json(errorResponse("Google ID token is required."));
  }

  try {
    const payload = await verifyGoogleToken(idToken);

    if (!payload?.sub || !payload.email) {
      return res.status(401).json(errorResponse("Google token payload is incomplete."));
    }

    if (payload.email_verified !== true) {
      return res.status(401).json(errorResponse("Google email is not verified."));
    }

    const user = await upsertGoogleUser({
      email: payload.email,
      googleId: payload.sub,
      name: payload.name ?? null,
    });
    const token = signSnapwakeToken(user);

    return res.status(200).json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    logEvent("auth", "google_sign_in_failed", {
      message: error.message,
      name: error.name,
    });

    if (error.statusCode === 401) {
      return res.status(401).json(errorResponse(error.message));
    }

    return res.status(500).json(errorResponse(getSafeErrorMessage(error)));
  }
}
