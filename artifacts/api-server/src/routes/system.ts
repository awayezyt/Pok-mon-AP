import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { db, gameStateTable } from "@workspace/db";
import {
  CreateSystemEditorSessionBody,
  CreateSystemEditorSessionResponse,
  DeleteSystemEditorSessionResponse,
  GetSystemDocumentsResponse,
  GetSystemCatalogResponse,
  GetSystemEditorSessionResponse,
  SaveSystemCatalogBody,
  SaveSystemCatalogResponse,
  SaveSystemDocumentBody,
  SaveSystemDocumentParams,
  SaveSystemDocumentResponse,
} from "@workspace/api-zod";
import { eq, like } from "drizzle-orm";
import {
  grantSystemEditorAccess,
  hasSystemEditorAccess,
  revokeSystemEditorAccess,
} from "../lib/session";

const router: IRouter = Router();
const DOCUMENT_PREFIX = "system-document:";
const CATALOG_ID = "system-index-catalog";

router.get("/system/documents", async (_req, res): Promise<void> => {
  const records = await db
    .select({ id: gameStateTable.id, state: gameStateTable.state })
    .from(gameStateTable)
    .where(like(gameStateTable.id, `${DOCUMENT_PREFIX}%`));
  const documents: Record<string, unknown> = {};
  for (const record of records) {
    const documentId = record.id.slice(DOCUMENT_PREFIX.length);
    const document = record.state.document;
    if (documentId && document && typeof document === "object") {
      documents[documentId] = document;
    }
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(GetSystemDocumentsResponse.parse({ documents }));
});

router.get("/system/catalog", async (_req, res): Promise<void> => {
  const [record] = await db
    .select({ state: gameStateTable.state })
    .from(gameStateTable)
    .where(eq(gameStateTable.id, CATALOG_ID))
    .limit(1);
  const catalog = record?.state.catalog || { sections: [], deletedDocumentIds: [] };
  res.setHeader("Cache-Control", "no-store");
  res.json(GetSystemCatalogResponse.parse({ catalog }));
});

router.put("/system/catalog", async (req, res): Promise<void> => {
  if (!await hasSystemEditorAccess(req)) {
    res.status(401).json({ error: "Acesse o modo de edição antes de salvar." });
    return;
  }
  const parsed = SaveSystemCatalogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (JSON.stringify(parsed.data.catalog).length > 10_000_000) {
    res.status(400).json({ error: "O índice está grande demais." });
    return;
  }
  const [record] = await db
    .insert(gameStateTable)
    .values({
      id: CATALOG_ID,
      state: { catalog: parsed.data.catalog },
      revision: 1,
    })
    .onConflictDoUpdate({
      target: gameStateTable.id,
      set: {
        state: { catalog: parsed.data.catalog },
        revision: gameStateTable.revision,
        updatedAt: new Date(),
      },
    })
    .returning({ state: gameStateTable.state });
  res.json(SaveSystemCatalogResponse.parse({ catalog: record.state.catalog }));
});

router.get("/system/editor-session", async (req, res): Promise<void> => {
  const authorized = await hasSystemEditorAccess(req);
  res.setHeader("Cache-Control", "no-store");
  res.json(GetSystemEditorSessionResponse.parse({ authorized }));
});

router.post("/system/editor-session", async (req, res): Promise<void> => {
  const parsed = CreateSystemEditorSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const expectedPasswords = [process.env.SYSTEM_EDITOR_PASSWORD, process.env.GM_PASSWORD]
    .filter((value): value is string => Boolean(value));
  if (expectedPasswords.length === 0) {
    req.log.error("System editor secret is not configured");
    res.status(503).json({ error: "A senha de edição não está configurada no servidor." });
    return;
  }

  const actualHash = createHash("sha256").update(parsed.data.password).digest();
  let authorized = false;
  for (const expected of expectedPasswords) {
    const expectedHash = createHash("sha256").update(expected).digest();
    authorized = timingSafeEqual(actualHash, expectedHash) || authorized;
  }
  if (!authorized) {
    res.status(401).json({ error: "Senha incorreta." });
    return;
  }

  await grantSystemEditorAccess(req, res);
  res.json(CreateSystemEditorSessionResponse.parse({ authorized: true }));
});

router.delete("/system/editor-session", async (req, res): Promise<void> => {
  await revokeSystemEditorAccess(req, res);
  res.json(DeleteSystemEditorSessionResponse.parse({ authorized: false }));
});

router.put("/system/documents/:documentId", async (req, res): Promise<void> => {
  if (!await hasSystemEditorAccess(req)) {
    res.status(401).json({ error: "Acesse o modo de edição antes de salvar." });
    return;
  }
  const params = SaveSystemDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SaveSystemDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const document = parsed.data.document as Record<string, unknown>;
  if (
    !document
    || typeof document !== "object"
    || Array.isArray(document)
    || document.id !== params.data.documentId
    || !Array.isArray(document.blocks)
    || JSON.stringify(document).length > 10_000_000
  ) {
    res.status(400).json({ error: "O documento está incompleto ou é grande demais." });
    return;
  }

  const [record] = await db
    .insert(gameStateTable)
    .values({
      id: `${DOCUMENT_PREFIX}${params.data.documentId}`,
      state: { document },
      revision: 1,
    })
    .onConflictDoUpdate({
      target: gameStateTable.id,
      set: {
        state: { document },
        revision: gameStateTable.revision,
        updatedAt: new Date(),
      },
    })
    .returning({ state: gameStateTable.state });

  res.json(SaveSystemDocumentResponse.parse({
    document: record.state.document,
  }));
});

export default router;
