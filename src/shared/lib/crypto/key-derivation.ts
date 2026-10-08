import { hkdfSync } from "node:crypto";

const KEY_LENGTH = 32;

export function getEncryptionKey(): Buffer {
  const keyHex = process.env.APP_CRYPTO_KEY_HEX;
  const passphrase = process.env.APP_CRYPTO_PASSPHRASE;
  const saltHex = process.env.APP_CRYPTO_SALT_HEX;

  if (!keyHex) {
    throw new Error("APP_CRYPTO_KEY_HEX não configurada.");
  }

  if (!passphrase) {
    throw new Error("APP_CRYPTO_PASSPHRASE não configurada.");
  }

  if (!saltHex) {
    throw new Error("APP_CRYPTO_SALT_HEX não configurada.");
  }

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      "APP_CRYPTO_KEY_HEX deve possuir exatamente 64 caracteres hexadecimais.",
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(saltHex)) {
    throw new Error(
      "APP_CRYPTO_SALT_HEX deve possuir exatamente 64 caracteres hexadecimais.",
    );
  }

  const rootKey = Buffer.from(keyHex, "hex");
  const salt = Buffer.from(saltHex, "hex");

  const ikm = Buffer.concat([
    rootKey,
    Buffer.from(passphrase, "utf8"),
  ]);

  return Buffer.from(
    hkdfSync(
      "sha256",
      ikm,
      salt,
      Buffer.from("mesa:aes-256-gcm:v1"),
      KEY_LENGTH,
    ),
  );
}