// src/screens/athlete/CheckInP2PScreen.tsx
// ============================================================
// Check-in P2P via Bluetooth LE + GPS
// Fluxo:
//  1. Escaneia dispositivos BLE próximos
//  2. Filtra por RSSI > -80 dBm (dentro do raio)
//  3. Gera ephemeral_token e envia para o backend
//  4. Backend valida cruzamento de tokens + ST_Within GPS
//  5. UI atualiza quórum em tempo real
// ============================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, ScrollView, Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { colors, fonts, spacing, radius, shadows } from '../../theme/tokens';

// ── Tipos ────────────────────────────────────────────────────
interface NearbyPlayer {
  athleteId:      string;
  name:           string;
  initials:       string;
  avatarColor:    string;
  rssi:           number;       // dBm — negativo, quanto mais próximo de 0 melhor
  distanceMeters: number;
  validated:      boolean;
}

interface CheckInState {
  matchId:           string;
  minQuorum:         number;
  validatedCount:    number;
  status:            'scanning' | 'validating' | 'quorum_reached' | 'error';
}

// ── Constantes ───────────────────────────────────────────────
const RSSI_MIN_DBM  = -80;
const RSSI_BARS = (rssi: number) => {
  if (rssi >= -60) return 4;
  if (rssi >= -70) return 3;
  if (rssi >= -80) return 2;
  return 1;
};
const RSSI_COLOR = (rssi: number) => {
  if (rssi >= -65) return colors.green;
  if (rssi >= -75) return colors.orange;
  return colors.red;
};

// Mock players (substituir por scan BLE real)
const MOCK_NEARBY: NearbyPlayer[] = [
  { athleteId: 'a1', name: 'Gustavo Silva', initials: 'GS', avatarColor: colors.orange, rssi: -62, distanceMeters: 3,  validated: true  },
  { athleteId: 'a2', name: 'Rafael Melo',   initials: 'RM', avatarColor: colors.blue,   rssi: -71, distanceMeters: 7,  validated: false },
  { athleteId: 'a3', name: 'Lucas Farias',  initials: 'LF', avatarColor: '#9B59B6',     rssi: -78, distanceMeters: 12, validated: false },
];

