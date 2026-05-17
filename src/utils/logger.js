const formatDetails = (details = {}) =>
  Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(" ");

export const logEvent = (level, event, details = {}) => {
  const line = `[${new Date().toISOString()}] [verify] ${event}`;
  const suffix = formatDetails(details);
  const message = suffix ? `${line} ${suffix}` : line;

  if (level === "error") {
    console.error(message);
    return;
  }

  if (level === "warn") {
    console.warn(message);
    return;
  }

  console.info(message);
};

export const logVerificationEvent = logEvent;
