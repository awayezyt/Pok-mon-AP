import { createHash } from "node:crypto";

export const CAMPAIGN_MEDIA_PREFIX = "/api/media/";

const imageFieldNames = new Set(["image", "imageUrl"]);
const imageDataUrlPattern = /^data:(image\/[a-z0-9!#$&^_.+-]+);base64,([\s\S]*)$/i;
const mediaReferencePattern = /^\/api\/media\/([a-f0-9]{64})$/i;
const maxCacheEntries = 128;
const maxCacheBytes = 32 * 1024 * 1024;

export interface CampaignImageData {
  hash: string;
  dataUrl: string;
  contentType: string;
  base64: string;
}

export function hasInvalidCampaignImageLinks(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasInvalidCampaignImageLinks);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => {
    if (imageFieldNames.has(key)) {
      if (child === null || child === undefined || child === "") return false;
      if (typeof child !== "string") return true;
      try {
        const url = new URL(child);
        return url.protocol !== "https:" || Boolean(url.username || url.password);
      } catch {
        return true;
      }
    }
    return hasInvalidCampaignImageLinks(child);
  });
}

const imageCache = new Map<string, string>();
let imageCacheBytes = 0;

export function parseCampaignImageDataUrl(value: string): CampaignImageData | null {
  const match = imageDataUrlPattern.exec(value);
  if (!match) return null;

  const base64 = match[2].replace(/\s/g, "");
  if (!base64 || !/^[a-z0-9+/]*={0,2}$/i.test(base64) || base64.length % 4 === 1) {
    return null;
  }

  const normalizedBase64 = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const bytes = Buffer.from(normalizedBase64, "base64");
  if (bytes.length === 0) return null;

  return {
    hash: createHash("sha256").update(value).digest("hex"),
    dataUrl: value,
    contentType: match[1].toLowerCase(),
    base64: normalizedBase64,
  };
}

function walkImageFields(
  value: unknown,
  visit: (value: string) => string,
): unknown {
  if (Array.isArray(value)) {
    return value.map(item => walkImageFields(item, visit));
  }
  if (!value || typeof value !== "object") return value;

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (imageFieldNames.has(key) && typeof child === "string") {
      result[key] = visit(child);
    } else {
      result[key] = walkImageFields(child, visit);
    }
  }
  return result;
}

export function collectCampaignImages(value: unknown): Map<string, CampaignImageData> {
  const images = new Map<string, CampaignImageData>();
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") return;

    for (const [key, child] of Object.entries(node)) {
      if (imageFieldNames.has(key) && typeof child === "string") {
        const image = parseCampaignImageDataUrl(child);
        if (image) images.set(image.hash, image);
      } else {
        visit(child);
      }
    }
  };
  visit(value);
  return images;
}

export function externalizeCampaignImages<T>(value: T): T {
  return walkImageFields(value, source => {
    const image = parseCampaignImageDataUrl(source);
    return image ? `${CAMPAIGN_MEDIA_PREFIX}${image.hash}` : source;
  }) as T;
}

export function restoreCampaignImageReferences<T>(
  value: T,
  availableImages: ReadonlyMap<string, CampaignImageData>,
): { value: T; missingHashes: string[] } {
  const missing = new Set<string>();
  const restored = walkImageFields(value, source => {
    if (!source.startsWith(CAMPAIGN_MEDIA_PREFIX)) return source;
    const match = mediaReferencePattern.exec(source);
    const hash = match?.[1].toLowerCase();
    const image = hash ? availableImages.get(hash) : undefined;
    if (image) return image.dataUrl;
    missing.add(hash || source.slice(CAMPAIGN_MEDIA_PREFIX.length));
    return source;
  }) as T;

  return { value: restored, missingHashes: [...missing] };
}

export function rememberCampaignImages(images: ReadonlyMap<string, CampaignImageData>) {
  for (const [hash, image] of images) {
    const previous = imageCache.get(hash);
    if (previous) {
      imageCacheBytes -= Buffer.byteLength(previous);
      imageCache.delete(hash);
    }
    imageCache.set(hash, image.dataUrl);
    imageCacheBytes += Buffer.byteLength(image.dataUrl);
  }

  while (imageCache.size > maxCacheEntries || imageCacheBytes > maxCacheBytes) {
    const oldest = imageCache.entries().next().value as [string, string] | undefined;
    if (!oldest) break;
    imageCache.delete(oldest[0]);
    imageCacheBytes -= Buffer.byteLength(oldest[1]);
  }
}

export function getCachedCampaignImage(hash: string): string | undefined {
  const image = imageCache.get(hash);
  if (!image) return undefined;
  imageCache.delete(hash);
  imageCache.set(hash, image);
  return image;
}
