import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, gameStateTable } from "@workspace/db";
import {
  collectCampaignImages,
  getCachedCampaignImage,
  parseCampaignImageDataUrl,
  rememberCampaignImages,
} from "../lib/campaign-media";

const router: IRouter = Router();
const SHARED_STATE_ID = "shared-campaign";

function matchesIfNoneMatch(value: string | undefined, etag: string) {
  return value?.split(",").some(candidate => {
    const normalized = candidate.trim();
    return normalized === "*" || normalized === etag || normalized === `W/${etag}`;
  }) ?? false;
}

router.get("/media/:hash", async (req, res): Promise<void> => {
  const rawHash = Array.isArray(req.params.hash) ? req.params.hash[0] : req.params.hash;
  const hash = rawHash?.toLowerCase();
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) {
    res.status(400).json({ error: "Invalid image reference." });
    return;
  }

  let dataUrl = getCachedCampaignImage(hash);
  if (!dataUrl) {
    const [record] = await db
      .select({ state: gameStateTable.state })
      .from(gameStateTable)
      .where(eq(gameStateTable.id, SHARED_STATE_ID))
      .limit(1);
    if (!record) {
      res.status(404).json({ error: "Campaign image not found." });
      return;
    }

    const images = collectCampaignImages(record.state);
    rememberCampaignImages(images);
    dataUrl = getCachedCampaignImage(hash);
  }

  const image = dataUrl ? parseCampaignImageDataUrl(dataUrl) : null;
  if (!image || image.hash !== hash) {
    res.status(404).json({ error: "Campaign image not found." });
    return;
  }

  const etag = `"${hash}"`;
  res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  res.setHeader("ETag", etag);
  res.setHeader("Content-Type", image.contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (matchesIfNoneMatch(req.get("If-None-Match"), etag)) {
    res.status(304).end();
    return;
  }

  res.status(200).send(Buffer.from(image.base64, "base64"));
});

export default router;
