/**
 * Enhanced RSA Cryptography Manager
 * Hybrid RSA + AES: real RSA keygen, OAEP, deterministic key from mnemonic, local/remote encrypt/decrypt.
 */

import {
  decode as base64Decode,
  encode as base64Encode,
} from "base64-arraybuffer";
import forge from "node-forge";

import { MnemonicManager } from "./MnemonicManager";
import type { IKeyStorage, IRandomValues } from "./adapters/types";
import type {
  ProgressCallback,
  TransmissionPayload,
  ValidationResult,
} from "./types";

export interface EnhancedRSAManagerOptions {
  keyStorage: IKeyStorage;
  randomValues: IRandomValues;
  /** Optional platform label for metadata (e.g. 'ios', 'android', 'web', 'node'). */
  platform?: string;
}

export class EnhancedRSAManager {
  private static readonly PRIVATE_KEY_TAG =
    "com.example.RSACryptoDemo.privateKey";
  private static readonly PUBLIC_KEY_TAG =
    "com.example.RSACryptoDemo.publicKey";
  private static readonly MNEMONIC_TAG = "com.example.RSACryptoDemo.mnemonic";
  private static readonly METADATA_TAG = "com.example.RSACryptoDemo.metadata";

  static readonly MIN_KEY_SIZE = 2048;
  static readonly RECOMMENDED_KEY_SIZE = 3072;
  private static readonly PUBLIC_EXPONENT = 0x10001;

  private readonly storage: IKeyStorage;
  private readonly randomValues: IRandomValues;
  private readonly platform: string;

  publicKeyString: string = "";
  isKeyGenerated: boolean = false;
  mnemonicPhrase: string = "";
  keyStorageInfo: {
    platform: string;
    timestamp: string;
    storageLocation: string;
    keySize?: number;
    version?: string;
  } | null = null;

  constructor(options: EnhancedRSAManagerOptions) {
    this.storage = options.keyStorage;
    this.randomValues = options.randomValues;
    this.platform = options.platform ?? "node";
  }

  private getStorageLocation(): string {
    if (this.platform === "ios") return "iOS Keychain";
    if (this.platform === "android") return "Android Keystore";
    return "Secure Storage";
  }

  async generateRSAKeypair(
    keySize: number = EnhancedRSAManager.MIN_KEY_SIZE,
    progressCallback?: ProgressCallback,
  ): Promise<boolean> {
    try {
      if (keySize < EnhancedRSAManager.MIN_KEY_SIZE) {
        throw new Error(
          `Key size ${keySize} below minimum required ${EnhancedRSAManager.MIN_KEY_SIZE}`,
        );
      }
      progressCallback?.("🎲 Generating mnemonic seed phrase...");
      const mnemonic = await MnemonicManager.generateMnemonic(
        this.randomValues,
      );
      this.mnemonicPhrase = mnemonic;
      progressCallback?.("🔑 Deriving cryptographic seed...");
      const seed = await MnemonicManager.mnemonicToSeed(mnemonic);
      return await this.generateRSAKeypairFromSeed(
        seed,
        keySize,
        progressCallback,
      );
    } catch (error) {
      console.error("❌ Real RSA keypair generation failed:", error);
      return false;
    }
  }

