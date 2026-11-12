const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map();

export const authRateLimit = (req, res, next) => {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const attempt = attempts.get(key);

  if (!attempt || now >= attempt.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }
  if (attempt.count >= MAX_ATTEMPTS) {
    res.set("Retry-After", String(Math.max(1, Math.ceil((attempt.resetAt - now) / 1000))));
    return res.status(429).json({ success: false, message: "Too many authentication attempts. Please try again later." });
  }
  attempt.count += 1;
  return next();
};
