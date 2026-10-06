import { Router, type IRouter } from "express";
import { db, gameStateTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { readSession } from "../lib/session";

const router: IRouter = Router();
const SHARED_STATE_ID = "shared-campaign";

function visibleState(state: Record<string, unknown>, isGM: boolean) {
  if (isGM) return state;
  const { gmHistory: _privateHistory, ...publicState } = state;
  return publicState;
}

function stateEtag(revision: number) {
  return `"campaign-state-${revision}"`;
}

function protectLegacyCharacterData(
  currentState: Record<string, unknown> | undefined,
  incomingPatch: Record<string, unknown>,
) {
  const currentCharacters = Array.isArray(currentState?.characters)
    ? currentState.characters as Array<Record<string, unknown>>
    : [];
  const incomingCharacters = Array.isArray(incomingPatch.characters)
    ? incomingPatch.characters as Array<Record<string, unknown>>
    : null;

  if (!incomingCharacters || !currentCharacters.length) return incomingPatch;

  const protectedCharacters = incomingCharacters.map(character => {
    const previous = currentCharacters.find(item => item.id === character.id);
    const isLegacySabine = character.id === "character-lyra"
      && character.name === "Sabine";
    if (!previous || !isLegacySabine) return character;

    const next = { ...character };
    for (const field of ["inventory", "abilities"] as const) {
      const previousValue = previous[field];
      const incomingValue = character[field];
      if (Array.isArray(previousValue) && previousValue.length > 0
        && Array.isArray(incomingValue) && incomingValue.length === 0) {
        next[field] = previousValue;
      }
    }
    return next;
  });

  return { ...incomingPatch, characters: protectedCharacters };
}

router.get("/state", async (req, res): Promise<void> => {
  const session = await readSession(req);
  res.setHeader("Cache-Control", "no-store");
  const [metadata] = await db
    .select({ revision: gameStateTable.revision })
    .from(gameStateTable)
    .where(eq(gameStateTable.id, SHARED_STATE_ID))
    .limit(1);

  const revision = metadata?.revision ?? 0;
  const etag = stateEtag(revision);
  res.setHeader("X-State-Revision", String(revision));
  res.setHeader("ETag", etag);

  const requestedEtags = req.get("If-None-Match")
    ?.split(",")
    .map(value => value.trim());
  if (requestedEtags?.includes(etag) || requestedEtags?.includes("*")) {
    res.status(304).end();
    return;
  }

  if (!metadata) {
    res.json({});
    return;
  }

  const [record] = await db
    .select({ state: gameStateTable.state, revision: gameStateTable.revision })
    .from(gameStateTable)
    .where(eq(gameStateTable.id, SHARED_STATE_ID))
    .limit(1);
  if (!record) {
    res.json({});
    return;
  }

  // A write may land between the lightweight revision check and this read.
  // Return the exact revision that belongs to the payload.
  res.setHeader("X-State-Revision", String(record.revision));
  res.setHeader("ETag", stateEtag(record.revision));
  res.json(visibleState(record.state, session?.role === "gm"));
});

router.put("/state", async (req, res): Promise<void> => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "State payload must be an object." });
    return;
  }

  const requestedPatch = req.body as Record<string, unknown>;
  const session = await readSession(req);
  if (session?.role !== "gm" && ("gmHistory" in requestedPatch || "formulaSettings" in requestedPatch)) {
    res.status(403).json({ error: "Somente o mestre pode alterar estes dados." });
    return;
  }
  const [existing] = await db
    .select()
    .from(gameStateTable)
    .where(eq(gameStateTable.id, SHARED_STATE_ID))
    .limit(1);
  const patch = protectLegacyCharacterData(
    existing?.state as Record<string, unknown> | undefined,
    requestedPatch,
  );
  const [record] = await db
    .insert(gameStateTable)
    .values({
      id: SHARED_STATE_ID,
      state: patch,
      revision: 1,
    })
    .onConflictDoUpdate({
      target: gameStateTable.id,
      set: {
        // PostgreSQL merges JSON objects atomically, so simultaneous edits
        // to different collections are not lost when requests overlap.
        state: sql`coalesce(${gameStateTable.state}, '{}'::jsonb) || excluded.state`,
        revision: sql`${gameStateTable.revision} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.setHeader("X-State-Revision", String(record.revision));
  res.setHeader("ETag", stateEtag(record.revision));
  res.json(visibleState(record.state, session?.role === "gm"));
});

export default router;