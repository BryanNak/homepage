import { execFile } from "child_process";
import { promisify } from "util";

import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";

const logger = createLogger("compose");

const execFileAsync = promisify(execFile);
const EXEC_OPTIONS = { timeout: 10 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 };

// commands run sequentially for a given action; never through a shell
const ACTIONS = {
  up: [["compose", "up", "-d"]],
  down: [["compose", "down"]],
  update: [
    ["compose", "pull"],
    ["compose", "up", "-d"],
    ["image", "prune", "-af"],
  ],
};

// one action at a time per stack directory
const busy = new Set();

async function getStacks(req) {
  const { group, service, index } = req.query.group ? req.query : (req.body ?? {});
  const widget = await getServiceWidget(group, service, index);
  if (!widget || widget.type !== "composestacks") return null;

  return (widget.stacks ?? []).filter((stack) => stack?.name && stack?.dir);
}

async function stackStatus(stack) {
  try {
    const { stdout } = await execFileAsync("docker", ["compose", "ps", "-a", "--format", "json"], {
      ...EXEC_OPTIONS,
      cwd: stack.dir,
    });
    // `docker compose ps --format json` emits one JSON object per line
    const containers = stdout
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try {
          const parsed = JSON.parse(line);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return [];
        }
      });

    return {
      name: stack.name,
      total: containers.length,
      running: containers.filter((container) => container.State === "running").length,
    };
  } catch (error) {
    logger.error("compose ps failed for stack '%s': %s", stack.name, error.message);
    return { name: stack.name, error: error.code === "ENOENT" ? "docker not found" : "status failed" };
  }
}

export default async function handler(req, res) {
  const stacks = await getStacks(req);
  if (!stacks) {
    return res.status(400).json({ error: "Invalid widget configuration" });
  }

  if (req.method === "GET") {
    return res.status(200).json({ stacks: await Promise.all(stacks.map(stackStatus)) });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { stack: stackName, action } = req.body ?? {};
  // the browser only ever sends a stack *name*; the directory comes from services.yaml
  const stack = stacks.find((s) => s.name === stackName);
  const commands = ACTIONS[action];

  if (!stack || !commands) {
    return res.status(400).json({ error: "Unknown stack or action" });
  }

  if (busy.has(stack.dir)) {
    return res.status(409).json({ error: "Another action is already running for this stack" });
  }

  busy.add(stack.dir);
  try {
    logger.info("Running compose action '%s' for stack '%s' in %s", action, stack.name, stack.dir);
    const outputs = [];
    for (const args of commands) {
      const { stdout, stderr } = await execFileAsync("docker", args, { ...EXEC_OPTIONS, cwd: stack.dir });
      outputs.push(`$ docker ${args.join(" ")}\n${stdout}${stderr}`);
    }
    return res.status(200).json({ ok: true, output: outputs.join("\n").slice(-4000) });
  } catch (error) {
    logger.error("compose action '%s' failed for stack '%s': %s", action, stack.name, error.message);
    return res
      .status(500)
      .json({ error: error.message, output: `${error.stdout ?? ""}${error.stderr ?? ""}`.slice(-4000) });
  } finally {
    busy.delete(stack.dir);
  }
}
