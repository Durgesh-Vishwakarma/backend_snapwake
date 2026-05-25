import { Router } from "express";
import { googleAuth } from "../controllers/auth.controller.js";

export const authRouter = Router();

authRouter.post("/google", googleAuth);
