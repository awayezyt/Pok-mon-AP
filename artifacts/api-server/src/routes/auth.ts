import { Router, type IRouter } from "express";
import { db, gameStateTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createSession, destroySession, readSession } from "../lib/session";

const router: IRouter = Router();

router.post("/auth/gm", async (req, res): Promise<void> => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const expected = process.env.GM_PASSWORD;

  if (!expected) {
    req.log.error("GM secret is not configured");
    res.status(503).json({ ok: false, error: "GM access is not configured." });
    return;
  }

  if (password.length === 0 || password !== expected) {
    res.status(401).json({ ok: false, error: "Invalid GM password." });
    return;
  }

  await createSession(req, res, "gm");
  res.json({ ok: true });
});

router.post("/auth/player", async (req, res): Promise<void> => {
  const [record] = await db.select().from(gameStateTable).where(eq(gameStateTable.id, "shared-campaign")).limit(1);
  const characters = (record?.state.characters ?? []) as Array<{ id: string; accessCode: string }>;
  const character = characters.find(item => item.id === req.body?.characterId);
  if (!character || typeof req.body?.password !== "string" || !req.body.password || req.body.password !== character.accessCode) {
    res.status(401).json({ ok: false, error: "Senha da ficha incorreta." });
    return;
  }
  await createSession(req, res, "player", character.id);
  res.json({ ok: true });
});

router.get("/auth/session", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const session = await readSession(req);
  res.json(session ? { role: session.role, activeCharacterId: session.activeCharacterId } : { role: "public", activeCharacterId: null });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  await destroySession(req, res);
  res.json({ ok: true });
});

export default router;