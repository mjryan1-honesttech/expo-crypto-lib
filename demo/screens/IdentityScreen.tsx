/**
 * Identity: generate, recover, clear.
 *
 * The point this screen makes is that the 24-word phrase is returned exactly
 * once by generate() and is never written to storage — only the seed and the
 * public key are. Recovering from the phrase alone reproduces the same key.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { describeError, me } from '../crypto';
import { Button, Card, Input, Mono, Note, Row, Status, theme } from '../ui';

export default function IdentityScreen({
  publicKey,
  refresh,
}: {
  publicKey: string | null;
  refresh: () => Promise<void>;
}) {
  const [phrase, setPhrase] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  const run = async (message: string, fn: () => Promise<void>) => {
    try {
      await fn();
      await refresh();
      setStatus({ ok: true, message });
    } catch (error) {
      setStatus({ ok: false, message: describeError(error) });
    }
  };

  return (
    <View>
      <Card title="Your identity">
        <Note>
          A 24-word BIP39 phrase derives a 64-byte seed, which derives an X25519
          keypair. The seed and public key go to the Keychain (iOS) or Keystore
          (Android); the phrase itself is never stored anywhere.
        </Note>

        {publicKey ? (
          <Mono
            label="X25519 public key (base64)"
            value={publicKey}
            onPress={() => Clipboard.setStringAsync(publicKey)}
          />
        ) : (
          <Note>No identity yet. Generate one, or recover from a phrase.</Note>
        )}

        <Row>
          <Button
            label="Generate"
            kind="primary"
            onPress={() =>
              run('New identity created and stored', async () => {
                setPhrase(await me.generate());
              })
            }
          />
          <Button
            label="Load from storage"
            onPress={() =>
              run('Loaded from secure storage', async () => {
                if (!(await me.load())) throw new Error('Nothing stored yet');
              })
            }
          />
          <Button
            label="Clear"
            kind="danger"
            onPress={() =>
              run('Storage cleared', async () => {
                await me.clear();
                setPhrase(null);
              })
            }
          />
        </Row>

        {status && <Status ok={status.ok} message={status.message} />}
      </Card>

      {phrase && (
        <Card title="Recovery phrase — shown once">
          <Note>
            Write these down. The library returns them here and nowhere else; a
            stolen device gives up the seed, not the phrase.
          </Note>
          <View style={s.grid}>
            {phrase.split(' ').map((word, i) => (
              <View key={i} style={s.word}>
                <Text style={s.index}>{i + 1}</Text>
                <Text style={s.wordText}>{word}</Text>
              </View>
            ))}
          </View>
          <Row>
            <Button
              label="Copy phrase"
              onPress={() => Clipboard.setStringAsync(phrase)}
            />
            <Button label="Hide" onPress={() => setPhrase(null)} />
          </Row>
        </Card>
      )}

      <Card title="Recover from a phrase">
        <Note>
          Paste a phrase to rebuild the same identity. Try changing one word:
          the BIP39 checksum rejects it with INVALID_MNEMONIC before any key
          derivation happens.
        </Note>
        <Input
          multiline
          placeholder="abandon abandon … art"
          value={typed}
          onChangeText={setTyped}
        />
        <Row>
          <Button
            label="Recover"
            kind="primary"
            disabled={typed.trim().length === 0}
            onPress={() =>
              run('Identity recovered from the phrase', () =>
                me.recover(typed.trim()),
              )
            }
          />
        </Row>
      </Card>
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  word: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    backgroundColor: theme.bg,
    borderRadius: 5,
    paddingVertical: 4,
    paddingHorizontal: 7,
  },
  index: { color: theme.dim, fontSize: 9, fontFamily: theme.mono },
  wordText: { color: theme.text, fontSize: 12, fontFamily: theme.mono },
});
