/**
 * expo-crypto-lib on-device verification harness.
 *
 * Runs the library's real flows inside Expo Go so the claims CI cannot check
 * are exercised on a device: Hermes engine support (X25519 needs BigInt,
 * hpke.ts needs TextEncoder at module scope), expo-crypto randomness,
 * expo-secure-store persistence, and authenticated-decryption failure codes.
 */

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import {
  CryptoError,
  CryptoManager,
  createCryptoManager,
  createExpoKeyStorage,
  createExpoRandomValues,
  validateMnemonicPhrase,
} from 'expo-crypto-lib';

type Result = { name: string; ok: boolean; detail: string };

const PREFIX = 'eg-check';

function bytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = i & 0xff;
  return a;
}

function codeOf(error: unknown): string {
  return error instanceof CryptoError
    ? error.code
    : `not a CryptoError: ${String(error)}`;
}

async function runAll(push: (r: Result) => void): Promise<void> {
  const check = async (name: string, fn: () => Promise<string> | string) => {
    try {
      push({ name, ok: true, detail: await fn() });
    } catch (error) {
      push({
        name,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // --- engine capabilities the library depends on ---
  await check('Hermes engine', () => {
    if (!(globalThis as any).HermesInternal) throw new Error('not running on Hermes');
    return 'HermesInternal present';
  });

  await check('BigInt available (X25519 needs it)', () => {
    const v = BigInt('9007199254740993') + BigInt(1);
    return `BigInt arithmetic ok (${v.toString()})`;
  });

  await check('TextEncoder available (hpke.ts module scope)', () => {
    const n = new TextEncoder().encode('☃').length;
    if (n !== 3) throw new Error(`expected 3 utf-8 bytes, got ${n}`);
    return 'native TextEncoder, 3-byte utf-8 ok';
  });

  // --- key generation through expo-crypto randomness ---
  const manager = createCryptoManager({
    platform: 'expo',
    storageKeyPrefix: PREFIX,
  });
  await manager.clear().catch(() => {});

  let mnemonic = '';
  await check('generate() via expo-crypto', async () => {
    const t0 = Date.now();
    mnemonic = await manager.generate();
    const ms = Date.now() - t0;
    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 24) throw new Error(`expected 24 words, got ${words.length}`);
    if (!validateMnemonicPhrase(mnemonic)) {
      throw new Error('BIP39 checksum rejected our own phrase');
    }
    return `24 words, checksum valid, ${ms} ms`;
  });

  await check('public key is 32 bytes', () => {
    const pk = manager.publicKey;
    if (pk.length !== 32) throw new Error(`got ${pk.length}`);
    return `${manager.publicKeyBase64} (${manager.publicKeyBase64.length} chars b64)`;
  });

  // --- at-rest encryption ---
  for (const size of [0, 1, 1024, 65536, 1024 * 1024]) {
    await check(`encryptLocal round-trip (${size} B)`, () => {
      const data = bytes(size);
      const t0 = Date.now();
      const sealed = manager.encryptLocal(data);
      const opened = manager.decryptLocal(sealed);
      const ms = Date.now() - t0;
      if (opened.length !== data.length) throw new Error('length mismatch');
      for (let i = 0; i < data.length; i++) {
        if (opened[i] !== data[i]) throw new Error(`byte ${i} differs`);
      }
      return `overhead ${sealed.length - size} B, ${ms} ms`;
    });
  }

  // --- HPKE to a public key: the BigInt-dependent path ---
  await check('encryptFor/decrypt round-trip (HPKE, X25519)', () => {
    const text = 'on-device hpke';
    const msg = new TextEncoder().encode(text);
    const t0 = Date.now();
    const sealed = manager.encryptFor(manager.publicKey, msg);
    const opened = manager.decrypt(sealed);
    const ms = Date.now() - t0;
    if (String.fromCharCode(...opened) !== text) throw new Error('plaintext mismatch');
    return `overhead ${sealed.length - msg.length} B, ${ms} ms`;
  });

  await check('two managers exchange (peer -> us)', async () => {
    const peer = new CryptoManager({
      keyStorage: createExpoKeyStorage(),
      randomValues: createExpoRandomValues(),
      storageKeyPrefix: `${PREFIX}-peer`,
    });
    await peer.generate();
    const sealed = peer.encryptFor(
      manager.publicKey,
      new TextEncoder().encode('hello from peer'),
    );
    const opened = manager.decrypt(sealed);
    await peer.clear();
    if (String.fromCharCode(...opened) !== 'hello from peer') {
      throw new Error('plaintext mismatch');
    }
    return 'peer-encrypted message opened with our private key';
  });

  // --- authenticated decryption must fail loudly ---
  await check('tampered ciphertext throws AUTH_FAILED', () => {
    const sealed = manager.encryptLocal(bytes(64));
    sealed[40] ^= 0x01;
    try {
      manager.decryptLocal(sealed);
    } catch (error) {
      const code = codeOf(error);
      if (code !== 'AUTH_FAILED') throw new Error(`expected AUTH_FAILED, got ${code}`);
      return 'AUTH_FAILED';
    }
    throw new Error('tampered ciphertext decrypted without error');
  });

  await check('bad phrase throws INVALID_MNEMONIC', async () => {
    try {
      await manager.recover('not a valid bip39 phrase at all');
    } catch (error) {
      const code = codeOf(error);
      if (code !== 'INVALID_MNEMONIC') {
        throw new Error(`expected INVALID_MNEMONIC, got ${code}`);
      }
      return 'INVALID_MNEMONIC';
    }
    throw new Error('invalid phrase was accepted');
  });

  // --- expo-secure-store persistence: the real Keychain/Keystore ---
  await check('keys persisted to secure storage', async () => {
    const seed = await SecureStore.getItemAsync(`${PREFIX}.seed`);
    const pub = await SecureStore.getItemAsync(`${PREFIX}.publicKey`);
    if (!seed || !pub) throw new Error('seed or publicKey missing from SecureStore');
    const size = new TextEncoder().encode(seed).length;
    if (size > 2048) throw new Error(`seed entry ${size} B exceeds the iOS limit`);
    return `seed ${size} B, publicKey ${pub.length} chars, both under 2048 B`;
  });

  await check('recovery phrase NOT persisted', async () => {
    for (const key of [
      `${PREFIX}.mnemonic`,
      `${PREFIX}.phrase`,
      `${PREFIX}.seedPhrase`,
    ]) {
      if (await SecureStore.getItemAsync(key)) {
        throw new Error(`${key} exists in SecureStore`);
      }
    }
    return 'no mnemonic entry in SecureStore';
  });

  await check('load() in a fresh manager restores the identity', async () => {
    const expected = manager.publicKeyBase64;
    const fresh = createCryptoManager({
      platform: 'expo',
      storageKeyPrefix: PREFIX,
    });
    if (!(await fresh.load())) throw new Error('load() returned false');
    if (fresh.publicKeyBase64 !== expected) {
      throw new Error('different public key after load');
    }
    return 'same public key read back from the Keychain';
  });

  await check('loadPublicKey() without touching the seed', async () => {
    const fresh = createCryptoManager({
      platform: 'expo',
      storageKeyPrefix: PREFIX,
    });
    const pk = await fresh.loadPublicKey();
    if (!pk || pk.length !== 32) throw new Error('no public key');
    if (fresh.isReady) throw new Error('isReady should still be false');
    return 'public key read, seed untouched';
  });

  await check('recover(phrase) is deterministic on device', async () => {
    const expected = manager.publicKeyBase64;
    const fresh = createCryptoManager({
      platform: 'expo',
      storageKeyPrefix: `${PREFIX}-recover`,
    });
    await fresh.recover(mnemonic);
    const same = fresh.publicKeyBase64 === expected;
    await fresh.clear();
    if (!same) throw new Error('recovered a different public key');
    return 'same public key from the phrase alone';
  });

  await check('clear() removes both entries', async () => {
    await manager.clear();
    const seed = await SecureStore.getItemAsync(`${PREFIX}.seed`);
    const pub = await SecureStore.getItemAsync(`${PREFIX}.publicKey`);
    if (seed || pub) throw new Error('entries survived clear()');
    return 'storage empty';
  });
}

export default function App() {
  const [results, setResults] = useState<Result[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      await runAll((r) => {
        if (live) setResults((prev) => [...prev, r]);
      });
      if (live) setDone(true);
    })();
    return () => {
      live = false;
    };
  }, []);

  const failed = results.filter((r) => !r.ok).length;
  const status = !done
    ? 'running…'
    : failed === 0
      ? `ALL ${results.length} PASSED`
      : `${failed} FAILED`;

  return (
    <View style={styles.root}>
      <View style={[styles.banner, done && (failed ? styles.bad : styles.good)]}>
        <Text style={styles.bannerText}>expo-crypto-lib on device</Text>
        <Text style={styles.bannerStatus}>{status}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {results.map((r, i) => (
          <View key={i} style={styles.row}>
            <Text style={[styles.mark, r.ok ? styles.okMark : styles.failMark]}>
              {r.ok ? '✓' : '✗'}
            </Text>
            <View style={styles.rowBody}>
              <Text style={styles.name}>{r.name}</Text>
              <Text style={[styles.detail, !r.ok && styles.failMark]}>{r.detail}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101816' },
  banner: {
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: '#17211f',
  },
  good: { backgroundColor: '#16302c' },
  bad: { backgroundColor: '#2e1c18' },
  bannerText: {
    color: '#7b8c88',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bannerStatus: { color: '#dce5e2', fontSize: 22, fontWeight: '600', marginTop: 2 },
  list: { padding: 12, paddingBottom: 48 },
  row: { flexDirection: 'row', marginBottom: 12 },
  mark: { width: 22, fontSize: 15, fontWeight: '700' },
  okMark: { color: '#57bfad' },
  failMark: { color: '#d2705c' },
  rowBody: { flex: 1 },
  name: { color: '#dce5e2', fontSize: 14 },
  detail: { color: '#7b8c88', fontSize: 12, marginTop: 2, fontFamily: 'Courier' },
});
