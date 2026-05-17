import fs from "fs";
import path from "path";

const DEFAULT_API = "http://localhost:4000";
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const getMimeType = (ext) => {
  switch (ext) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".jpg":
    case ".jpeg":
    default:
      return "image/jpeg";
  }
};

const listImages = (dir) => {
  return fs
    .readdirSync(dir)
    .filter((file) => IMAGE_EXTS.has(path.extname(file).toLowerCase()))
    .map((file) => path.join(dir, file));
};

const buildFormData = ({ filePath, challengeTitle, targets }) => {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = getMimeType(ext);
  const blob = new Blob([buffer], { type: mimeType });

  const formData = new FormData();
  formData.append("image", blob, path.basename(filePath));
  formData.append("alarmId", "manual-test");
  formData.append("challengeId", "manual-test");
  formData.append("challengeTitle", challengeTitle);
  formData.append("capturedAt", new Date().toISOString());
  formData.append("targets", JSON.stringify(targets));

  return { formData, mimeType };
};

const run = async () => {
  const [dirArg, apiArg, challengeArg] = process.argv.slice(2);
  if (!dirArg) {
    console.error(
      "Usage: node test/run-verify.js <imageDir> [apiBaseUrl] [challengeTitle]",
    );
    process.exit(1);
  }

  const dirPath = path.resolve(dirArg);
  const apiBaseUrl = apiArg || DEFAULT_API;
  const challengeTitle = challengeArg || "toothbrush";
  const targets = [challengeTitle];

  if (!fs.existsSync(dirPath)) {
    console.error(`Directory not found: ${dirPath}`);
    process.exit(1);
  }

  const images = listImages(dirPath);
  if (images.length === 0) {
    console.error("No images found (.jpg, .jpeg, .png, .webp).");
    process.exit(1);
  }

  console.log(`Testing ${images.length} images against ${apiBaseUrl}`);

  for (const filePath of images) {
    const { formData } = buildFormData({
      filePath,
      challengeTitle,
      targets,
    });

    try {
      const response = await fetch(`${apiBaseUrl}/api/verify`, {
        method: "POST",
        body: formData,
      });

      const text = await response.text();
      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }

      const statusLabel = response.ok ? "OK" : "FAIL";
      console.log(`\n${statusLabel} ${path.basename(filePath)}`);
      console.log(JSON.stringify(payload, null, 2));
    } catch (error) {
      console.log(`\nERROR ${path.basename(filePath)}`);
      console.log(error?.message || error);
    }
  }
};

run();
