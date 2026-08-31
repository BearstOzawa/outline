const DEFAULT_ITERATIONS = 210000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const webCrypto = globalThis.crypto;

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  salt: string;
  iterations: number;
};

function toBytes(value: ArrayBuffer | Uint8Array) {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

function toBase64(value: ArrayBuffer | Uint8Array) {
  const bytes = toBytes(value);
  if (typeof btoa === "function") {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(value: string) {
  if (typeof atob === "function") {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(value, "base64"));
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const material = await webCrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return webCrypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(
  plaintext: string,
  password: string,
  iterations = DEFAULT_ITERATIONS
): Promise<EncryptedPayload> {
  const salt = webCrypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = webCrypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, iterations);
  const ciphertext = await webCrypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext)
  );

  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
    salt: toBase64(salt),
    iterations,
  };
}

export async function decryptText(
  payload: EncryptedPayload,
  password: string
): Promise<string> {
  const salt = fromBase64(payload.salt);
  const iv = fromBase64(payload.iv);
  const ciphertext = fromBase64(payload.ciphertext);
  const key = await deriveKey(password, salt, payload.iterations);
  const plaintext = await webCrypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );
  return new TextDecoder().decode(plaintext);
}

export const ENCRYPTED_BLOCK_ITERATIONS = DEFAULT_ITERATIONS;
