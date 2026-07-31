/**
 * Encryption at rest: encryptLocal / decryptLocal, plus the tamper case.
 *
 * The envelope is self-describing — two header bytes, authenticated as AEAD
 * associated data — so the screen can decode and show them with readMode().
 */

import { useState } from 'react';
import { View } from 'react-native';
import { MODE_LOCAL, VERSION, readMode } from 'expo-crypto-lib';

import { decodeUtf8, describeError, encodeBase64, encodeUtf8, me } from '../crypto';
import { Button, Card, Input, Mono, Note, Row, Status } from '../ui';

export default function LocalScreen({ ready }: { ready: boolean }) {
  const [message, setMessage] = useState('my api token');
  const [sealed, setSealed] = useState<Uint8Array | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  const run = (ok: string, fn: () => void) => {
    try {
      fn();
      setStatus({ ok: true, message: ok });
    } catch (error) {
      setStatus({ ok: false, message: describeError(error) });
    }
  };

  const modeLabel = (envelope: Uint8Array) =>
    readMode(envelope) === MODE_LOCAL ? 'local (0x00)' : 'hpke (0x01)';

  return (
    <View>
      <Card title="Encrypt for this device">
        <Note>
          XChaCha20-Poly1305 under a key derived from your seed. Only this
          identity can open it — reinstall the app without the phrase and the
          data is gone for good.
        </Note>
        <Input
          multiline
          placeholder="something worth protecting"
          value={message}
          onChangeText={setMessage}
        />
        <Row>
          <Button
            label="Encrypt"
            kind="primary"
            disabled={!ready}
            onPress={() =>
              run('Sealed', () => {
                setSealed(me.encryptLocal(encodeUtf8(message)));
                setOpened(null);
              })
            }
          />
          <Button
            label="Decrypt"
            disabled={!sealed}
            onPress={() =>
              run('Opened', () => {
                setOpened(decodeUtf8(me.decryptLocal(sealed!)));
              })
            }
          />
          <Button
            label="Flip a byte"
            kind="danger"
            disabled={!sealed}
            onPress={() =>
              run('', () => {
                const tampered = Uint8Array.from(sealed!);
                tampered[tampered.length - 1] ^= 0x01;
                setOpened(decodeUtf8(me.decryptLocal(tampered)));
              })
            }
          />
        </Row>

        {!ready && <Note>Create an identity on the Identity tab first.</Note>}

        {sealed && (
          <>
            <Mono
              label="Envelope"
              value={`${sealed.length} bytes  ·  version 0x0${VERSION}  ·  mode ${modeLabel(sealed)}  ·  ${sealed.length - encodeUtf8(message).length} bytes overhead`}
            />
            <Mono label="Ciphertext (base64)" value={encodeBase64(sealed)} />
          </>
        )}

        {opened !== null && <Mono label="Decrypted" value={opened} />}
        {status && status.message !== '' && (
          <Status ok={status.ok} message={status.message} />
        )}
      </Card>

      <Card title="What “Flip a byte” shows">
        <Note>
          Changing a single bit of the ciphertext makes the Poly1305 tag check
          fail, and the library throws CryptoError with code AUTH_FAILED rather
          than returning garbage. The header bytes are covered too: they are
          passed as associated data, so a mode or version swap is detected the
          same way.
        </Note>
      </Card>
    </View>
  );
}
