import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";

const PROXY_NAME = "diskhealthProxyHandler";
const logger = createLogger(PROXY_NAME);
const execFileAsync = promisify(execFile);

// plain devices (/dev/sda, /dev/nvme0n1) or stable /dev/disk/by-id/... paths
const DEVICE_PATTERN = /^\/dev\/[a-zA-Z0-9/_.-]+$/;
const SMARTCTL_TIMEOUT_MS = 15 * 1000;

function ataAttribute(data, id) {
  return data.ata_smart_attributes?.table?.find((attribute) => attribute.id === id)?.raw?.value;
}

function toDisk(device, data) {
  // -n standby makes smartctl exit early on a spun-down drive instead of waking it
  const standby = (data.smartctl?.messages ?? []).some((message) => message.string?.includes("STANDBY"));
  if (standby) return { device, name: path.basename(device), standby: true };

  return {
    device,
    name: path.basename(device),
    model: data.model_name,
    passed: data.smart_status?.passed,
    temperature: data.temperature?.current,
    powerOnHours: data.power_on_time?.hours,
    // NVMe reports rated-endurance used; ATA drives report sector counts instead
    wearPercent: data.nvme_smart_health_information_log?.percentage_used,
    reallocatedSectors: ataAttribute(data, 5),
    pendingSectors: ataAttribute(data, 197),
  };
}

async function queryDisk(device) {
  try {
    const { stdout } = await execFileAsync("smartctl", ["--json", "--all", "--nocheck", "standby", device], {
      timeout: SMARTCTL_TIMEOUT_MS,
    });
    return toDisk(device, JSON.parse(stdout));
  } catch (error) {
    // smartctl signals standby drives and failing health checks through a non-zero
    // exit bitmask while still printing the JSON report, so parse stdout first
    if (error.stdout) {
      try {
        return toDisk(device, JSON.parse(error.stdout));
      } catch (parseError) {
        // not JSON after all; report the exec error below
      }
    }
    logger.error("smartctl failed for %s: %s", device, error.message);
    return {
      device,
      name: path.basename(device),
      error: error.code === "ENOENT" ? "smartctl not installed" : error.message,
    };
  }
}

export default async function diskhealthProxyHandler(req, res) {
  const { group, service, index } = req.query;
  const widget = await getServiceWidget(group, service, index);

  if (!widget) {
    logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
    return res.status(400).json({ error: "Invalid widget configuration" });
  }

  // devices come from services.yaml (server-side), but validate the shape anyway
  // since they end up as an execFile argument
  const devices = (widget.disks ?? []).filter(
    (device) => typeof device === "string" && DEVICE_PATTERN.test(device) && !device.includes(".."),
  );

  if (!devices.length) {
    return res.status(400).json({ error: "No valid disks configured" });
  }

  const disks = await Promise.all(devices.map(queryDisk));
  return res.status(200).json({ disks });
}
