import { Router, type IRouter } from "express";
import { db, gameStateTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { readSession } from "../lib/session";
import {
  collectCampaignImages,
  externalizeCampaignImages,
  rememberCampaignImages,
  restoreCampaignImageReferences,
} from "../lib/campaign-media";

const router: IRouter = Router();
const SHARED_STATE_ID = "shared-campaign";

function visibleState(state: Record<string, unknown>, isGM: boolean) {
  if (isGM) return state;
  const { gmHistory: _privateHistory, gmBoard: _privateBoard, ...publicState } = state;
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

  if (!incomingCharacters || !currentCharacters.length) {
    return { patch: incomingPatch, changed: false };
  }

  let changed = false;
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
        changed = true;
      }
    }
    return next;
  });

  return {
    patch: { ...incomingPatch, characters: protectedCharacters },
    changed,
  };
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
  const state = visibleState(record.state, session?.role === "gm");
  if (req.query.media === "refs") {
    const images = collectCampaignImages(state);
    rememberCampaignImages(images);
    res.json(externalizeCampaignImages(state));
    return;
  }
  res.json(state);
});

router.put("/state", async (req, res): Promise<void> => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "State payload must be an object." });
    return;
  }

  const requestedPatch = req.body as Record<string, unknown>;
  const session = await readSession(req);
  if (session?.role !== "gm" && ("gmHistory" in requestedPatch || "gmBoard" in requestedPatch || "formulaSettings" in requestedPatch)) {
    res.status(403).json({ error: "Somente o mestre pode alterar estes dados." });
    return;
  }
  const [existing] = await db
    .select()
    .from(gameStateTable)
    .where(eq(gameStateTable.id, SHARED_STATE_ID))
    .limit(1);
  const currentState = existing?.state as Record<string, unknown> | undefined;
  const currentImages = collectCampaignImages(currentState);
  rememberCampaignImages(currentImages);
  const restored = restoreCampaignImageReferences(requestedPatch, currentImages);
  if (restored.missingHashes.length > 0) {
    res.status(409).json({ error: "Uma ou mais imagens mudaram. Atualize a campanha e tente novamente." });
    return;
  }
  const protection = protectLegacyCharacterData(currentState, restored.value);
  const patch = protection.patch;
  const currentRevision = existing?.revision ?? 0;
  const ifMatch = req.get("If-Match")?.match(/^"campaign-state-(\d+)"$/);
  const clientRevision = ifMatch ? Number(ifMatch[1]) : null;
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

  rememberCampaignImages(collectCampaignImages(record.state));
  res.setHeader("X-State-Revision", String(record.revision));
  res.setHeader("ETag", stateEtag(record.revision));
  res.vary("Prefer");
  const wantsMinimal = req.get("Prefer")
    ?.split(",")
    .some(preference => /^return=minimal(?:;|$)/.test(preference.trim()));
  if (wantsMinimal) {
    // A compact acknowledgement is safe only when the sender's snapshot was
    // current and the server did not need to preserve legacy character data.
    // Otherwise the client performs one conditional refresh to merge changes.
    const refreshRequired = clientRevision === null
      || clientRevision !== currentRevision
      || record.revision !== currentRevision + 1
      || protection.changed;
    res.setHeader("Preference-Applied", "return=minimal");
    res.setHeader("X-State-Refresh-Required", String(refreshRequired));
    res.status(204).end();
    return;
  }

  // Keep the full response for clients that have not opted into the compact
  // acknowledgement yet, so older deployed frontends remain compatible.
  res.json(visibleState(record.state, session?.role === "gm"));
});

export default router;