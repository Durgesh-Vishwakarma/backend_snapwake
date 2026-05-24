import { verifyGoogleIdToken } from "../services/googleAuth.service.js";
import { errorResponse } from "../utils/response.js";

export async function signInWithGoogle(req, res) {
  const idToken = req.body?.idToken;

  if (!idToken || typeof idToken !== "string") {
    return res.status(400).json(errorResponse("Google ID token is required."));
  }

  try {
    const { token, user } = await verifyGoogleIdToken(idToken);

    return res.status(200).json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    return res.status(401).json(errorResponse(error.message || "Google sign-in failed."));
  }
}
