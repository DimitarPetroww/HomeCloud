import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
import { describe, it } from "node:test";
import {
  generateDeviceId,
  generateSetupCode,
  generateTlsIdentity,
  SETUP_CODE_ALPHABET,
  setupQrPayload,
  spkiFingerprint,
} from "./identity.ts";

describe("generateSetupCode", () => {
  it("is three blocks of four unambiguous characters", () => {
    const pattern = new RegExp(`^[${SETUP_CODE_ALPHABET}]{4}(-[${SETUP_CODE_ALPHABET}]{4}){2}$`);
    for (let i = 0; i < 200; i++) assert.match(generateSetupCode(), pattern);
  });

  it("never contains look-alike characters", () => {
    for (let i = 0; i < 200; i++) assert.doesNotMatch(generateSetupCode(), /[01OIL]/);
  });

  it("does not repeat", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateSetupCode));
    assert.equal(codes.size, 1000);
  });
});

describe("generateDeviceId", () => {
  it("is a 16-character DNS-safe label", () => {
    for (let i = 0; i < 200; i++) assert.match(generateDeviceId(), /^[a-z2-9]{16}$/);
  });
});

describe("generateTlsIdentity", () => {
  it("creates a valid long-lived P-256 server certificate for the device", async () => {
    const deviceId = generateDeviceId();
    const tls = await generateTlsIdentity(deviceId);
    const cert = new X509Certificate(tls.certPem);

    assert.equal(cert.subject, `CN=${deviceId}`);
    assert.equal(cert.ca, false);
    assert.ok(cert.checkHost(deviceId));
    assert.equal(cert.publicKey.asymmetricKeyDetails?.namedCurve, "prime256v1");
    assert.ok(cert.verify(cert.publicKey), "self-signature is valid");

    const years = (Date.parse(cert.validTo) - Date.parse(cert.validFrom)) / (365.25 * 86_400_000);
    assert.ok(years > 19.9, `validity is ${years.toFixed(1)} years`);

    assert.match(tls.keyPem, /^-----BEGIN PRIVATE KEY-----/);
    assert.equal(tls.fingerprint, spkiFingerprint(tls.certPem));
    assert.match(tls.fingerprint, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });
});

describe("setupQrPayload", () => {
  it("encodes device and code in a homecloud:// URL", () => {
    const url = new URL(setupQrPayload("abc", "HCQ7-M4XP-9KTR"));
    assert.equal(url.protocol, "homecloud:");
    assert.equal(url.searchParams.get("device"), "abc");
    assert.equal(url.searchParams.get("code"), "HCQ7-M4XP-9KTR");
  });
});
