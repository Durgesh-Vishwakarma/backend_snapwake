import { Router } from "express";
import { signInWithGoogle } from "../controllers/auth.controller.js";

export const authRouter = Router();

authRouter.post("/google", signInWithGoogle);
