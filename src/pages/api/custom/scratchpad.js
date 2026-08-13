import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { CONF_DIR } from "utils/config/config";
import createLogger from "utils/logger";

const logger = createLogger("scratchpad");

const SCRATCHPAD_FILE = path.join(CONF_DIR, "scratchpad.enc");
const MAX_TEXT_LENGTH = 256 * 1024;

function passwordMatches(provided, master) {
  // hash both sides so timingSafeEqual gets equal-length buffers
  const providedHash = crypto.createHash("sha256").update(String(provided ?? "")).digest();
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const master = process.env.HOMEPAGE_SCRATCHPAD_PASSWORD;
  if (!master) {
    return res.status(503).json({ error: "HOMEPAGE_SCRATCHPAD_PASSWORD is not set" });
  }

  const { action, password, text } = req.body ?? {};

  if (!passwordMatches(password, master)) {
    return res.status(401).json({ error: "Wrong password" });
  }

  if (action === "save") {
    if (typeof text !== "string" || text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ error: "Invalid text" });
    }
    await fs.writeFile(SCRATCHPAD_FILE, encrypt(text, master), { mode: 0o600 });
    return res.status(200).json({ saved: true });
  }

  if (action === "load") {
    let payload;
    try {
      payload = await fs.readFile(SCRATCHPAD_FILE, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return res.status(200).json({ text: "" });
      throw error;
    }

    try {
      return res.status(200).json({ text: decrypt(payload, master) });
    } catch (error) {
      // wrong key or tampered file: GCM authentication fails
      logger.error("Scratchpad decryption failed: %s", error.message);
      return res.status(500).json({ error: "Decryption failed" });
    }
  }

  return res.status(400).json({ error: "Unknown action" });
}
