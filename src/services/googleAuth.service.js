import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { GOOGLE_WEB_CLIENT_ID, JWT_SECRET } from "../config/env.js";

const googleClient = new OAuth2Client(GOOGLE_WEB_CLIENT_ID);

function assertGoogleAuthConfig() {
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error("GOOGLE_WEB_CLIENT_ID is not configured.");
  }

  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }
}

function buildUserFromPayload(payload) {
  return {
    avatar: payload.picture ?? null,
    email: payload.email ?? null,
    id: payload.sub,
    name: payload.name ?? payload.email ?? "Snapwake user",
  };
}

export async function verifyGoogleIdToken(idToken) {
  assertGoogleAuthConfig();

  const ticket = await googleClient.verifyIdToken({
    audience: GOOGLE_WEB_CLIENT_ID,
    idToken,
  });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) {
    throw new Error("Google account payload is incomplete.");
  }

  const user = buildUserFromPayload(payload);
  const token = jwt.sign(
    {
      email: user.email,
      name: user.name,
      provider: "google",
    },
    JWT_SECRET,
    {
      expiresIn: "30d",
      issuer: "snapwake",
      subject: user.id,
    },
  );

  return { token, user };
}
