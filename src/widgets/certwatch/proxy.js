import tls from "tls";

import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";

const PROXY_NAME = "certwatchProxyHandler";
const logger = createLogger(PROXY_NAME);

const SUCCESS_TTL_MS = 15 * 60 * 1000;
const ERROR_TTL_MS = 60 * 1000;
const CONNECT_TIMEOUT_MS = 10 * 1000;

const cache = new Map();

function checkCertificate(domain) {
  const [host, portString] = domain.split(":");
  const port = Number(portString) || 443;

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    // rejectUnauthorized is off so self-signed and expired certificates can still be inspected
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false }, () => {
      const certificate = socket.getPeerCertificate();
      const authorized = socket.authorized;
      socket.end();

      if (!certificate?.valid_to) {
        settle({ domain, error: "no certificate presented" });
        return;
      }

      const validTo = new Date(certificate.valid_to);
      settle({
        domain,
        issuer: certificate.issuer?.O ?? certificate.issuer?.CN,
        validTo: validTo.toISOString(),
        daysRemaining: Math.floor((validTo.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
        authorized,
      });
    });

    socket.setTimeout(CONNECT_TIMEOUT_MS, () => {
      socket.destroy();
      settle({ domain, error: "timeout" });
    });

    socket.on("error", (error) => {
      settle({ domain, error: error.code ?? error.message });
    });
  });
}

export default async function certwatchProxyHandler(req, res) {
  const { group, service, index } = req.query;
  const widget = await getServiceWidget(group, service, index);

  if (!widget) {
    logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
    return res.status(400).json({ error: "Invalid widget configuration" });
  }

  const domains = (widget.domains ?? []).filter((domain) => typeof domain === "string" && domain.length);

  if (!domains.length) {
    return res.status(400).json({ error: "No domains configured" });
  }

  const certificates = await Promise.all(
    domains.map(async (domain) => {
      const cached = cache.get(domain);
      if (cached && Date.now() < cached.expires) {
        return cached.result;
      }

      const result = await checkCertificate(domain);
      cache.set(domain, {
        result,
        expires: Date.now() + (result.error ? ERROR_TTL_MS : SUCCESS_TTL_MS),
      });
      return result;
    }),
  );

  return res.status(200).json({ certificates });
}
