export const verificationResponse = ({
  success,
  confidence,
  provider,
  message,
}) => ({
  success,
  confidence,
  provider,
  message,
});

export const errorResponse = (message, extra = {}) => ({
  success: false,
  message,
  ...extra,
});
