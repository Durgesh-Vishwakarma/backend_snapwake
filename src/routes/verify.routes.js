import { Router } from 'express';
import { verifyWakeChallenge } from '../controllers/verify.controller.js';
import { uploadLiveCapture } from '../middleware/upload.middleware.js';

export const verifyRouter = Router();

verifyRouter.post('/', uploadLiveCapture.single('image'), verifyWakeChallenge);
