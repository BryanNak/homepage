import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { CONF_DIR } from "utils/config/config";
import createLogger from "utils/logger";

const logger = createLogger("scratchpad");

const SCRATCHPAD_FILE = path.join(CONF_DIR, "scratchpad.enc");
const MAX_BLOCK_TEXT = 64 * 1024;
const MAX_BLOCKS = 500;

let fileLock = Promise.resolve();
function withFileLock(fn) {
  const next = fileLock.then(fn, fn);
  fileLock = next.catch(() => {});
  return next;
}

function passwordMatches(provided, master) {
  const providedHash = crypto
    .createHash("sha256")
    .update(String(provided ?? ""))
    .digest();
  const masterHash = crypto.createHash("sha256").update(master).digest();
  return crypto.timingSafeEqual(providedHash, masterHash);
}

function encrypt(text, master) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(master, salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);

  return JSON.stringify({
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  });
}

function decrypt(payload, master) {
  const { salt, iv, tag, data } = JSON.parse(payload);
  const key = crypto.scryptSync(master, Buffer.from(salt, "base64"), 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

async function readBlocks(master) {
  let payload;
  try {
    payload = await fs.readFile(SCRATCHPAD_FILE, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const raw = decrypt(payload, master);

  try {
    const parsed = JSON.parse(raw);
    if (parsed.version === 2 && Array.isArray(parsed.blocks)) {
      return parsed.blocks;
    }
  } catch {
    // not JSON — v1 plain text, fall through to migration
  }

  if (raw.trim()) {
    return [{ id: crypto.randomUUID(), text: raw, createdAt: Date.now() }];
  }
  return [];
}

async function writeBlocks(blocks, master) {
  const data = JSON.stringify({ version: 2, blocks });
  await fs.writeFile(SCRATCHPAD_FILE, encrypt(data, master), { mode: 0o600 });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const master = process.env.HOMEPAGE_SCRATCHPAD_PASSWORD;
  if (!master) {
    return res.status(503).json({ error: "HOMEPAGE_SCRATCHPAD_PASSWORD is not set" });
  }

  const { action, password, text, id, ids } = req.body ?? {};

  if (!passwordMatches(password, master)) {
    return res.status(401).json({ error: "Wrong password" });
  }

  if (action === "load") {
    try {
      const blocks = await readBlocks(master);
      return res.status(200).json({ blocks });
    } catch (error) {
      logger.error("Scratchpad decryption failed: %s", error.message);
      return res.status(500).json({ error: "Decryption failed" });
    }
  }

  if (action === "add") {
    if (typeof text !== "string" || !text.trim() || text.length > MAX_BLOCK_TEXT) {
      return res.status(400).json({ error: "Invalid text" });
    }
    return withFileLock(async () => {
      const blocks = await readBlocks(master);
      if (blocks.length >= MAX_BLOCKS) {
        return res.status(400).json({ error: "Too many notes" });
      }
      const block = { id: crypto.randomUUID(), text: text.trim(), createdAt: Date.now() };
      blocks.unshift(block);
      await writeBlocks(blocks, master);
      return res.status(200).json({ block });
    });
  }

  if (action === "update") {
    if (typeof id !== "string" || typeof text !== "string" || !text.trim() || text.length > MAX_BLOCK_TEXT) {
      return res.status(400).json({ error: "Invalid input" });
    }
    return withFileLock(async () => {
      const blocks = await readBlocks(master);
      const block = blocks.find((b) => b.id === id);
      if (!block) return res.status(404).json({ error: "Block not found" });
      block.text = text.trim();
      block.updatedAt = Date.now();
      await writeBlocks(blocks, master);
      return res.status(200).json({ block });
    });
  }

  if (action === "delete") {
    if (typeof id !== "string") {
      return res.status(400).json({ error: "Invalid id" });
    }
    return withFileLock(async () => {
      const blocks = await readBlocks(master);
      const idx = blocks.findIndex((b) => b.id === id);
      if (idx === -1) return res.status(404).json({ error: "Block not found" });
      blocks.splice(idx, 1);
      await writeBlocks(blocks, master);
      return res.status(200).json({ deleted: true });
    });
  }

  if (action === "delete-many") {
    if (!Array.isArray(ids) || ids.length === 0 || ids.some((i) => typeof i !== "string")) {
      return res.status(400).json({ error: "Invalid ids" });
    }
    return withFileLock(async () => {
      const blocks = await readBlocks(master);
      const idSet = new Set(ids);
      const remaining = blocks.filter((b) => !idSet.has(b.id));
      await writeBlocks(remaining, master);
      return res.status(200).json({ deleted: blocks.length - remaining.length });
    });
  }

  return res.status(400).json({ error: "Unknown action" });
}
