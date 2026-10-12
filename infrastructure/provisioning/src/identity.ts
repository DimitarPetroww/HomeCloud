/**
 * Appliance identity generation (see "Provisioning" in CLAUDE.md).
 * Pure functions: no file I/O, so the same code can run on a factory line.
 * All randomness comes from node:crypto's CSPRNG; certificates from @peculiar/x509.
 */
// Required by @peculiar/x509 and must load before it. The library uses Node's global Web Crypto.
import "reflect-metadata";
import {
  createHash,
  KeyObject,
  randomBytes,
  randomInt,
  webcrypto,
  X509Certificate,
} from "node:crypto";
import * as x509 from "@peculiar/x509";

/** Uppercase letters and digits without look-alikes (0/O, 1/I/L) or U. 30 symbols. */
export const SETUP_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
/** 12 symbols ≈ 59 bits: far beyond online guessing under the appliance's rate limiting. */
export const SETUP_CODE_LENGTH = 12;

/** Lowercase, DNS-safe, no look-alikes. 31 symbols. */
const DEVICE_ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
/** 16 symbols ≈ 79 bits: not guessable, short enough for a hostname label. */
const DEVICE_ID_LENGTH = 16;

const CERT_VALIDITY_YEARS = 20;

function randomString(alphabet: string, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet.charAt(randomInt(alphabet.length));
  return out;
}

export function generateDeviceId(): string {
  return randomString(DEVICE_ID_ALPHABET, DEVICE_ID_LENGTH);
}

/** Returns a code formatted in blocks of four, e.g. `HCQ7-M4XP-9KTR`. */
export function generateSetupCode(): string {
  const raw = randomString(SETUP_CODE_ALPHABET, SETUP_CODE_LENGTH);
  return raw.match(/.{4}/g)?.join("-") ?? raw;
}

export interface TlsIdentity {
  keyPem: string;
  certPem: string;
  /** SHA-256 of the public key (SPKI), colon-separated hex. This is what clients pin. */
  fingerprint: string;
}

/** SPKI SHA-256 pin of a PEM certificate. Pinning the key (not the whole cert) survives re-issuing. */
export function spkiFingerprint(certPem: string): string {
  const spki = new X509Certificate(certPem).publicKey.export({ type: "spki", format: "der" });
  const hex = createHash("sha256").update(spki).digest("hex").toUpperCase();
  return hex.match(/.{2}/g)?.join(":") ?? hex;
}

/** ECDSA P-256 key pair and a long-lived self-signed server certificate for the appliance. */
export async function generateTlsIdentity(deviceId: string): Promise<TlsIdentity> {
  const algorithm = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
  const keys = await webcrypto.subtle.generateKey(algorithm, true, ["sign", "verify"]);

  const notBefore = new Date();
  const notAfter = new Date(notBefore);
  notAfter.setFullYear(notAfter.getFullYear() + CERT_VALIDITY_YEARS);

  const cert = await x509.X509CertificateGenerator.createSelfSigned({
    // Leading 01 keeps the serial positive, as X.509 requires.
    serialNumber: `01${randomBytes(15).toString("hex")}`,
    name: `CN=${deviceId}`,
    notBefore,
    notAfter,
    signingAlgorithm: algorithm,
    keys,
    extensions: [
      new x509.BasicConstraintsExtension(false, undefined, true),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature, true),
      new x509.ExtendedKeyUsageExtension([x509.ExtendedKeyUsage.serverAuth]),
      new x509.SubjectAlternativeNameExtension([{ type: "dns", value: deviceId }]),
    ],
  });

  const certPem = cert.toString("pem");
  const keyPem = KeyObject.from(keys.privateKey)
    .export({ type: "pkcs8", format: "pem" })
    .toString();

  return { keyPem, certPem, fingerprint: spkiFingerprint(certPem) };
}

/** Content of the QR code on the box label. The mobile app opens it via the `homecloud://` scheme. */
export function setupQrPayload(deviceId: string, setupCode: string): string {
  const params = new URLSearchParams({ device: deviceId, code: setupCode });
  return `homecloud://setup?${params.toString()}`;
}
