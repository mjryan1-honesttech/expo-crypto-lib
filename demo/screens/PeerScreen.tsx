/**
 * Encryption to someone else's public key: HPKE base mode (RFC 9180,
 * X25519-HKDF-SHA256 + ChaCha20-Poly1305).
 *
 * A second CryptoManager backed by in-memory storage plays the recipient, so
 * the whole exchange can be seen on one phone. The manual section below does
 * the same thing across two real devices.
 */

import { useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import {
  abbreviate,
  decodeBase64,
  decodeUtf8,
  describeError,
  encodeBase64,
  encodeUtf8,
  me,
  peer,
} from '../crypto';
import { Button, Card, Input, Mono, Note, Row, Status } from '../ui';

type Exchange = { direction: string; envelope: Uint8Array; plaintext: string };

export default function PeerScreen({
  ready,
  publicKey,
  peerPublicKey,
}: {
  ready: boolean;
  publicKey: string | null;
  peerPublicKey: string | null;
}) {
  const [message, setMessage] = useState('meet me at the usual place');
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [recipientKey, setRecipientKey] = useState('');
  const [inbound, setInbound] = useState('');
  const [outbound, setOutbound] = useState<string | null>(null);
  const [received, setReceived] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  const run = (fn: () => void) => {
    try {
      fn();
      setStatus(null);
    } catch (error) {
      setStatus({ ok: false, message: describeError(error) });
    }
  };

  return (
    <View>
      <Card title="Send to a public key">
        <Note>
          encryptFor() needs only the recipient's 32-byte public key — no shared
          secret, no prior handshake, no round trip. Each message carries its own
          ephemeral key, so two encryptions of the same text never match.
        </Note>

        {publicKey && (
          <Mono label="You" value={abbreviate(publicKey)} />
        )}
        {peerPublicKey && (
          <Mono label="Simulated peer (in memory)" value={abbreviate(peerPublicKey)} />
        )}

        <Input
          multiline
          placeholder="message"
          value={message}
          onChangeText={setMessage}
        />
        <Row>
          <Button
            label="You → peer"
            kind="primary"
            disabled={!ready || !peerPublicKey}
            onPress={() =>
              run(() => {
                const envelope = me.encryptFor(
                  peer.publicKey,
                  encodeUtf8(message),
                );
                setExchange({
                  direction: 'You → peer',
                  envelope,
                  plaintext: decodeUtf8(peer.decrypt(envelope)),
                });
              })
            }
          />
          <Button
            label="Peer → you"
            disabled={!ready || !peerPublicKey}
            onPress={() =>
              run(() => {
                const envelope = peer.encryptFor(
                  me.publicKey,
                  encodeUtf8(message),
                );
                setExchange({
                  direction: 'Peer → you',
                  envelope,
                  plaintext: decodeUtf8(me.decrypt(envelope)),
                });
              })
            }
          />
        </Row>

        {!ready && <Note>Create an identity on the Identity tab first.</Note>}

        {exchange && (
          <>
            <Mono
              label={exchange.direction}
              value={`${exchange.envelope.length} bytes  ·  32-byte ephemeral key + 16-byte tag + 2-byte header`}
            />
            <Mono
              label="Envelope (base64)"
              value={encodeBase64(exchange.envelope)}
            />
            <Mono label="Recipient reads" value={exchange.plaintext} />
          </>
        )}
        {status && <Status ok={status.ok} message={status.message} />}
      </Card>

      <Card title="Across two real devices">
        <Note>
          Run this app on a second phone, copy its public key from the Identity
          tab, and paste it here. Send the resulting base64 back, and paste what
          you receive into the second box.
        </Note>

        <Input
          placeholder="recipient public key (base64)"
          value={recipientKey}
          onChangeText={setRecipientKey}
        />
        <Row>
          <Button
            label="Encrypt to them"
            disabled={recipientKey.trim().length === 0}
            onPress={() =>
              run(() => {
                const envelope = me.encryptFor(
                  decodeBase64(recipientKey),
                  encodeUtf8(message),
                );
                setOutbound(encodeBase64(envelope));
              })
            }
          />
          {outbound && (
            <Button
              label="Copy"
              onPress={() => Clipboard.setStringAsync(outbound)}
            />
          )}
        </Row>
        {outbound && <Mono label="Send this" value={abbreviate(outbound, 24)} />}

        <Input
          multiline
          placeholder="envelope you received (base64)"
          value={inbound}
          onChangeText={setInbound}
        />
        <Row>
          <Button
            label="Decrypt"
            disabled={!ready || inbound.trim().length === 0}
            onPress={() =>
              run(() => {
                setReceived(decodeUtf8(me.decrypt(decodeBase64(inbound))));
              })
            }
          />
        </Row>
        {received !== null && <Mono label="Plaintext" value={received} />}
      </Card>
    </View>
  );
}
