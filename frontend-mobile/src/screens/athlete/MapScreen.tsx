// src/screens/athlete/MapScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated,
} from 'react-native';
import MapView, { Marker, Heatmap, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { colors, fonts, spacing, radius } from '../../theme/tokens';

// ── Tipos ────────────────────────────────────────────────────
type CourtStatus = 'active' | 'busy' | 'maintenance';

interface Court {
  id:          string;
  name:        string;
  district:    string;
  latitude:    number;
  longitude:   number;
  status:      CourtStatus;
  activeMatch: string | null;
  players:     number;
  distanceKm:  number;
}

interface HeatPoint {
  latitude:  number;
  longitude: number;
  weight:    number;
}

// ── Dados mock (substituir por API) ─────────────────────────
const MOCK_COURTS: Court[] = [
  {
    id: '1', name: 'Praça da Encol', district: 'Bela Vista',
    latitude: -30.0412, longitude: -51.1979,
    status: 'busy', activeMatch: '3v3 rolando', players: 6, distanceKm: 0.8,
  },
  {
    id: '2', name: 'Parcão', district: 'Moinhos de Vento',
    latitude: -30.0300, longitude: -51.1940,
    status: 'active', activeMatch: null, players: 0, distanceKm: 1.4,
  },
  {
    id: '3', name: 'Marinha do Brasil', district: 'Praia de Belas',
    latitude: -30.0480, longitude: -51.2261,
    status: 'maintenance', activeMatch: null, players: 0, distanceKm: 2.1,
  },
  {
    id: '4', name: 'Praça Germânia', district: "Passo d'Areia",
    latitude: -30.0170, longitude: -51.1580,
    status: 'active', activeMatch: '1v1', players: 2, distanceKm: 3.2,
  },
  {
    id: '5', name: 'Parque Redenção', district: 'Farroupilha',
    latitude: -30.0366, longitude: -51.2125,
    status: 'busy', activeMatch: '5v5', players: 10, distanceKm: 1.9,
  },
];

const MOCK_HEAT: HeatPoint[] = MOCK_COURTS.map(c => ({
  latitude:  c.latitude,
  longitude: c.longitude,
  weight:    c.players > 0 ? c.players / 10 : 0.1,
}));

// ── Status → cor ─────────────────────────────────────────────
const statusColor = (s: CourtStatus) => ({
  active:      colors.green,
  busy:        colors.orange,
  maintenance: colors.text3,
}[s]);

const statusLabel = (c: Court) => {
  if (c.status === 'maintenance') return 'Manutenção';
  if (c.activeMatch) return c.activeMatch;
  return 'Disponível';
};

const statusBadgeStyle = (s: CourtStatus) => ({
  active:      styles.badgeGreen,
  busy:        styles.badgeOrange,
  maintenance: styles.badgeGray,
}[s]);

// ────────────────────────────────────────────────────────────
export default function MapScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [selected, setSelected]  = useState<Court | null>(null);
  const slideAnim = useRef(new Animated.Value(200)).current;

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    })();
  }, []);

  const selectCourt = (court: Court) => {
    setSelected(court);
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, tension: 80, friction: 10,
    }).start();
  };

  const deselectCourt = () => {
    Animated.timing(slideAnim, {
      toValue: 200, duration: 200, useNativeDriver: true,
    }).start(() => setSelected(null));
  };

  const region = {
    latitude:       location?.coords.latitude  ?? -30.0346,
    longitude:      location?.coords.longitude ?? -51.2177,
    latitudeDelta:  0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>

      {/* Mapa */}
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        customMapStyle={darkMapStyle}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Heatmap de ocupação */}
        <Heatmap
          points={MOCK_HEAT}
          radius={40}
          opacity={0.7}
          gradient={{
            colors:     ['#00E5A0', '#FF6B1A', '#FF4A6B'],
            startPoints: [0.1, 0.5, 1.0],
            colorMapSize: 256,
          }}
        />

        {/* Marcadores */}
        {MOCK_COURTS.map(court => (
          <React.Fragment key={court.id}>
            <Circle
              center={{ latitude: court.latitude, longitude: court.longitude }}
              radius={80}
              fillColor={`${statusColor(court.status)}22`}
              strokeColor={`${statusColor(court.status)}66`}
              strokeWidth={1}
            />
            <Marker
              coordinate={{ latitude: court.latitude, longitude: court.longitude }}
              onPress={() => selectCourt(court)}
            >
              <View style={[styles.pin, { borderColor: statusColor(court.status) }]}>
                <View style={[styles.pinDot, { backgroundColor: statusColor(court.status) }]} />
              </View>
            </Marker>
          </React.Fragment>
        ))}
      </MapView>

      {/* Overlay: raio e legenda */}
      <View style={styles.radiusBadge}>
        <Text style={styles.radiusLabel}>Raio </Text>
        <Text style={styles.radiusValue}>5km</Text>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.orange }]} />
          <Text style={styles.legendText}>Movimentado</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.green }]} />
          <Text style={styles.legendText}>Disponível</Text>
        </View>
      </View>

      {/* Card de court selecionado */}
      {selected && (
        <Animated.View
          style={[styles.selectedCard, { transform: [{ translateY: slideAnim }] }]}
        >
          <TouchableOpacity style={styles.closeBtn} onPress={deselectCourt}>
            <Text style={styles.closeBtnText}>×</Text>
          </TouchableOpacity>
          <View style={styles.selectedHeader}>
            <View style={[styles.selectedDot, { backgroundColor: statusColor(selected.status) }]} />
            <Text style={styles.selectedName}>{selected.name}</Text>
          </View>
          <Text style={styles.selectedDistrict}>{selected.district}</Text>
          <View style={styles.selectedMeta}>
            <View style={statusBadgeStyle(selected.status)}>
              <Text style={styles.badgeText}>{statusLabel(selected)}</Text>
            </View>
            <Text style={styles.selectedDist}>{selected.distanceKm}km</Text>
          </View>
          <TouchableOpacity style={styles.ctaBtn}>
            <Text style={styles.ctaBtnText}>VER PARTIDAS</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Lista de quadras */}
      {!selected && (
        <View style={styles.listContainer}>
          <Text style={styles.listTitle}>QUADRAS PRÓXIMAS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listScroll}
          >
            {MOCK_COURTS.map(court => (
              <TouchableOpacity
                key={court.id}
                style={styles.courtCard}
                onPress={() => selectCourt(court)}
              >
                <View style={[styles.cardDot, { backgroundColor: statusColor(court.status) }]} />
                <Text style={styles.cardName} numberOfLines={1}>{court.name}</Text>
                <Text style={styles.cardDistrict} numberOfLines={1}>{court.district}</Text>
                <Text style={[styles.cardDist, { color: statusColor(court.status) }]}>
                  {court.distanceKm}km
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.qaBtn}>
          <Text style={styles.qaIcon}>+</Text>
          <Text style={styles.qaLabel}>Criar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.qaBtn, styles.qaBtnBlue]}>
          <Text style={styles.qaIcon}>◎</Text>
          <Text style={styles.qaLabel}>Check-in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  map:       { flex: 1 },

  radiusBadge: {
    position: 'absolute', top: 56, left: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(10,10,15,0.9)',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6,
  },
  radiusLabel: { fontSize: 11, color: colors.text2, fontFamily: fonts.body },
  radiusValue: { fontSize: 16, color: colors.orange, fontFamily: fonts.display },

  legend: {
    position: 'absolute', bottom: 260, right: 16,
    backgroundColor: 'rgba(10,10,15,0.9)',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: 8, gap: 4,
  },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendText:  { fontSize: 10, color: colors.text2, fontFamily: fonts.body },

  pin: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.bg3,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  pinDot: { width: 8, height: 8, borderRadius: 4 },

  selectedCard: {
    position: 'absolute', bottom: 90, left: 16, right: 16,
    backgroundColor: colors.bg3,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: spacing.lg,
  },
  closeBtn:      { position: 'absolute', top: 12, right: 14 },
  closeBtnText:  { fontSize: 20, color: colors.text2 },
  selectedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectedDot:   { width: 10, height: 10, borderRadius: 5 },
  selectedName:  { fontSize: 18, fontFamily: fonts.display, color: colors.text, flex: 1 },
  selectedDistrict: { fontSize: 12, color: colors.text2, marginLeft: 18, marginTop: 2, fontFamily: fonts.body },
  selectedMeta:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  selectedDist:  { fontSize: 22, fontFamily: fonts.display, color: colors.orange },
  ctaBtn: {
    backgroundColor: colors.orange, borderRadius: radius.md,
    padding: 12, alignItems: 'center', marginTop: 12,
  },
  ctaBtnText: { fontFamily: fonts.display, fontSize: 15, color: '#0A0A0F', letterSpacing: 1 },

  listContainer: {
    position: 'absolute', bottom: 90, left: 0, right: 0, paddingBottom: 8,
  },
  listTitle: {
    fontSize: 11, fontFamily: fonts.display, color: colors.text2,
    letterSpacing: 2, paddingHorizontal: 20, marginBottom: 8,
  },
  listScroll:   { paddingHorizontal: 16, gap: 8 },
  courtCard: {
    backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 12, width: 140,
  },
  cardDot:      { width: 8, height: 8, borderRadius: 4, marginBottom: 6 },
  cardName:     { fontSize: 13, fontWeight: '600', color: colors.text, fontFamily: fonts.medium },
  cardDistrict: { fontSize: 10, color: colors.text2, marginTop: 2, fontFamily: fonts.body },
  cardDist:     { fontSize: 20, fontFamily: fonts.display, marginTop: 6 },

  quickActions: {
    position: 'absolute', bottom: 8, right: 16,
    flexDirection: 'row', gap: 8,
  },
  qaBtn: {
    width: 52, height: 52, borderRadius: radius.lg,
    backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center',
  },
  qaBtnBlue: { backgroundColor: colors.blue },
  qaIcon:    { fontSize: 20, color: 'white' },
  qaLabel:   { fontSize: 8, color: 'rgba(255,255,255,0.8)', fontFamily: fonts.body },

  badgeGreen:  { backgroundColor: 'rgba(0,229,160,0.15)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOrange: { backgroundColor: 'rgba(255,107,26,0.15)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeGray:   { backgroundColor: 'rgba(90,90,114,0.2)',   borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontSize: 9, fontWeight: '700', fontFamily: fonts.body, color: colors.text2 },
});

// Google Maps dark style
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#111118' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9090A8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A0F' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1A1A24' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2A2A3A' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A0A1A' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0A1A10' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
