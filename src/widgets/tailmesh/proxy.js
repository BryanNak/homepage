import http from "http";

import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";

const PROXY_NAME = "tailmeshProxyHandler";
const logger = createLogger(PROXY_NAME);

const DEFAULT_SOCKET_PATH = "/var/run/tailscale/tailscaled.sock";
const REQUEST_TIMEOUT_MS = 5 * 1000;

function localApiStatus(socketPath) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        socketPath,
        path: "/localapi/v0/status",
        headers: { Host: "local-tailscaled.sock" },
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new Error(`LocalAPI returned HTTP ${response.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error("LocalAPI request timed out")));
    request.on("error", reject);
    request.end();
  });
}

function toDevice(node, magicDNSSuffix, self = false) {
  const dnsName = node.DNSName?.replace(/\.$/, "");
  // peers without a MagicDNS name (shared-in or tagged nodes) have an empty DNSName,
  // so fall back through hostname and IP rather than showing a blank row
  const name =
    (magicDNSSuffix && dnsName?.endsWith(`.${magicDNSSuffix}`)
      ? dnsName.slice(0, -(magicDNSSuffix.length + 1))
      : dnsName) ||
    node.HostName ||
    node.ComputedName ||
    node.TailscaleIPs?.[0] ||
    "unknown";

  return {
    name,
    dnsName,
    os: node.OS,
    ip: node.TailscaleIPs?.[0],
    online: Boolean(node.Online),
    lastSeen: node.LastSeen,
    self,
  };
}

export default async function tailmeshProxyHandler(req, res) {
  const { group, service, index } = req.query;
  const widget = await getServiceWidget(group, service, index);

  if (!widget) {
    logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
    return res.status(400).json({ error: "Invalid widget configuration" });
  }

  const socketPath = widget.socket ?? DEFAULT_SOCKET_PATH;

  try {
    const status = await localApiStatus(socketPath);

    if (status.BackendState !== "Running") {
      return res.status(200).json({ error: { message: `Tailscale backend is ${status.BackendState}` } });
    }

    const suffix = status.MagicDNSSuffix;
    const devices = [
      toDevice(status.Self, suffix, true),
      ...Object.values(status.Peer ?? {}).map((peer) => toDevice(peer, suffix)),
    ].sort((a, b) => b.self - a.self || b.online - a.online || a.name.localeCompare(b.name));

    return res.status(200).json({
      total: devices.length,
      online: devices.filter((device) => device.online).length,
      devices,
    });
  } catch (error) {
    logger.error("Error querying Tailscale LocalAPI at %s: %s", socketPath, error.message);
    return res.status(500).json({
      error: { message: `Tailscale LocalAPI unreachable: ${error.message}` },
    });
  }
}