// ────────────────────────────────────────────────────────────
export default function CheckInP2PScreen() {
  const [state, setState] = useState<CheckInState>({
    matchId: 'match-uuid-placeholder',
    minQuorum: 6,
    validatedCount: 1,
    status: 'scanning',
  });
  const [nearby, setNearby]   = useState<NearbyPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  // Animação de pulso BLE
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1, duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0, duration: 0, useNativeDriver: true,
          }),
        ])
      ).start();
    };
    animate(pulse1, 0);
    animate(pulse2, 600);
    animate(pulse3, 1200);
  }, []);

  // Simula escaneamento BLE
  useEffect(() => {
    const timer = setTimeout(() => {
      setNearby(MOCK_NEARBY);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleCheckIn = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Pega localização GPS
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Ative a localização para fazer check-in.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

      // 2. Gera token efêmero
      const ephemeralToken = `${state.matchId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // 3. Envia para o backend
      // const response = await api.post('/checkin/p2p', {
      //   matchId:        state.matchId,
      //   athleteId:      currentUser.id,
      //   validatorId:    nearby[0]?.athleteId,
      //   bluetoothRssi:  nearby[0]?.rssi,
      //   latitude:       location.coords.latitude,
      //   longitude:      location.coords.longitude,
      //   ephemeralToken,
      // });

      // Mock de sucesso
      setState(prev => ({
        ...prev,
        validatedCount: prev.validatedCount + 1,
        status: prev.validatedCount + 1 >= prev.minQuorum ? 'quorum_reached' : 'validating',
      }));

    } catch (error) {
      Alert.alert('Erro', 'Não foi possível realizar o check-in. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [state, nearby]);

  const pulseScale = (anim: Animated.Value) => anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.3, 1.5],
  });
  const pulseOpacity = (anim: Animated.Value) => anim.interpolate({
    inputRange:  [0, 0.5, 1],
    outputRange: [0.8, 0.4, 0],
  });

  const quorumPct = Math.min(state.validatedCount / state.minQuorum, 1);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Status BLE */}
        <View style={styles.bleBadge}>
          <View style={styles.bleDot} />
          <Text style={styles.bleText}>Bluetooth LE · Ativo</Text>
        </View>

        {/* Título */}
        <Text style={styles.title}>Validar{'\n'}Presença</Text>
        <Text style={styles.subtitle}>
          Aproxime-se dos colegas.{'\n'}Raio de validação: 10 metros
        </Text>

        {/* Animação de pulso */}
        <View style={styles.pulseContainer}>
          {[pulse1, pulse2, pulse3].map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.pulseRing,
                {
                  opacity:   pulseOpacity(anim),
                  transform: [{ scale: pulseScale(anim) }],
                },
              ]}
            />
          ))}
          <View style={[styles.pulseCenter, shadows.blue]}>
            <Text style={styles.pulseCenterIcon}>📡</Text>
          </View>
        </View>

        {/* Barra de quórum */}
        <View style={styles.quorumContainer}>
          <View style={styles.quorumBar}>
            <Animated.View
              style={[
                styles.quorumFill,
                { width: `${quorumPct * 100}%` },
                quorumPct >= 1 && { backgroundColor: colors.green },
              ]}
            />
          </View>
          <View style={styles.quorumLabel}>
            <Text style={styles.quorumCount}>
              <Text style={[styles.quorumNum, quorumPct >= 1 && { color: colors.green }]}>
                {state.validatedCount}
              </Text>
              <Text style={styles.quorumDen}>/{state.minQuorum} validados</Text>
            </Text>
            {quorumPct >= 1 && (
              <View style={styles.quorumOkBadge}>
                <Text style={styles.quorumOkText}>QUÓRUM OK</Text>
              </View>
            )}
          </View>
        </View>

        {/* Lista de jogadores detectados */}
        <Text style={styles.sectionTitle}>JOGADORES DETECTADOS</Text>

        {nearby.length === 0 ? (
          <View style={styles.emptyNearby}>
            <Text style={styles.emptyText}>Escaneando...</Text>
          </View>
        ) : (
          nearby.map(player => (
            <View
              key={player.athleteId}
              style={[styles.playerRow, player.validated && styles.playerRowValidated]}
            >
              {/* Avatar */}
              <View style={[styles.avatar, { backgroundColor: player.avatarColor }]}>
                <Text style={styles.avatarText}>{player.initials}</Text>
              </View>

              {/* Info */}
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.name}</Text>
                <View style={styles.rssiRow}>
                  {/* Barras RSSI */}
                  <View style={styles.rssiBars}>
                    {[1,2,3,4].map(i => (
                      <View
                        key={i}
                        style={[
                          styles.rssiBar,
                          { height: 3 + i * 3 },
                          i <= RSSI_BARS(player.rssi)
                            ? { backgroundColor: RSSI_COLOR(player.rssi) }
                            : { backgroundColor: colors.bg4 },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.rssiText}>
                    {player.distanceMeters}m · {player.rssi} dBm
                  </Text>
                  {player.rssi < RSSI_MIN_DBM && (
                    <Text style={styles.rssiWarn}>Longe demais</Text>
                  )}
                </View>
              </View>

              {/* Status de validação */}
              <View style={[
                styles.validateBtn,
                player.validated
                  ? styles.validateBtnOk
                  : styles.validateBtnPending,
              ]}>
                <Text style={styles.validateBtnIcon}>
                  {player.validated ? '✓' : '○'}
                </Text>
              </View>
            </View>
          ))
        )}

        {/* Botão de check-in */}
        <TouchableOpacity
          style={[
            styles.checkInBtn,
            state.status === 'quorum_reached' && styles.checkInBtnSuccess,
            loading && styles.checkInBtnLoading,
          ]}
          onPress={handleCheckIn}
          disabled={loading}
        >
          <Text style={styles.checkInBtnText}>
            {loading ? 'VALIDANDO...' :
             state.status === 'quorum_reached' ? 'JOGO CONFIRMADO!' :
             'FAZER CHECK-IN'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll:    { alignItems: 'center', paddingTop: 60 },

  bleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(74,158,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(74,158,255,0.2)',
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6,
    marginBottom: 16,
  },
  bleDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.blue },
  bleText: { fontSize: 12, fontWeight: '600', color: colors.blue, fontFamily: fonts.medium },

  title: {
    fontFamily: fonts.display, fontSize: 40, color: colors.text,
    textAlign: 'center', lineHeight: 42,
  },
  subtitle: {
    fontSize: 13, color: colors.text2, textAlign: 'center',
    marginTop: 8, fontFamily: fonts.body, lineHeight: 20,
  },

  pulseContainer: {
    width: 180, height: 180, alignItems: 'center', justifyContent: 'center',
    marginVertical: 24,
  },
  pulseRing: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    borderWidth: 2, borderColor: colors.blue,
  },
  pulseCenter: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center',
  },
  pulseCenterIcon: { fontSize: 28 },

  quorumContainer: { width: '100%', paddingHorizontal: spacing.xl, marginBottom: 20 },
  quorumBar: {
    height: 6, backgroundColor: colors.bg3,
    borderRadius: 3, overflow: 'hidden', marginBottom: 8,
  },
  quorumFill: { height: '100%', backgroundColor: colors.orange, borderRadius: 3 },
  quorumLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quorumCount: { fontFamily: fonts.body, fontSize: 13, color: colors.text2 },
  quorumNum:   { fontFamily: fonts.display, fontSize: 22, color: colors.orange },
  quorumDen:   { fontSize: 13, color: colors.text2 },
  quorumOkBadge: {
    backgroundColor: 'rgba(0,229,160,0.15)', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  quorumOkText: { fontSize: 10, fontWeight: '700', color: colors.green, fontFamily: fonts.medium },

  sectionTitle: {
    fontFamily: fonts.display, fontSize: 13, letterSpacing: 2,
    color: colors.text2, alignSelf: 'flex-start',
    paddingHorizontal: spacing.xl, marginBottom: 8,
  },

  emptyNearby: { padding: 20 },
  emptyText:   { color: colors.text3, fontFamily: fonts.body },

  playerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bg3,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 12,
    marginHorizontal: spacing.xl, marginBottom: 8, width: '100%',
    maxWidth: 350,
  },
  playerRowValidated: { borderColor: 'rgba(0,229,160,0.3)' },

  avatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 15, fontWeight: '800', color: 'white' },

  playerInfo: { flex: 1 },
  playerName: { fontSize: 13, fontWeight: '600', color: colors.text, fontFamily: fonts.medium },
  rssiRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  rssiBars:   { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  rssiBar:    { width: 4, borderRadius: 1 },
  rssiText:   { fontSize: 11, color: colors.text2, fontFamily: fonts.body },
  rssiWarn:   { fontSize: 10, color: colors.red, fontFamily: fonts.body },

  validateBtn: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  validateBtnOk: {
    backgroundColor: 'rgba(0,229,160,0.2)',
    borderColor: 'rgba(0,229,160,0.4)',
  },
  validateBtnPending: {
    backgroundColor: colors.bg4,
    borderColor: colors.border,
  },
  validateBtnIcon: { fontSize: 14, color: colors.text },

  checkInBtn: {
    backgroundColor: colors.green, borderRadius: radius.lg,
    paddingVertical: 16, paddingHorizontal: 40,
    marginHorizontal: spacing.xl, marginTop: 12,
    alignItems: 'center', width: '100%', maxWidth: 350,
  },
  checkInBtnSuccess: { backgroundColor: colors.green },
  checkInBtnLoading: { opacity: 0.6 },
  checkInBtnText: {
    fontFamily: fonts.display, fontSize: 18,
    fontWeight: '800', color: '#0A0A0F', letterSpacing: 1,
  },
});
