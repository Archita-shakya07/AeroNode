import crypto from "node:crypto";
import jwt from "jsonwebtoken";

// Both signing secrets are derived from the single provisioned
// SESSION_SECRET so no extra secret provisioning is required. Deriving two
// independent-looking keys (via HMAC with distinct labels) means a leaked
// access-token secret does not also expose the refresh-token secret.
const baseSecret = process.env["SESSION_SECRET"];
if (!baseSecret) {
  throw new Error(
    "SESSION_SECRET must be set. It is used to derive JWT signing secrets.",
  );
}

function derive(label: string): string {
  return crypto.createHmac("sha256", baseSecret!).update(label).digest("hex");
}

const ACCESS_TOKEN_SECRET = derive("collabsphere:access-token");
const REFRESH_TOKEN_SECRET = derive("collabsphere:refresh-token");

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const REFRESH_TOKEN_COOKIE = "collabsphere_refresh_token";

export type AccessTokenPayload = {
  sub: number;
  name: string;
  email: string;
  avatarColor: string;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as AccessTokenPayload &
    jwt.JwtPayload;
}

/** Raw refresh token = a random opaque string signed as a JWT (carries userId + a random jti). */
export function signRefreshToken(userId: number): {
  token: string;
  jti: string;
  expiresAt: Date;
} {
  const jti = crypto.randomBytes(32).toString("hex");
  const token = jwt.sign({ sub: userId, jti }, REFRESH_TOKEN_SECRET, {
    expiresIn: Math.floor(REFRESH_TOKEN_TTL_MS / 1000),
  });
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  return { token, jti, expiresAt };
}

export function verifyRefreshToken(token: string): {
  sub: number;
  jti: string;
} {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as {
    sub: number;
    jti: string;
  } & jwt.JwtPayload;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const AVATAR_COLORS = [
  "#8b5cf6",
  "#6366f1",
  "#ec4899",
  "#22d3ee",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#3b82f6",
];

export function pickAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;
}