  protected async generateRSAKeypairFromSeed(
    seed: Uint8Array,
    keySize: number = EnhancedRSAManager.MIN_KEY_SIZE,
    progressCallback?: ProgressCallback,
  ): Promise<boolean> {
    try {
      const prng = this.createDeterministicPRNG(seed);
      progressCallback?.("🔢 Generating prime numbers...");

      const keyPair = await new Promise<forge.pki.rsa.KeyPair>(
        (resolve, reject) => {
          setTimeout(() => {
            try {
              const keys = forge.pki.rsa.generateKeyPair(
                keySize,
                EnhancedRSAManager.PUBLIC_EXPONENT,
                {
                  prng,
                  workers: 0,
                  algorithm: "PRIMEINC",
                } as any,
              );
              resolve(keys);
            } catch (error) {
              reject(error);
            }
          }, 50);
        },
      );

      progressCallback?.("⚡ Constructing RSA keypair...");

      const publicKeyPem = forge.pki.publicKeyToPem(keyPair.publicKey);
      const privateKeyPem = forge.pki.privateKeyToPem(keyPair.privateKey);

      const validation = this.validateRSAKey(keyPair.publicKey, keySize);
      if (!validation.valid) {
        throw new Error(
          `Generated key validation failed: ${validation.issues.join(", ")}`,
        );
      }
      if (validation.warnings.length > 0) {
        console.warn(`⚠️ RSA Key warnings: ${validation.warnings.join(", ")}`);
      }

      const storageLocation = this.getStorageLocation();
      const metadata = {
        platform: this.platform,
        timestamp: new Date().toISOString(),
        storageLocation,
        keySize,
        version: "1.0",
      };

      progressCallback?.("💾 Storing keys securely...");
      await Promise.all([
        this.storage.setItem(EnhancedRSAManager.PRIVATE_KEY_TAG, privateKeyPem),
        this.storage.setItem(EnhancedRSAManager.PUBLIC_KEY_TAG, publicKeyPem),
        this.storage.setItem(
          EnhancedRSAManager.MNEMONIC_TAG,
          this.mnemonicPhrase,
        ),
        this.storage.setItem(
          EnhancedRSAManager.METADATA_TAG,
          JSON.stringify(metadata),
        ),
      ]);

      this.keyStorageInfo = metadata;
      this.publicKeyString = publicKeyPem;
      this.isKeyGenerated = true;
      progressCallback?.("✅ Keys generated successfully!");
      return true;
    } catch (error) {
      console.error("❌ Deterministic RSA generation failed:", error);
      return false;
    }
  }

  private createDeterministicPRNG(seed: Uint8Array): any {
    const seedHash = this.hashWithSHA512_256(this.uint8ArrayToString(seed));
    const prng = forge.random.createInstance();
    prng.seedFileSync = () => seedHash;
    return prng;
  }

