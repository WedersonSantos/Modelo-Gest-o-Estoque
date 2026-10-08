import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decrypt, encrypt } from "@/shared/lib/crypto";
import { getEncryptionKey } from "@/shared/lib/crypto/key-derivation";

// Valores fictícios usados somente nos testes; as variáveis reais não são alteradas em arquivo.
beforeEach(() => {
  vi.stubEnv("APP_CRYPTO_KEY_HEX", "01".repeat(32));
  vi.stubEnv("APP_CRYPTO_PASSPHRASE", "frase fictícia dos testes");
  vi.stubEnv("APP_CRYPTO_SALT_HEX", "02".repeat(32));
});
afterEach(() => vi.unstubAllEnvs());

function flip(hex: string): string {
  return (hex.startsWith("0") ? "1" : "0") + hex.slice(1);
}

describe("criptografia de dados recuperáveis", () => {
  it.each(["informação confidencial", "12345678900", "", "Ação turca 🥙\nsegunda linha"])("recupera o texto original: %j", value => {
    const encrypted = encrypt(value);
    expect(encrypted).not.toBe(value);
    expect(decrypt(encrypted)).toBe(value);
  });

  it("gera um IV novo para cada criptografia", () => {
    const first = encrypt("Fornecedor X");
    const second = encrypt("Fornecedor X");
    expect(first).not.toBe(second);
    expect(first.split(":")[1]).not.toBe(second.split(":")[1]);
  });

  it.each([1, 2, 3])("rejeita adulteração do componente %i", index => {
    const parts = encrypt("texto protegido").split(":");
    parts[index] = flip(parts[index]);
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("rejeita formatos inválidos e campos extras", () => {
    const valid = encrypt("teste");
    const parts = valid.split(":");
    for (const invalid of ["", valid + ":extra", valid.replace("v1:", "v2:"), `v1:00:${parts[2]}:${parts[3]}`, `v1:${parts[1]}:00:${parts[3]}`, valid + "z", valid.slice(0, -1)]) {
      expect(() => decrypt(invalid)).toThrow("Payload criptografado inválido.");
    }
  });

  it.each(["APP_CRYPTO_KEY_HEX", "APP_CRYPTO_PASSPHRASE", "APP_CRYPTO_SALT_HEX"])("exige %s", name => {
    vi.stubEnv(name, undefined);
    expect(() => encrypt("teste")).toThrow(name);
  });

  it.each(["APP_CRYPTO_KEY_HEX", "APP_CRYPTO_SALT_HEX"])("valida os 32 bytes hexadecimais de %s", name => {
    for (const invalid of ["01", "xx".repeat(32), "01".repeat(33)]) {
      vi.stubEnv(name, invalid);
      expect(() => encrypt("teste")).toThrow("64 caracteres hexadecimais");
    }
  });

  it("deriva uma chave de 32 bytes determinística", () => {
    const first = getEncryptionKey();
    expect(first.length).toBe(32);
    expect(getEncryptionKey()).toEqual(first);
  });

  it.each(["APP_CRYPTO_KEY_HEX", "APP_CRYPTO_PASSPHRASE", "APP_CRYPTO_SALT_HEX"])("não descriptografa quando %s muda", name => {
    const encrypted = encrypt("teste");
    vi.stubEnv(name, name === "APP_CRYPTO_PASSPHRASE" ? "outra frase fictícia" : "03".repeat(32));
    expect(() => decrypt(encrypted)).toThrow();
  });
});
