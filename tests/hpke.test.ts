/**
 * HPKE: verified against the RFC 9180 Appendix A.2 test vector for
 * DHKEM(X25519, HKDF-SHA256) / HKDF-SHA256 / ChaCha20Poly1305, mode_base.
 *
 * Source: https://github.com/cfrg/draft-irtf-cfrg-hpke test-vectors.json
 * (mode 0, kem_id 32, kdf_id 1, aead_id 3)
 */

import { x25519 } from "@noble/curves/ed25519";

import { createNodeRandomValues } from "../src/adapters/nodeAdapter";
import { CryptoError } from "../src/errors";
import { decap, encap, keySchedule, open, seal } from "../src/hpke";

const VECTOR = {
  info: "4f6465206f6e2061204772656369616e2055726e",
  skRm: "8057991eef8f1f1af18f4a9491d16a1ce333f695d4db8e38da75975c4478e0fb",
  pkRm: "4310ee97d88cc1f088a5576c77ab0cf5c3ac797f3d95139c6c84b5429c59662a",
  skEm: "f4ec9b33b792c372c1d2c2063507b684ef925b8c75a42dbcbf57d63ccd381600",
  enc: "1afa08d3dec047a643885163f1180476fa7ddb54c6a8029ea33f95796bf2ac4a",
  sharedSecret:
    "0bbe78490412b4bbea4812666f7916932b828bba79942424abb65244930d69a7",
  key: "ad2744de8e17f4ebba575b3f5f5a8fa1f69c2a07f6e7500bc60ca6e3e3ec1c91",
  baseNonce: "5c4d98150661b848853b547f",
  exporterSecret:
    "a3b010d4994890e2c6968a36f64470d3c824c8f5029942feb11e7a74b2921922",
  aad: "436f756e742d30",
  pt: "4265617574792069732074727574682c20747275746820626561757479",
  ct: "1c5250d8034ec2b784ba2cfd69dbdb8af406cfe3ff938e131f0def8c8b60b4db21993c62ce81883d2dd1b51a28",
};

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("hpke (RFC 9180 base mode)", () => {
  describe("Appendix A.2 known-answer vectors", () => {
    it("derives the recipient public key from skRm", () => {
      expect(toHex(x25519.getPublicKey(fromHex(VECTOR.skRm)))).toBe(
        VECTOR.pkRm,
      );
    });

    it("encap produces the vector's enc and shared secret", () => {
      const { enc, sharedSecret } = encap(
        fromHex(VECTOR.pkRm),
        fromHex(VECTOR.skEm),
      );
      expect(toHex(enc)).toBe(VECTOR.enc);
      expect(toHex(sharedSecret)).toBe(VECTOR.sharedSecret);
    });

    it("decap recovers the same shared secret", () => {
      expect(toHex(decap(fromHex(VECTOR.enc), fromHex(VECTOR.skRm)))).toBe(
        VECTOR.sharedSecret,
      );
    });

    it("key schedule produces the vector's key, base_nonce, and exporter secret", () => {
      const schedule = keySchedule(
        fromHex(VECTOR.sharedSecret),
        fromHex(VECTOR.info),
      );
      expect(toHex(schedule.key)).toBe(VECTOR.key);
      expect(toHex(schedule.nonce)).toBe(VECTOR.baseNonce);
      expect(toHex(schedule.exporterSecret)).toBe(VECTOR.exporterSecret);
    });

    it("open decrypts the vector ciphertext to the vector plaintext", () => {
      const plaintext = open(
        fromHex(VECTOR.skRm),
        fromHex(VECTOR.enc),
        fromHex(VECTOR.ct),
        fromHex(VECTOR.aad),
        fromHex(VECTOR.info),
      );
      expect(toHex(plaintext)).toBe(VECTOR.pt);
    });
  });

  describe("seal / open round-trip", () => {
    const random = createNodeRandomValues();
    const recipientPrivateKey = fromHex(VECTOR.skRm);
    const recipientPublicKey = fromHex(VECTOR.pkRm);

    it("round-trips a message", () => {
      const message = new TextEncoder().encode("hello");
      const aad = new Uint8Array([0x02, 0x01]);
      const { enc, ciphertext } = seal(
        recipientPublicKey,
        message,
        aad,
        random,
      );
      expect(enc.length).toBe(32);
      expect(open(recipientPrivateKey, enc, ciphertext, aad)).toEqual(message);
    });

    it("uses a fresh ephemeral key per message", () => {
      const message = new Uint8Array([1, 2, 3]);
      const aad = new Uint8Array(0);
      const a = seal(recipientPublicKey, message, aad, random);
      const b = seal(recipientPublicKey, message, aad, random);
      expect(toHex(a.enc)).not.toBe(toHex(b.enc));
      expect(toHex(a.ciphertext)).not.toBe(toHex(b.ciphertext));
    });

    it("throws AUTH_FAILED for a modified ciphertext", () => {
      const aad = new Uint8Array(0);
      const { enc, ciphertext } = seal(
        recipientPublicKey,
        new Uint8Array([9, 9, 9]),
        aad,
        random,
      );
      ciphertext[0] ^= 0x01;
      expectCode(
        () => open(recipientPrivateKey, enc, ciphertext, aad),
        "AUTH_FAILED",
      );
    });

    it("throws AUTH_FAILED for mismatched aad", () => {
      const { enc, ciphertext } = seal(
        recipientPublicKey,
        new Uint8Array([7]),
        new Uint8Array([0x02, 0x01]),
        random,
      );
      expectCode(
        () =>
          open(
            recipientPrivateKey,
            enc,
            ciphertext,
            new Uint8Array([0x02, 0x00]),
          ),
        "AUTH_FAILED",
      );
    });

    it("throws AUTH_FAILED for the wrong recipient key", () => {
      const aad = new Uint8Array(0);
      const { enc, ciphertext } = seal(
        recipientPublicKey,
        new Uint8Array([5]),
        aad,
        random,
      );
      const otherKey = random.getRandomValues(new Uint8Array(32))!;
      expectCode(() => open(otherKey, enc, ciphertext, aad), "AUTH_FAILED");
    });

    it("rejects a wrong-length enc and public key", () => {
      expectCode(
        () => decap(new Uint8Array(31), recipientPrivateKey),
        "BAD_FORMAT",
      );
      expectCode(
        () => encap(new Uint8Array(31), fromHex(VECTOR.skEm)),
        "BAD_FORMAT",
      );
    });
  });
});

function expectCode(run: () => unknown, code: string): void {
  expect(run).toThrow(CryptoError);
  try {
    run();
  } catch (error) {
    expect((error as CryptoError).code).toBe(code);
  }
}
