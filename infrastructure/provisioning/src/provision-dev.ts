/**
 * Provisions the development machine as a Home Cloud appliance.
 *
 *   pnpm provision:dev [--force] [--max-users <n>] [--out <dir>]
 *
 * Writes (default: <repo>/.appliance/, gitignored):
 *   device.json   device ID, setup code, certificate fingerprint, MAX_USERS
 *   tls/key.pem   private key (mode 0600)
 *   tls/cert.pem  self-signed certificate
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import QRCode from "qrcode";
import {
  generateDeviceId,
  generateSetupCode,
  generateTlsIdentity,
  setupQrPayload,
} from "./identity.ts";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

const { values } = parseArgs({
  options: {
    force: { type: "boolean", default: false },
    "max-users": { type: "string", default: "6" },
    out: { type: "string", default: join(repoRoot, ".appliance") },
  },
});

const outDir = resolve(values.out);
const maxUsers = Number(values["max-users"]);
if (!Number.isInteger(maxUsers) || maxUsers < 1) {
  throw new Error(`--max-users must be a positive integer, got "${values["max-users"]}"`);
}

if (existsSync(outDir)) {
  if (!values.force) {
    console.error(
      `An appliance identity already exists at ${outDir}.\n` +
        "Re-provisioning creates a brand-new box: paired devices will stop trusting it.\n" +
        "Run again with --force to replace it.",
    );
    process.exit(1);
  }
  rmSync(outDir, { recursive: true });
}

const deviceId = generateDeviceId();
const setupCode = generateSetupCode();
const tls = await generateTlsIdentity(deviceId);

mkdirSync(join(outDir, "tls"), { recursive: true });
writeFileSync(join(outDir, "tls", "key.pem"), tls.keyPem, { mode: 0o600 });
writeFileSync(join(outDir, "tls", "cert.pem"), tls.certPem);
writeFileSync(
  join(outDir, "device.json"),
  `${JSON.stringify(
    {
      deviceId,
      // Dev only: a real appliance stores what the PAKE needs, decided with the PAKE library.
      setupCode,
      certificateFingerprint: tls.fingerprint,
      maxUsers,
      provisionedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
);

const qr = await QRCode.toString(setupQrPayload(deviceId, setupCode), {
  type: "terminal",
  small: true,
});

process.stdout.write(`
Home Cloud (dev) provisioned → ${outDir}

  Device ID:    ${deviceId}
  Setup code:   ${setupCode}
  Max users:    ${String(maxUsers)}
  Fingerprint:  ${tls.fingerprint}

${qr}
`);
