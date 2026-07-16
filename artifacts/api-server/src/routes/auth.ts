import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, refreshTokensTable } from "@workspace/db";
import {
  SignupBody,
  SignupResponse,
  LoginBody,
  LoginResponse,
  RefreshResponse,
  GetMeResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
  ChangePasswordBody,
} from "@workspace/api-zod";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  pickAvatarColor,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_TTL_MS,
} from "../lib/auth";
import { requireAuth } from "../middlewares/require-auth";

const router: IRouter = Router();

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env["NODE_ENV"] === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: REFRESH_TOKEN_TTL_MS,
};

async function issueSession(userId: number) {
  const { token, jti, expiresAt } = signRefreshToken(userId);
  await db.insert(refreshTokensTable).values({
    userId,
    tokenHash: hashToken(jti),
    expiresAt,
  });
  return token;
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email));
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const avatarColor = pickAvatarColor();
  const [user] = await db
    .insert(usersTable)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      avatarColor,
    })
    .returning();

  const refreshToken = await issueSession(user!.id);
  const accessToken = signAccessToken({
    sub: user!.id,
    name: user!.name,
    email: user!.email,
    avatarColor: user!.avatarColor,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
  res.status(201).json(
    SignupResponse.parse({
      user: {
        id: user!.id,
        name: user!.name,
        email: user!.email,
        avatarColor: user!.avatarColor,
        createdAt: user!.createdAt,
      },
      accessToken,
    }),
  );
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email));
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const refreshToken = await issueSession(user.id);
  const accessToken = signAccessToken({
    sub: user.id,
    name: user.name,
    email: user.email,
    avatarColor: user.avatarColor,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
  res.json(
    LoginResponse.parse({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarColor: user.avatarColor,
        createdAt: user.createdAt,
      },
      accessToken,
    }),
  );
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const token = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (!token || typeof token !== "string") {
    res.status(401).json({ error: "Missing refresh token" });
    return;
  }

  let payload: { sub: number; jti: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    res.clearCookie(REFRESH_TOKEN_COOKIE, REFRESH_COOKIE_OPTIONS);
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  const [stored] = await db
    .select()
    .from(refreshTokensTable)
    .where(eq(refreshTokensTable.tokenHash, hashToken(payload.jti)));

  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    res.clearCookie(REFRESH_TOKEN_COOKIE, REFRESH_COOKIE_OPTIONS);
    res.status(401).json({ error: "Refresh token no longer valid" });
    return;
  }

  // Rotate: delete the old refresh token, issue a new one.
  await db.delete(refreshTokensTable).where(eq(refreshTokensTable.id, stored.id));

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, payload.sub));
  if (!user) {
    res.clearCookie(REFRESH_TOKEN_COOKIE, REFRESH_COOKIE_OPTIONS);
    res.status(401).json({ error: "User no longer exists" });
    return;
  }

  const newRefreshToken = await issueSession(user.id);
  const accessToken = signAccessToken({
    sub: user.id,
    name: user.name,
    email: user.email,
    avatarColor: user.avatarColor,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, newRefreshToken, REFRESH_COOKIE_OPTIONS);
  res.json(RefreshResponse.parse({ accessToken }));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (token && typeof token === "string") {
    try {
      const payload = verifyRefreshToken(token);
      await db
        .delete(refreshTokensTable)
        .where(eq(refreshTokensTable.tokenHash, hashToken(payload.jti)));
    } catch {
      // Already invalid/expired -- nothing to revoke.
    }
  }
  res.clearCookie(REFRESH_TOKEN_COOKIE, REFRESH_COOKIE_OPTIONS);
  res.sendStatus(204);
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(401).json({ error: "User no longer exists" });
    return;
  }
  res.json(
    GetMeResponse.parse({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatarColor,
      createdAt: user.createdAt,
    }),
  );
});

router.patch("/auth/me/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.avatarColor !== undefined) updates.avatarColor = parsed.data.avatarColor;

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.json(
    UpdateProfileResponse.parse({
      id: user!.id,
      name: user!.name,
      email: user!.email,
      avatarColor: user!.avatarColor,
      createdAt: user!.createdAt,
    }),
  );
});

router.post("/auth/me/password", requireAuth, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, req.userId!));

  res.sendStatus(204);
});

export default router;