  private validateRSAKey(
    publicKey: forge.pki.rsa.PublicKey,
    expectedKeySize: number,
  ): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    try {
      const keyLength = publicKey.n.bitLength();
      const publicExponent = publicKey.e.toString();
      if (keyLength < EnhancedRSAManager.MIN_KEY_SIZE) {
        issues.push(
          `Key length ${keyLength} below minimum required ${EnhancedRSAManager.MIN_KEY_SIZE}`,
        );
      } else if (keyLength < EnhancedRSAManager.RECOMMENDED_KEY_SIZE) {
        warnings.push(
          `Key length ${keyLength} may be deprecated by 2030, consider ${EnhancedRSAManager.RECOMMENDED_KEY_SIZE}+ bits`,
        );
      }
      if (Math.abs(keyLength - expectedKeySize) > 10) {
        issues.push(
          `Generated key length ${keyLength} significantly differs from requested ${expectedKeySize}`,
        );
      }
      const expectedExponent = EnhancedRSAManager.PUBLIC_EXPONENT.toString();
      if (publicExponent !== expectedExponent) {
        warnings.push(
          `Non-standard public exponent: ${publicExponent}, expected: ${expectedExponent}`,
        );
      }
      if (publicKey.n.isProbablePrime(10) === true) {
        issues.push(
          "RSA modulus should be composite (product of primes), not prime",
        );
      }
      return {
        valid: issues.length === 0,
        issues,
        warnings,
        keyLength,
        publicExponent,
      };
    } catch (error) {
      return {
        valid: false,
        issues: [
          `Key validation failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
        warnings: [],
      };
    }
  }

  async encryptWithRSA(
    data: string,
    publicKeyPem: string,
  ): Promise<string | null> {
    try {
      const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
      if (data.length > 190) {
        return await this.hybridRSAEncrypt(data, publicKey);
      }
      const encrypted = publicKey.encrypt(data, "RSA-OAEP", {
        md: forge.md.sha256.create(),
        mgf1: { md: forge.md.sha256.create() },
      });
      return forge.util.encode64(encrypted);
    } catch (error) {
      console.error("❌ RSA encryption failed:", error);
      return null;
    }
  }

  async decryptWithRSA(
    encryptedData: string,
    privateKeyPem: string,
  ): Promise<string | null> {
    try {
      const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
      if (encryptedData.startsWith("HYBRID:")) {
        return await this.hybridRSADecrypt(encryptedData, privateKey);
      }
      const encrypted = forge.util.decode64(encryptedData);
      const decrypted = privateKey.decrypt(encrypted, "RSA-OAEP", {
        md: forge.md.sha256.create(),
        mgf1: { md: forge.md.sha256.create() },
      });
      return decrypted;
    } catch (error) {
      console.error("❌ RSA decryption failed:", error);
      return null;
    }
  }

  private async hybridRSAEncrypt(
    data: string,
    publicKey: forge.pki.rsa.PublicKey,
  ): Promise<string> {
    const aesKey = forge.random.getBytesSync(32);
    const aesEncrypted = await this.encryptWithAESForge(data, aesKey);
    const rsaEncrypted = publicKey.encrypt(aesKey, "RSA-OAEP", {
      md: forge.md.sha256.create(),
      mgf1: { md: forge.md.sha256.create() },
    });
    return `HYBRID:${forge.util.encode64(rsaEncrypted)}:${aesEncrypted}`;
  }

  private async hybridRSADecrypt(
    encryptedData: string,
    privateKey: forge.pki.rsa.PrivateKey,
  ): Promise<string> {
    const parts = encryptedData.split(":");
    if (parts.length !== 3 || parts[0] !== "HYBRID") {
      throw new Error("Invalid hybrid encryption format");
    }
    const rsaEncryptedKey = forge.util.decode64(parts[1]);
    const aesEncryptedData = parts[2];
    const aesKey = privateKey.decrypt(rsaEncryptedKey, "RSA-OAEP", {
      md: forge.md.sha256.create(),
      mgf1: { md: forge.md.sha256.create() },
    });
    return await this.decryptWithAESForge(aesEncryptedData, aesKey);
  }

  hashWithSHA512_256(data: string): string {
    const hash = forge.md.sha512.sha256.create();
    hash.update(data);
    return hash.digest().toHex();
  }

  hashWithSalt(data: string, salt: string): string {
    const hash = forge.md.sha512.sha256.create();
    hash.update(data + salt);
    return hash.digest().toHex();
  }

  async recoverKeysFromMnemonic(mnemonic: string): Promise<boolean> {
    try {
      if (!mnemonic.trim()) return false;
      if (!MnemonicManager.validateMnemonic(mnemonic)) return false;
      const seed = await MnemonicManager.mnemonicToSeed(mnemonic);
      const success = await this.generateRSAKeypairFromSeed(seed);
      if (success) this.mnemonicPhrase = mnemonic;
      return success;
    } catch (error) {
      console.error("❌ Key recovery failed:", error);
      return false;
    }
  }

  private async encryptWithAESForge(
    data: string,
    key: string,
  ): Promise<string> {
    const cipherInstance = forge.cipher.createCipher("AES-CBC", key);
    const iv = forge.random.getBytesSync(16);
    cipherInstance.start({ iv });
    cipherInstance.update(forge.util.createBuffer(data, "raw"));
    cipherInstance.finish();
    const encrypted = iv + cipherInstance.output.getBytes();
    return forge.util.encode64(encrypted);
  }

  private async decryptWithAESForge(
    encryptedData: string,
    key: string,
  ): Promise<string> {
    const encrypted = forge.util.decode64(encryptedData);
    const iv = encrypted.substring(0, 16);
    const data = encrypted.substring(16);
    const decipher = forge.cipher.createDecipher("AES-CBC", key);
    decipher.start({ iv });
    decipher.update(forge.util.createBuffer(data, "raw"));
    decipher.finish();
    return decipher.output.toString();
  }

  async encryptDataForLocalStorage(
    data: Uint8Array,
  ): Promise<Uint8Array | null> {
    try {
      const privateKey = await this.getPrivateKey();
      if (!privateKey) return null;
      const aesKey = this.randomValues.getRandomValues(new Uint8Array(32));
      const encryptedData = await this.encryptWithAES(data, aesKey);
      if (!encryptedData) return null;
      const aesKeyBase64 = base64Encode(aesKey.buffer as ArrayBuffer);
      const publicKey = await this.getPublicKey();
      if (!publicKey) return null;
      const encryptedKey = await this.encryptWithRSA(aesKeyBase64, publicKey);
      if (!encryptedKey) return null;
      const encryptedKeyBytes = new TextEncoder().encode(encryptedKey);
      const keyLength = new Uint8Array(4);
      new DataView(keyLength.buffer).setUint32(
        0,
        encryptedKeyBytes.length,
        false,
      );
      const combinedData = new Uint8Array(
        4 + encryptedKeyBytes.length + encryptedData.length,
      );
      combinedData.set(keyLength, 0);
      combinedData.set(encryptedKeyBytes, 4);
      combinedData.set(encryptedData, 4 + encryptedKeyBytes.length);
      return combinedData;
    } catch (error) {
      console.error("❌ Local encryption failed:", error);
      return null;
    }
  }

  async decryptDataFromLocalStorage(
    encryptedData: Uint8Array,
  ): Promise<Uint8Array | null> {
    try {
      const privateKey = await this.getPrivateKey();
      if (!privateKey) return null;
      if (encryptedData.length < 8) return null;
      const keyLength = new DataView(
        encryptedData.buffer,
        encryptedData.byteOffset,
        4,
      ).getUint32(0, false);
      if (
        keyLength <= 0 ||
        keyLength > 10000 ||
        encryptedData.length < 4 + keyLength
      )
        return null;
      const encryptedKeyBytes = encryptedData.slice(4, 4 + keyLength);
      const actualEncryptedData = encryptedData.slice(4 + keyLength);
      const encryptedKeyString = new TextDecoder().decode(encryptedKeyBytes);
      const aesKeyBase64 = await this.decryptWithRSA(
        encryptedKeyString,
        privateKey,
      );
      if (!aesKeyBase64) return null;
      const aesKey = new Uint8Array(base64Decode(aesKeyBase64));
      return await this.decryptWithAES(actualEncryptedData, aesKey);
    } catch (error) {
      console.error("❌ Local decryption failed:", error);
      return null;
    }
  }

  async prepareDataForRemoteTransmission(
    data: Uint8Array,
  ): Promise<Uint8Array | null> {
    try {
      const publicKey = await this.getPublicKey();
      if (!publicKey) return null;
      const aesKey = this.randomValues.getRandomValues(new Uint8Array(32));
      const encryptedData = await this.encryptWithAES(data, aesKey);
      if (!encryptedData) return null;
      const aesKeyBase64 = base64Encode(aesKey.buffer as ArrayBuffer);
      const encryptedKey = await this.encryptWithRSA(aesKeyBase64, publicKey);
      if (!encryptedKey) return null;
      const payload: TransmissionPayload = {
        encrypted_key: encryptedKey,
        encrypted_data: base64Encode(encryptedData.buffer as ArrayBuffer),
        algorithm: "REAL-RSA-2048-OAEP-SHA512-256-AES-256-CBC",
        timestamp: new Date().toISOString(),
      };
      return new TextEncoder().encode(JSON.stringify(payload));
    } catch (error) {
      console.error("❌ Failed to prepare data for transmission:", error);
      return null;
    }
  }

  async decryptRemoteTransmissionData(
    encryptedKey: string,
    encryptedData: string,
  ): Promise<Uint8Array | null> {
    try {
      const privateKey = await this.getPrivateKey();
      if (!privateKey) return null;
      const aesKeyBase64 = await this.decryptWithRSA(encryptedKey, privateKey);
      if (!aesKeyBase64) return null;
      const aesKey = new Uint8Array(base64Decode(aesKeyBase64));
      const encryptedDataBytes = new Uint8Array(base64Decode(encryptedData));
      return await this.decryptWithAES(encryptedDataBytes, aesKey);
    } catch (error) {
      console.error("❌ Remote decryption failed:", error);
      return null;
    }
  }

  private async encryptWithAES(
    data: Uint8Array,
    key: Uint8Array,
  ): Promise<Uint8Array | null> {
    try {
      const iv = forge.random.getBytesSync(16);
      const dataString = this.uint8ArrayToBinaryString(data);
      const keyString = this.uint8ArrayToBinaryString(key);
      const buffer = forge.util.createBuffer(dataString, "raw");
      const cipher = forge.cipher.createCipher("AES-CBC", keyString);
      cipher.start({ iv });
      cipher.update(buffer);
      if (!cipher.finish()) return null;
      const encryptedBytes = cipher.output.getBytes();
      const ivArray = this.binaryStringToUint8Array(iv);
      const encryptedArray = this.binaryStringToUint8Array(encryptedBytes);
      const result = new Uint8Array(ivArray.length + encryptedArray.length);
      result.set(ivArray, 0);
      result.set(encryptedArray, ivArray.length);
      return result;
    } catch (error) {
      console.error("❌ AES encryption failed:", error);
      return null;
    }
  }

  private async decryptWithAES(
    encryptedData: Uint8Array,
    key: Uint8Array,
  ): Promise<Uint8Array | null> {
    try {
      if (key.length !== 32 || encryptedData.length < 17) return null;
      const ivArray = encryptedData.slice(0, 16);
      const dataArray = encryptedData.slice(16);
      if (dataArray.length % 16 !== 0) return null;
      const iv = this.uint8ArrayToBinaryString(ivArray);
      const data = this.uint8ArrayToBinaryString(dataArray);
      const keyBytes = this.uint8ArrayToBinaryString(key);
      const decipher = forge.cipher.createDecipher("AES-CBC", keyBytes);
      decipher.start({ iv });
      decipher.update(forge.util.createBuffer(data, "raw"));
      if (!decipher.finish()) return null;
      return this.binaryStringToUint8Array(decipher.output.getBytes());
    } catch (error) {
      console.error("❌ AES decryption failed:", error);
      return null;
    }
  }

  private binaryStringToUint8Array(str: string): Uint8Array {
    const arr = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
    return arr;
  }

  private uint8ArrayToBinaryString(arr: Uint8Array): string {
    let str = "";
    const chunkSize = 32768;
    for (let i = 0; i < arr.length; i += chunkSize) {
      str += String.fromCharCode.apply(
        null,
        Array.from(arr.slice(i, i + chunkSize)),
      );
    }
    return str;
  }

  protected async getPrivateKey(): Promise<string | null> {
    try {
      return await this.storage.getItem(EnhancedRSAManager.PRIVATE_KEY_TAG);
    } catch (error) {
      console.error("❌ Failed to retrieve private key:", error);
      return null;
    }
  }

  protected async getPublicKey(): Promise<string | null> {
    try {
      return await this.storage.getItem(EnhancedRSAManager.PUBLIC_KEY_TAG);
    } catch (error) {
      console.error("❌ Failed to retrieve public key:", error);
      return null;
    }
  }

  async getStoredMnemonic(): Promise<string | null> {
    try {
      return await this.storage.getItem(EnhancedRSAManager.MNEMONIC_TAG);
    } catch (error) {
      return null;
    }
  }

  async loadKeysFromSecureStorage(): Promise<boolean> {
    try {
      const platformName = this.getStorageLocation();
      const [privateKey, publicKey, mnemonic, metadataStr] = await Promise.all([
        this.storage.getItem(EnhancedRSAManager.PRIVATE_KEY_TAG),
        this.storage.getItem(EnhancedRSAManager.PUBLIC_KEY_TAG),
        this.storage.getItem(EnhancedRSAManager.MNEMONIC_TAG),
        this.storage.getItem(EnhancedRSAManager.METADATA_TAG),
      ]);
      if (!privateKey || !publicKey || !mnemonic) return false;
      if (!this.validateKeyFormat(publicKey, privateKey)) return false;
      let metadata: any = null;
      if (metadataStr) {
        try {
          metadata = JSON.parse(metadataStr);
        } catch {
          metadata = null;
        }
      }
      if (!metadata) {
        metadata = {
          platform: this.platform,
          timestamp: "Unknown (legacy key)",
          storageLocation: platformName,
          keySize: "Unknown",
          version: "Legacy",
        };
      }
      this.publicKeyString = publicKey;
      this.mnemonicPhrase = mnemonic;
      this.isKeyGenerated = true;
      this.keyStorageInfo = metadata;
      return true;
    } catch (error) {
      console.error("❌ Failed to load keys from secure storage:", error);
      return false;
    }
  }

  async checkKeysInSecureStorage(): Promise<{
    exists: boolean;
    details: {
      privateKey: boolean;
      publicKey: boolean;
      mnemonic: boolean;
      metadata: boolean;
    };
    storageInfo?: any;
  }> {
    try {
      const [privateKey, publicKey, mnemonic, metadataStr] = await Promise.all([
        this.storage.getItem(EnhancedRSAManager.PRIVATE_KEY_TAG),
        this.storage.getItem(EnhancedRSAManager.PUBLIC_KEY_TAG),
        this.storage.getItem(EnhancedRSAManager.MNEMONIC_TAG),
        this.storage.getItem(EnhancedRSAManager.METADATA_TAG),
      ]);
      const details = {
        privateKey: !!privateKey,
        publicKey: !!publicKey,
        mnemonic: !!mnemonic,
        metadata: !!metadataStr,
      };
      let storageInfo: any = null;
      if (metadataStr) {
        try {
          storageInfo = JSON.parse(metadataStr);
          storageInfo.currentPlatform = this.getStorageLocation();
        } catch {
          storageInfo = null;
        }
      }
      return {
        exists: details.privateKey && details.publicKey && details.mnemonic,
        details,
        storageInfo,
      };
    } catch (error) {
      return {
        exists: false,
        details: {
          privateKey: false,
          publicKey: false,
          mnemonic: false,
          metadata: false,
        },
      };
    }
  }

  protected validateKeyFormat(publicKey: string, privateKey: string): boolean {
    const validPublicKey =
      publicKey.includes("-----BEGIN PUBLIC KEY-----") ||
      publicKey.includes("-----BEGIN RSA PUBLIC KEY-----");
    const validPrivateKey =
      privateKey.includes("-----BEGIN PRIVATE KEY-----") ||
      privateKey.includes("-----BEGIN RSA PRIVATE KEY-----");
    return validPublicKey && validPrivateKey;
  }

  async saveKeysToSecureStorage(): Promise<boolean> {
    try {
      if (!this.isKeyGenerated) return false;
      const privateKey = await this.getPrivateKey();
      if (!privateKey) return false;
      await Promise.all([
        this.storage.setItem(EnhancedRSAManager.PRIVATE_KEY_TAG, privateKey),
        this.storage.setItem(
          EnhancedRSAManager.PUBLIC_KEY_TAG,
          this.publicKeyString,
        ),
        this.storage.setItem(
          EnhancedRSAManager.MNEMONIC_TAG,
          this.mnemonicPhrase,
        ),
      ]);
      return true;
    } catch (error) {
      console.error("❌ Failed to save keys to secure storage:", error);
      return false;
    }
  }

  async clearKeys(): Promise<void> {
    try {
      await Promise.all([
        this.storage.removeItem(EnhancedRSAManager.PRIVATE_KEY_TAG),
        this.storage.removeItem(EnhancedRSAManager.PUBLIC_KEY_TAG),
        this.storage.removeItem(EnhancedRSAManager.MNEMONIC_TAG),
        this.storage.removeItem(EnhancedRSAManager.METADATA_TAG),
      ]);
      this.publicKeyString = "";
      this.isKeyGenerated = false;
      this.mnemonicPhrase = "";
      this.keyStorageInfo = null;
    } catch (error) {
      console.error("❌ Failed to clear keys:", error);
    }
  }

  stringToUint8Array(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }

  uint8ArrayToString(array: Uint8Array): string {
    return new TextDecoder().decode(array);
  }
}
