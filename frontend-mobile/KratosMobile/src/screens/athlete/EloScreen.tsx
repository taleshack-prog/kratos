import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useMyProfile, useMyReputation } from '../../hooks/useKratosApi';
import { useAuthStore } from '../../store/authStore';

const C = {
  bg: '#0A0A0F', bg2: '#111118', bg3: '#1A1A24', bg4: '#22222E',
  orange: '#FF6B1A', green: '#00E5A0', blue: '#4A9EFF',
  red: '#FF4A6B', text: '#F0F0F8', text2: '#9090A8', text3: '#5A5A72',
  border: '#2A2A3A',
};

const SectionTitle = ({ children }: { children: string }) => (
  <Text style={s.sectionTitle}>{children}</Text>
);

const Badge = ({ label, color }: { label: string; color: string }) => (
  <View style={[s.badge, { backgroundColor: color + '22', borderColor: color + '44' }]}>
    <Text style={[s.badgeText, { color }]}>{label}</Text>
  </View>
);

export default function EloScreen() {
  const { data: profile, isLoading, error } = useMyProfile();
  const { data: reputation } = useMyReputation();
  const { athlete: session } = useAuthStore();

  if (isLoading) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.centered}>
          <ActivityIndicator color={C.orange} size="large" />
          <Text style={s.loadingText}>Carregando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.centered}>
          <Text style={{ color: C.red, fontSize: 14 }}>Erro ao carregar perfil.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const eloComposite = Math.round(profile.eloH * 0.5 + profile.eloC * 0.3 + profile.eloZ * 0.2);
  const eloMax = 3000;

  const dims = [
    { key: 'H', label: 'Habilidade',    value: profile.eloH, color: C.orange, pct: profile.eloH / eloMax },
    { key: 'C', label: 'Comportamento', value: profile.eloC, color: C.blue,   pct: profile.eloC / eloMax },
    { key: 'Z', label: 'Zeladoria',     value: profile.eloZ, color: C.green,  pct: profile.eloZ / eloMax },
  ];

  const reputationScore = parseFloat(profile.reputationScore || '0');
  const initials = profile.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const reputationEvents = reputation?.events || [];
  const history = reputationEvents.length > 0
    ? reputationEvents.slice(-8).map((e: any) => Math.max(10, Math.min(100, 50 + e.delta * 10)))
    : [50, 50, 50, 50, 50, 50, 50, 50];

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Hero */}
        <View style={s.eloHero}>
          <View style={s.eloAvatar}>
            <Text style={s.eloAvatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.eloName}>{profile.name}</Text>
            <Text style={s.eloPos}>
              {profile.position || 'Atleta'} · Porto Alegre
            </Text>
            <Text style={s.eloComposite}>{eloComposite}</Text>
            <Text style={s.eloCompositeLabel}>ELO COMPOSTO</Text>
          </View>
        </View>

        {/* Badges */}
        <View style={s.badgeRow}>
          {profile.isCaptain && <Badge label="Capitão" color={C.orange} />}
          <Badge label={`Reputação ${reputationScore.toFixed(0)}/100`} color={C.green} />
          {profile.position && <Badge label={profile.position} color={C.blue} />}
          {!profile.isCaptain && <Badge label="Atleta" color={C.text2} />}
        </View>

        {/* Barras Elo */}
        <SectionTitle>DIMENSÕES DO ELO</SectionTitle>
        <View style={{ gap: 12, marginTop: 12 }}>
          {dims.map(d => (
            <View key={d.key}>
              <View style={s.eloDimHeader}>
                <Text style={s.eloDimLabel}>{d.key} — {d.label}</Text>
                <Text style={[s.eloDimValue, { color: d.color }]}>{d.value}</Text>
              </View>
              <View style={s.eloTrack}>
                <View style={[s.eloFill, { width: `${Math.min(d.pct * 100, 100)}%`, backgroundColor: d.color }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Reputação */}
        <SectionTitle>REPUTAÇÃO</SectionTitle>
        <View style={s.reputCard}>
          <View style={s.reputRow}>
            <Text style={s.reputScore}>{reputationScore.toFixed(1)}</Text>
            <Text style={s.reputLabel}>/ 100</Text>
          </View>
          <View style={s.reputTrack}>
            <View style={[s.reputFill, { width: `${reputationScore}%` }]} />
          </View>
          <Text style={s.reputSub}>
            {reputationScore >= 90
              ? '⭐ Elegível para Capitão'
              : `Faltam ${(90 - reputationScore).toFixed(1)} pontos para Capitão`}
          </Text>
        </View>

        {/* Histórico */}
        <SectionTitle>HISTÓRICO DE REPUTAÇÃO</SectionTitle>
        <View style={s.histChart}>
          {history.map((h: number, i: number) => (
            <View key={i} style={[
              s.histBar,
              { height: h * 0.7,
                backgroundColor: h >= 80 ? C.green : h >= 60 ? C.orange : C.red }
            ]} />
          ))}
        </View>
        <View style={s.histLabels}>
          <Text style={s.histLabel}>Mais antigo</Text>
          <Text style={s.histLabel}>Hoje</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: C.bg },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: C.text2 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.text2, letterSpacing: 2,
    textTransform: 'uppercase', marginTop: 16, marginBottom: 4 },
  badge:    { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:{ fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  eloHero:  { flexDirection: 'row', gap: 16, alignItems: 'flex-start', marginBottom: 8 },
  eloAvatar:{ width: 72, height: 72, borderRadius: 20, backgroundColor: C.bg3,
    borderWidth: 2, borderColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  eloAvatarText: { fontSize: 26, fontWeight: '900', color: C.orange },
  eloName:  { fontSize: 22, fontWeight: '900', color: C.text },
  eloPos:   { fontSize: 12, color: C.text2, marginTop: 3 },
  eloComposite: { fontSize: 38, fontWeight: '900', color: C.orange, lineHeight: 42 },
  eloCompositeLabel: { fontSize: 10, color: C.text3, letterSpacing: 1 },
  eloDimHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  eloDimLabel:  { fontSize: 12, fontWeight: '600', color: C.text2 },
  eloDimValue:  { fontSize: 16, fontWeight: '800' },
  eloTrack: { height: 6, backgroundColor: C.bg3, borderRadius: 3, overflow: 'hidden' },
  eloFill:  { height: '100%', borderRadius: 3 },
  reputCard:{ backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14, gap: 10, marginTop: 10 },
  reputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  reputScore:{ fontSize: 36, fontWeight: '900', color: C.green },
  reputLabel:{ fontSize: 16, color: C.text2 },
  reputTrack:{ height: 8, backgroundColor: C.bg4, borderRadius: 4, overflow: 'hidden' },
  reputFill: { height: '100%', borderRadius: 4, backgroundColor: C.green },
  reputSub:  { fontSize: 12, color: C.text2 },
  histChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 70, marginTop: 10 },
  histBar:   { flex: 1, borderRadius: 3 },
  histLabels:{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  histLabel: { fontSize: 9, color: C.text3 },
});
