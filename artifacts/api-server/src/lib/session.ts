import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { db, gameStateTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface CampaignSession {
  role: "gm" | "player";
  activeCharacterId: string | null;
  expiresAt: number;
}
const COOKIE = "campaign_session";
const YEAR = 365 * 24 * 60 * 60 * 1000;

function sessionId(req: Request) {
  const token = req.cookies?.[COOKIE];
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
  return `session:${createHash("sha256").update(token).digest("hex")}`;
}

export async function readSession(req: Request): Promise<CampaignSession | null> {
  const id = sessionId(req);
  if (!id) return null;
  const [record] = await db.select().from(gameStateTable).where(eq(gameStateTable.id, id)).limit(1);
  const session = record?.state as unknown as CampaignSession | undefined;
  if (!session || session.expiresAt <= Date.now()) return null;
  return session;
}

export async function destroySession(req: Request, res: Response) {
  const id = sessionId(req);
  if (id) await db.delete(gameStateTable).where(eq(gameStateTable.id, id));
  res.clearCookie(COOKIE, { path: "/", httpOnly: true, sameSite: "lax" });
}

export async function createSession(req: Request, res: Response, role: CampaignSession["role"], activeCharacterId: string | null = null) {
  await destroySession(req, res);
  const token = randomBytes(32).toString("hex");
  const state: CampaignSession = { role, activeCharacterId, expiresAt: Date.now() + YEAR };
  await db.insert(gameStateTable).values({
    id: `session:${createHash("sha256").update(token).digest("hex")}`,
    state: { ...state },
  });
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: YEAR,
    secure: req.secure || req.get("x-forwarded-proto") === "https",
  });
}
