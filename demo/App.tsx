/**
 * expo-crypto-lib demo: three tabs over the library's public surface.
 *
 * Identity — generate / recover / clear a BIP39-backed X25519 identity
 * At rest  — encryptLocal, decryptLocal, and what a tampered byte does
 * To a key — HPKE to a recipient's public key, on one phone or across two
 */

import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { me, peer } from './crypto';
import IdentityScreen from './screens/IdentityScreen';
import LocalScreen from './screens/LocalScreen';
import PeerScreen from './screens/PeerScreen';
import { theme } from './ui';

const TABS = ['Identity', 'At rest', 'To a key'] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [tab, setTab] = useState<Tab>('Identity');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [peerPublicKey, setPeerPublicKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPublicKey(me.isReady ? me.publicKeyBase64 : null);
  }, []);

  useEffect(() => {
    (async () => {
      await me.load();
      await peer.generate();
      setPeerPublicKey(peer.publicKeyBase64);
      await refresh();
    })();
  }, [refresh]);

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Text style={s.title}>expo-crypto-lib</Text>
        <Text style={s.subtitle}>
          {publicKey ? 'identity loaded' : 'no identity yet'}
        </Text>
      </View>

      <View style={s.tabs}>
        {TABS.map((name) => (
          <Pressable
            key={name}
            onPress={() => setTab(name)}
            style={[s.tab, tab === name && s.tabActive]}
          >
            <Text style={[s.tabText, tab === name && s.tabTextActive]}>
              {name}
            </Text>
          </Pressable>
        ))}
      </View>

      <KeyboardAvoidingView
        style={s.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'Identity' && (
            <IdentityScreen publicKey={publicKey} refresh={refresh} />
          )}
          {tab === 'At rest' && <LocalScreen ready={publicKey !== null} />}
          {tab === 'To a key' && (
            <PeerScreen
              ready={publicKey !== null}
              publicKey={publicKey}
              peerPublicKey={peerPublicKey}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: { paddingTop: 58, paddingHorizontal: 16, paddingBottom: 10 },
  title: { color: theme.text, fontSize: 20, fontWeight: '600' },
  subtitle: { color: theme.dim, fontSize: 12, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  tab: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.line,
  },
  tabActive: { borderColor: theme.accent, backgroundColor: '#16302c' },
  tabText: { color: theme.dim, fontSize: 13 },
  tabTextActive: { color: theme.accent, fontWeight: '600' },
  body: { flex: 1 },
  scroll: { padding: 12, paddingBottom: 60 },
});
