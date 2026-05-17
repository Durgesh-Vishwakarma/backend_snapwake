import multer from 'multer';
import { MAX_UPLOAD_SIZE_MB } from '../config/verification.js';

const storage = multer.memoryStorage();
const allowedMimes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const uploadLiveCapture = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !allowedMimes.has(file.mimetype)) {
      return cb(new Error("Unsupported image format. Please upload JPEG, PNG, or WebP."));
    }

    cb(null, true);
  },
});

