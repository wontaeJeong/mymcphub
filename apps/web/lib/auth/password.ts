import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";
const defaultParams = { n: 16_384, r: 8, p: 1, keyLength: 64 } as const;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, defaultParams.keyLength, { N: defaultParams.n, r: defaultParams.r, p: defaultParams.p });
  return `scrypt$${defaultParams.n}$${defaultParams.r}$${defaultParams.p}$${salt.toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const parsed = parseScryptHash(storedHash);
  if (!parsed) {
    return false;
  }
  const derived = await scrypt(password, parsed.salt, parsed.hash.length, { N: parsed.n, r: parsed.r, p: parsed.p });
  const candidate = Buffer.from(derived);
  return candidate.length === parsed.hash.length && timingSafeEqual(candidate, parsed.hash);
}

function scrypt(password: string, salt: Buffer, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Buffer.from(derivedKey));
    });
  });
}

function parseScryptHash(storedHash: string) {
  const [scheme, nValue, rValue, pValue, saltValue, hashValue] = storedHash.split("$");
  if (scheme !== "scrypt" || !nValue || !rValue || !pValue || !saltValue || !hashValue) {
    return undefined;
  }
  const n = Number.parseInt(nValue, 10);
  const r = Number.parseInt(rValue, 10);
  const p = Number.parseInt(pValue, 10);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || n <= 1 || r <= 0 || p <= 0) {
    return undefined;
  }
  return {
    n,
    r,
    p,
    salt: Buffer.from(saltValue, "base64url"),
    hash: Buffer.from(hashValue, "base64url"),
  };
}
