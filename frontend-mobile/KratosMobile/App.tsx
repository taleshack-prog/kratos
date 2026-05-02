// App.tsx — Kratos Basquete Urbano
// Navegação completa: 4 telas Atleta + 3 telas Pais/Responsáveis
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, StatusBar, Dimensions,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import MapScreen from './src/screens/athlete/MapScreen';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const { width } = Dimensions.get('window');

// ── Design Tokens ────────────────────────────────────────────
const C = {
  bg:     '#0A0A0F', bg2: '#111118', bg3: '#1A1A24', bg4: '#22222E',
  orange: '#FF6B1A', green: '#00E5A0', blue: '#4A9EFF',
  red:    '#FF4A6B', purple: '#A855F7',
  text:   '#F0F0F8', text2: '#9090A8', text3: '#5A5A72',
  border: '#2A2A3A',
};

// ── Componentes compartilhados ───────────────────────────────

const SectionTitle = ({ children }: { children: string }) => (
  <Text style={s.sectionTitle}>{children}</Text>
);

const Badge = ({ label, color }: { label: string; color: string }) => (
  <View style={[s.badge, { backgroundColor: color + '22', borderColor: color + '44' }]}>
    <Text style={[s.badgeText, { color }]}>{label}</Text>
  </View>
);

const Card = ({ children, style }: any) => (
  <View style={[s.card, style]}>{children}</View>
);

// ────────────────────────────────────────────────────────────
// TELA 1: MAPA (placeholder — MapScreen.tsx integra react-native-maps)
// ────────────────────────────────────────────────────────────
function ScheduleScreen() {
  const [selectedDay, setSelectedDay] = useState(1);
  const days = ['D','S','T','Q','Q','S','S'];
  const dates = [27,28,29,30,1,2,3,4,5,6,7,8,9,10,11,12,13,14];
  const hasMatch = [5,6,8,11];

  const slots = [
    { time:'19:00', type:'Quadra Inteira · 5v5', status:'free', players:0,  elo:1400 },
    { time:'19:30', type:'Meia Quadra · 3v3',    status:'busy', players:5,  elo:0    },
    { time:'20:00', type:'Meia Quadra · 2v2',    status:'free', players:0,  elo:0    },
    { time:'20:30', type:'Meia Quadra · 1v1',    status:'free', players:0,  elo:0    },
    { time:'21:00', type:'Quadra Inteira · 5v5', status:'free', players:0,  elo:1200 },
  ];

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Agendar Partida</Text>
        <Text style={s.headerSub}>Parcão · Moinhos de Vento</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding:16 }}>
        {/* Calendário */}
        <View style={s.calHeader}>
          <TouchableOpacity style={s.navBtn}><Text style={s.navBtnText}>‹</Text></TouchableOpacity>
          <Text style={s.monthLabel}>Maio 2026</Text>
          <TouchableOpacity style={s.navBtn}><Text style={s.navBtnText}>›</Text></TouchableOpacity>
        </View>

        <View style={s.daysRow}>
          {days.map((d,i) => <Text key={i} style={s.dayHeader}>{d}</Text>)}
        </View>

        <View style={s.datesGrid}>
          {dates.map((d,i) => (
            <TouchableOpacity
              key={i}
              style={[
                s.dateCell,
                d === 1 && s.dateCellToday,
                selectedDay === d && d !== 1 && s.dateCellSelected,
              ]}
              onPress={() => setSelectedDay(d)}
            >
              <Text style={[
                s.dateCellText,
                d === 1 && { color:'white' },
                selectedDay === d && d !== 1 && { color: C.orange },
                d < 5 && { color: C.text3 },
              ]}>{d}</Text>
              {hasMatch.includes(d) && <View style={s.dateDot} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Slots */}
        <SectionTitle>HORÁRIOS DISPONÍVEIS</SectionTitle>
        <View style={{ gap:8, marginTop:10 }}>
          {slots.map((slot, i) => (
            <Card key={i} style={slot.status === 'busy' ? { borderColor: C.orange } : {}}>
              <View style={s.slotRow}>
                <View style={s.slotTime}>
                  <Text style={s.slotTimeText}>{slot.time}</Text>
                  <Text style={s.slotDur}>1h</Text>
                </View>
                <View style={[s.slotDivider]} />
                <View style={{ flex:1 }}>
                  <Text style={s.slotType}>{slot.type}</Text>
                  <View style={{ flexDirection:'row', gap:6, marginTop:4 }}>
                    <Badge
                      label={slot.status === 'free' ? 'Livre' : `${slot.players}/6`}
                      color={slot.status === 'free' ? C.green : C.orange}
                    />
                    {slot.elo > 0 && <Badge label={`Elo mín: ${slot.elo}`} color={C.text2} />}
                  </View>
                </View>
                <TouchableOpacity style={[
                  s.slotBtn,
                  { backgroundColor: slot.status === 'free' ? C.orange : 'transparent',
                    borderColor: C.orange, borderWidth: slot.status !== 'free' ? 1 : 0 }
                ]}>
                  <Text style={[s.slotBtnText, slot.status !== 'free' && { color: C.orange }]}>
                    {slot.status === 'free' ? '+' : '→'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────────────────────
// TELA 3: PERFIL ELO
// ────────────────────────────────────────────────────────────
function EloScreen() {
  const dims = [
    { key:'H', label:'Habilidade',   value:1820, color: C.orange, pct:0.73 },
    { key:'C', label:'Comportamento',value:1710, color: C.blue,   pct:0.68 },
    { key:'Z', label:'Zeladoria',    value:1580, color: C.green,  pct:0.63 },
  ];
  const history = [45,55,70,60,75,85,90,95];
  const medals = ['Guardião Encol','12 vitórias','Fair Play S1'];

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={{ padding:16 }}>
        {/* Hero */}
        <View style={s.eloHero}>
          <View style={s.eloAvatar}><Text style={s.eloAvatarText}>TH</Text></View>
          <View style={{ flex:1 }}>
            <Text style={s.eloName}>Tales Hack</Text>
            <Text style={s.eloPos}>Point Guard · Porto Alegre</Text>
            <Text style={s.eloComposite}>1742</Text>
            <Text style={s.eloCompositeLabel}>ELO COMPOSTO</Text>
          </View>
        </View>

        {/* Badges */}
        <View style={s.badgeRow}>
          <Badge label="Capitão · Encol" color={C.orange} />
          <Badge label="47 jogos" color={C.green} />
        </View>

        {/* Barras Elo */}
        <SectionTitle>DIMENSÕES DO ELO</SectionTitle>
        <View style={{ gap:12, marginTop:12 }}>
          {dims.map(d => (
            <View key={d.key}>
              <View style={s.eloDimHeader}>
                <Text style={s.eloDimLabel}>{d.key} — {d.label}</Text>
                <Text style={[s.eloDimValue, { color: d.color }]}>{d.value}</Text>
              </View>
              <View style={s.eloTrack}>
                <View style={[s.eloFill, { width: `${d.pct * 100}%`, backgroundColor: d.color }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Medalhas */}
        <SectionTitle>CONQUISTAS</SectionTitle>
        <View style={s.badgeRow}>
          {medals.map(m => (
            <View key={m} style={s.medal}>
              <Text style={s.medalText}>{m}</Text>
            </View>
          ))}
        </View>

        {/* Histórico */}
        <SectionTitle>ÚLTIMAS 8 PARTIDAS</SectionTitle>
        <View style={s.histChart}>
          {history.map((h, i) => (
            <View key={i} style={[
              s.histBar,
              { height: h * 0.8,
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

// ────────────────────────────────────────────────────────────
// TELA 4: CHECK-IN P2P
// ────────────────────────────────────────────────────────────
function CheckInScreen() {
  const [validated, setValidated] = useState(1);
  const minQuorum = 6;

  const players = [
    { initials:'GS', name:'Gustavo Silva', rssi:-62, dist:3,  color:'#FF6B1A', ok:true  },
    { initials:'RM', name:'Rafael Melo',   rssi:-71, dist:7,  color:'#4A9EFF', ok:false },
    { initials:'LF', name:'Lucas Farias',  rssi:-78, dist:12, color:'#9B59B6', ok:false },
  ];

  const rssiColor = (r: number) => r >= -65 ? C.green : r >= -75 ? C.orange : C.red;
  const rssiBars  = (r: number) => r >= -60 ? 4 : r >= -70 ? 3 : r >= -80 ? 2 : 1;

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={{ alignItems:'center', padding:16 }}>

        <View style={s.bleBadge}>
          <View style={s.bleDot} />
          <Text style={s.bleText}>Bluetooth LE · Ativo</Text>
        </View>

        <Text style={s.checkInTitle}>Validar{'\n'}Presença</Text>
        <Text style={s.checkInSub}>Raio de validação: 10 metros</Text>

        {/* Ícone de pulso estático */}
        <View style={s.pulseStatic}>
          <View style={s.pulseRingA} />
          <View style={s.pulseRingB} />
          <View style={s.pulseCenter}>
            <Text style={{ fontSize:28 }}>📡</Text>
          </View>
        </View>

        {/* Barra de quórum */}
        <View style={s.quorumBox}>
          <View style={s.quorumTrack}>
            <View style={[s.quorumFill, {
              width: `${Math.min(validated/minQuorum,1)*100}%`,
              backgroundColor: validated >= minQuorum ? C.green : C.orange,
            }]} />
          </View>
          <Text style={s.quorumText}>
            <Text style={[s.quorumNum, { color: validated >= minQuorum ? C.green : C.orange }]}>
              {validated}
            </Text>
            <Text style={s.quorumSub}>/{minQuorum} validados · Quórum: {minQuorum}</Text>
          </Text>
        </View>

        {/* Jogadores */}
        <Text style={[s.sectionTitle, { alignSelf:'flex-start', width:'100%' }]}>
          JOGADORES DETECTADOS
        </Text>
        <View style={{ width:'100%', gap:8, marginTop:8 }}>
          {players.map((p,i) => (
            <Card key={i} style={p.ok ? { borderColor: C.green + '44' } : {}}>
              <View style={s.playerRow}>
                <View style={[s.playerAv, { backgroundColor: p.color }]}>
                  <Text style={s.playerAvText}>{p.initials}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={s.playerName}>{p.name}</Text>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginTop:3 }}>
                    <View style={s.rssiBars}>
                      {[1,2,3,4].map(b => (
                        <View key={b} style={[
                          s.rssiBar, { height: 3 + b*3 },
                          b <= rssiBars(p.rssi)
                            ? { backgroundColor: rssiColor(p.rssi) }
                            : { backgroundColor: C.bg4 }
                        ]} />
                      ))}
                    </View>
                    <Text style={s.rssiText}>{p.dist}m · {p.rssi}dBm</Text>
                  </View>
                </View>
                <View style={[s.validateBtn,
                  p.ok ? { backgroundColor: C.green+'33', borderColor: C.green+'66' }
                       : { backgroundColor: C.bg4, borderColor: C.border }
                ]}>
                  <Text style={{ color: p.ok ? C.green : C.text2 }}>{p.ok ? '✓' : '○'}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        <TouchableOpacity
          style={[s.checkInBtn, validated >= minQuorum && { backgroundColor: C.green }]}
          onPress={() => setValidated(v => Math.min(v+1, minQuorum))}
        >
          <Text style={s.checkInBtnText}>
            {validated >= minQuorum ? 'JOGO CONFIRMADO!' : 'FAZER CHECK-IN'}
          </Text>
        </TouchableOpacity>
        <View style={{ height:40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────────────────────
// TELA 5: DASHBOARD DOS PAIS
// ────────────────────────────────────────────────────────────
function ParentDashScreen() {
  const stats = [
    { label:'Partidas',      value:'14', badge:'+3 vs abril', color: C.green  },
    { label:'Horas jogando', value:'18h', badge:'Ativo',      color: C.orange },
    { label:'Elo C',         value:'1680',badge:'Fair play',  color: C.blue   },
    { label:'Incidentes',    value:'0',   badge:'Sem registros',color:C.green },
  ];

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Olá, Tales</Text>
        <Text style={s.headerSub}>Responsável · 1 dependente</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding:16, gap:12 }}>

        {/* Status do filho */}
        <View style={[s.card, { borderColor: C.green+'44' }]}>
          <View style={s.playerRow}>
            <View style={[s.playerAv, { backgroundColor: C.green+'33', width:52, height:52, borderRadius:16 }]}>
              <Text style={[s.playerAvText, { color: C.green, fontSize:18 }]}>JP</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={s.playerName}>João Pedro</Text>
              <View style={{ flexDirection:'row', alignItems:'center', gap:5, marginTop:3 }}>
                <View style={{ width:7, height:7, borderRadius:4, backgroundColor: C.green }} />
                <Text style={{ fontSize:12, color: C.green }}>Check-in confirmado · Parcão</Text>
              </View>
              <Text style={{ fontSize:11, color: C.text2, marginTop:2 }}>Entrou às 19:07 · 3v3</Text>
            </View>
            <View style={{ alignItems:'flex-end' }}>
              <Text style={[s.eloComposite, { fontSize:28 }]}>47</Text>
              <Text style={{ fontSize:9, color: C.text3 }}>min jogando</Text>
            </View>
          </View>
        </View>

        {/* Stats grid */}
        <SectionTitle>RESUMO DO MÊS</SectionTitle>
        <View style={s.statsGrid}>
          {stats.map(stat => (
            <View key={stat.label} style={s.statCard}>
              <Text style={s.statLabel}>{stat.label}</Text>
              <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Badge label={stat.badge} color={stat.color} />
            </View>
          ))}
        </View>

        {/* Quadras */}
        <SectionTitle>QUADRAS FREQUENTADAS</SectionTitle>
        {[
          { name:'Parcão · Moinhos de Vento',    freq:'8x', color: C.orange },
          { name:'Praça da Encol · Bela Vista',  freq:'6x', color: C.green  },
        ].map(q => (
          <Card key={q.name}>
            <View style={s.courtRow}>
              <View style={[s.courtDot, { backgroundColor: q.color }]} />
              <Text style={[s.courtName, { flex:1 }]}>{q.name}</Text>
              <Text style={s.courtMeta}>{q.freq}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────────────────────
// TELA 6: APROVAÇÃO DE PARTIDA
// ────────────────────────────────────────────────────────────
function AuthScreen() {
  const [decision, setDecision] = useState<'pending'|'approved'|'denied'>('pending');

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Autorização</Text>
        <Text style={s.headerSub}>João Pedro quer jogar</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding:16, gap:10 }}>

        {decision !== 'pending' && (
          <View style={[s.card, {
            borderColor: decision === 'approved' ? C.green : C.red,
            alignItems:'center', padding:20,
          }]}>
            <Text style={{ fontSize:36, marginBottom:8 }}>
              {decision === 'approved' ? '✅' : '❌'}
            </Text>
            <Text style={[s.headerTitle, { color: decision === 'approved' ? C.green : C.red }]}>
              {decision === 'approved' ? 'AUTORIZADO!' : 'NEGADO'}
            </Text>
            <TouchableOpacity onPress={() => setDecision('pending')} style={{ marginTop:12 }}>
              <Text style={{ color: C.text2, fontSize:13 }}>Desfazer</Text>
            </TouchableOpacity>
          </View>
        )}

        {decision === 'pending' && <>
          {/* Detalhes da partida */}
          <Card style={{ borderColor: C.orange }}>
            <View style={s.playerRow}>
              <View style={[s.playerAv, { backgroundColor: C.orange+'22', width:44, height:44, borderRadius:14 }]}>
                <Text style={{ fontWeight:'700', color: C.orange, fontSize:16 }}>3v3</Text>
              </View>
              <View>
                <Text style={s.courtName}>Rachão no Parcão</Text>
                <Text style={s.courtMeta}>Sex, 02 mai · 20:00–21:00</Text>
              </View>
            </View>

            <View style={s.infoGrid}>
              {[
                { k:'Local',      v:'Parcão',     s:'Moinhos de Vento' },
                { k:'Modalidade', v:'3 vs 3',     s:'Meia quadra'      },
                { k:'Organizador',v:'Gustavo Silva',s:'Capitão ★'      },
                { k:'Vagas',      v:'5 / 6',      s:'1 vaga restante'  },
              ].map(item => (
                <View key={item.k} style={s.infoCell}>
                  <Text style={s.infoCellKey}>{item.k}</Text>
                  <Text style={s.infoCellVal}>{item.v}</Text>
                  <Text style={s.infoCellSub}>{item.s}</Text>
                </View>
              ))}
            </View>
          </Card>

          {/* Info de segurança */}
          <View style={[s.card, { borderColor: C.green+'33', backgroundColor: C.green+'08' }]}>
            <Text style={{ fontSize:12, color: C.text2, lineHeight:18 }}>
              ✓ Todos os participantes têm Elo C acima de 1500.{'\n'}
              ✓ Quadra avaliada como segura.{'\n'}
              ✓ Zeladoria ativa até 22h.
            </Text>
          </View>

          {/* Botões */}
          <View style={{ flexDirection:'row', gap:10 }}>
            <TouchableOpacity
              style={[s.authBtn, { borderColor: C.red, borderWidth:1, backgroundColor:'transparent' }]}
              onPress={() => setDecision('denied')}
            >
              <Text style={[s.authBtnText, { color: C.red }]}>NEGAR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.authBtn, { backgroundColor: C.orange, flex:1.5 }]}
              onPress={() => setDecision('approved')}
            >
              <Text style={s.authBtnText}>AUTORIZAR</Text>
            </TouchableOpacity>
          </View>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────────────────────
// TELA 7: ZELADORIA
// ────────────────────────────────────────────────────────────
function ZeladoriaScreen() {
  const reports = [
    { icon:'🏀', title:'Aro quebrado',  where:'Praça da Encol', when:'2h',     status:'reported',    pct:10, color: C.red    },
    { icon:'💡', title:'Poste sem luz', where:'Parcão',          when:'3 dias', status:'in_progress', pct:55, color: C.orange },
    { icon:'🧹', title:'Limpeza geral', where:'Praça Germânia',  when:'18h',   status:'resolved',    pct:100,color: C.green  },
  ];
  const statusLabel = (s: string) =>
    s === 'reported' ? 'Pendente' : s === 'in_progress' ? 'Em andamento' : 'Resolvido';
  const statusColor = (s: string) =>
    s === 'reported' ? C.red : s === 'in_progress' ? C.orange : C.green;

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Zeladoria</Text>
        <Text style={s.headerSub}>Reportar e acompanhar problemas</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding:16, gap:10 }}>

        {/* Botão de report */}
        <TouchableOpacity style={[s.card, { borderStyle:'dashed', borderColor: C.orange }]}>
          <View style={s.playerRow}>
            <View style={[s.playerAv, { backgroundColor: C.orange+'22', width:48, height:48, borderRadius:16 }]}>
              <Text style={{ fontSize:20 }}>📸</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={s.courtName}>Fotografar problema</Text>
              <Text style={s.courtMeta}>GPS e metadata capturados automaticamente</Text>
            </View>
          </View>

          <View style={s.issueGrid}>
            {['🏀 Aro','💡 Iluminação','🚧 Piso','🧹 Limpeza'].map(item => (
              <View key={item} style={s.issueChip}>
                <Text style={s.issueChipText}>{item}</Text>
              </View>
            ))}
          </View>
          <Text style={[s.courtMeta, { color: C.orange, textAlign:'center', marginTop:8 }]}>
            +5 pontos Elo Z por report válido
          </Text>
        </TouchableOpacity>

        {/* Reports */}
        <SectionTitle>REPORTS ATIVOS EM POA</SectionTitle>
        {reports.map((r, i) => (
          <Card key={i} style={r.status === 'resolved' ? { borderColor: C.green+'44' } : {}}>
            <View style={s.playerRow}>
              <View style={[s.playerAv, { backgroundColor: r.color+'22', width:40, height:40, borderRadius:12 }]}>
                <Text style={{ fontSize:18 }}>{r.icon}</Text>
              </View>
              <View style={{ flex:1 }}>
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                  <Text style={s.courtName}>{r.title}</Text>
                  <Badge label={statusLabel(r.status)} color={statusColor(r.status)} />
                </View>
                <Text style={s.courtMeta}>{r.where} · Reportado há {r.when}</Text>
                <View style={[s.eloTrack, { marginTop:8 }]}>
                  <View style={[s.eloFill, { width:`${r.pct}%`, backgroundColor: r.color }]} />
                </View>
              </View>
            </View>
            {r.status === 'resolved' && (
              <View style={s.resolvedFooter}>
                <Text style={{ fontSize:11, color: C.green }}>+5 Elo Z creditado</Text>
                <Text style={{ fontSize:11, color: C.text3 }}>IZ: 18h (meta &lt;72h)</Text>
              </View>
            )}
          </Card>
        ))}
        <View style={{ height:40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────────────────────
// NAVEGAÇÃO PRINCIPAL
// ────────────────────────────────────────────────────────────
const AthleteTab = createBottomTabNavigator();
const ParentTab  = createBottomTabNavigator();

function AthleteNavigator() {
  return (
    <AthleteTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: C.bg2, borderTopColor: C.border, height:60 },
        tabBarActiveTintColor: C.orange,
        tabBarInactiveTintColor: C.text3,
        tabBarLabelStyle: { fontSize:10, fontWeight:'600', marginBottom:4 },
      })}
    >
      <AthleteTab.Screen name="Mapa"     component={MapScreen}      options={{ tabBarLabel:'Mapa' }} />
      <AthleteTab.Screen name="Agenda"   component={ScheduleScreen} options={{ tabBarLabel:'Agenda' }} />
      <AthleteTab.Screen name="Elo"      component={EloScreen}      options={{ tabBarLabel:'Elo' }} />
      <AthleteTab.Screen name="CheckIn"  component={CheckInScreen}  options={{ tabBarLabel:'Check-in' }} />
      <AthleteTab.Screen name="Zeladoria" component={ZeladoriaScreen} options={{ tabBarLabel:'Zeladoria' }} />
    </AthleteTab.Navigator>
  );
}

function ParentNavigator() {
  return (
    <ParentTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: C.bg2, borderTopColor: C.border, height:60 },
        tabBarActiveTintColor: C.orange,
        tabBarInactiveTintColor: C.text3,
        tabBarLabelStyle: { fontSize:10, fontWeight:'600', marginBottom:4 },
      }}
    >
      <ParentTab.Screen name="Dashboard"   component={ParentDashScreen} options={{ tabBarLabel:'Dashboard' }} />
      <ParentTab.Screen name="Autorização" component={AuthScreen}       options={{ tabBarLabel:'Autorizar' }} />
      <ParentTab.Screen name="Zeladoria2"  component={ZeladoriaScreen}  options={{ tabBarLabel:'Zeladoria' }} />
    </ParentTab.Navigator>
  );
}

// ────────────────────────────────────────────────────────────
// ROOT — seletor de perfil (Atleta / Responsável)
// ────────────────────────────────────────────────────────────
export default function App() {
  const [profile, setProfile] = useState<'athlete'|'parent'|null>(null);

  if (!profile) {
    return (
      <SafeAreaView style={[s.screen, { justifyContent:'center', alignItems:'center', gap:20 }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <Text style={[s.headerTitle, { fontSize:36, textAlign:'center' }]}>
          KRATOS{'\n'}BASQUETE
        </Text>
        <Text style={[s.headerSub, { textAlign:'center', marginBottom:20 }]}>
          Quem é você hoje?
        </Text>
        <TouchableOpacity style={s.profileBtn} onPress={() => setProfile('athlete')}>
          <Text style={s.profileBtnIcon}>🏀</Text>
          <Text style={s.profileBtnLabel}>SOU ATLETA</Text>
          <Text style={s.profileBtnSub}>Jogar, agendar, check-in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.profileBtn, { borderColor: C.blue }]}
          onPress={() => setProfile('parent')}
        >
          <Text style={s.profileBtnIcon}>👨‍👦</Text>
          <Text style={s.profileBtnLabel}>SOU RESPONSÁVEL</Text>
          <Text style={s.profileBtnSub}>Monitorar, autorizar partidas</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      {profile === 'athlete' ? <AthleteNavigator /> : <ParentNavigator />}
    </NavigationContainer>
  );
}

// ────────────────────────────────────────────────────────────
// ESTILOS
// ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:    { flex:1, backgroundColor: C.bg },
  header:    { padding:16, paddingTop:20, borderBottomWidth:1, borderBottomColor: C.border },
  headerTitle: { fontSize:26, fontWeight:'900', color: C.text, letterSpacing:-0.5 },
  headerSub: { fontSize:12, color: C.text2, marginTop:2 },

  sectionTitle: { fontSize:11, fontWeight:'700', color: C.text2, letterSpacing:2,
    textTransform:'uppercase', marginTop:16, marginBottom:4 },

  card: { backgroundColor: C.bg3, borderWidth:1, borderColor: C.border,
    borderRadius:14, padding:14, marginBottom:2 },

  badge: { borderRadius:20, borderWidth:1, paddingHorizontal:8, paddingVertical:3 },
  badgeText: { fontSize:9, fontWeight:'700', textTransform:'uppercase', letterSpacing:1 },
  badgeRow:  { flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:8 },

  // Mapa
  mapPlaceholder: { height:200, backgroundColor: C.bg3, position:'relative', overflow:'hidden' },
  heatBlob: { position:'absolute', width:80, height:80, borderRadius:40, opacity:0.5 },
  pin: { position:'absolute', width:18, height:18, borderRadius:9, backgroundColor: C.bg3,
    borderWidth:2, alignItems:'center', justifyContent:'center' },
  pinDot: { width:7, height:7, borderRadius:4 },
  radiusBadge: { position:'absolute', top:10, left:10, flexDirection:'row',
    backgroundColor:'rgba(10,10,15,0.9)', borderRadius:20,
    paddingHorizontal:10, paddingVertical:5, borderWidth:1, borderColor: C.border },
  radiusText: { fontSize:11, color: C.text2 },
  fab: { position:'absolute', right:16, bottom:80, width:52, height:52,
    borderRadius:16, backgroundColor: C.orange, alignItems:'center', justifyContent:'center' },
  fabText: { fontSize:26, color:'white', lineHeight:30 },
  courtRow:   { flexDirection:'row', alignItems:'center', gap:10 },
  courtDot:   { width:10, height:10, borderRadius:5 },
  courtName:  { fontSize:14, fontWeight:'600', color: C.text },
  courtMeta:  { fontSize:11, color: C.text2, marginTop:2 },
  courtDist:  { fontSize:20, fontWeight:'700' },

  // Calendário
  calHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  monthLabel: { fontSize:20, fontWeight:'800', color: C.text },
  navBtn:     { width:32, height:32, borderRadius:10, backgroundColor: C.bg3,
    borderWidth:1, borderColor: C.border, alignItems:'center', justifyContent:'center' },
  navBtnText: { color: C.text2, fontSize:16 },
  daysRow:    { flexDirection:'row', marginBottom:6 },
  dayHeader:  { flex:1, fontSize:9, fontWeight:'700', color: C.text3,
    textAlign:'center', textTransform:'uppercase' },
  datesGrid:  { flexDirection:'row', flexWrap:'wrap', marginBottom:16 },
  dateCell:   { width:`${100/7}%`, aspectRatio:1, alignItems:'center',
    justifyContent:'center', borderRadius:10, position:'relative' },
  dateCellToday:    { backgroundColor: C.orange },
  dateCellSelected: { borderWidth:1, borderColor: C.orange },
  dateCellText:     { fontSize:13, fontWeight:'500', color: C.text2 },
  dateDot: { position:'absolute', bottom:4, width:4, height:4,
    borderRadius:2, backgroundColor: C.green },

  // Slots
  slotRow:     { flexDirection:'row', alignItems:'center', gap:12 },
  slotTime:    { alignItems:'center', minWidth:44 },
  slotTimeText:{ fontSize:18, fontWeight:'800', color: C.orange },
  slotDur:     { fontSize:10, color: C.text2 },
  slotDivider: { width:1, height:40, backgroundColor: C.border },
  slotType:    { fontSize:13, fontWeight:'600', color: C.text },
  slotBtn:     { width:32, height:32, borderRadius:10, alignItems:'center', justifyContent:'center' },
  slotBtnText: { fontWeight:'700', color:'white', fontSize:16 },

  // Elo
  eloHero:    { flexDirection:'row', gap:16, alignItems:'flex-start', marginBottom:8 },
  eloAvatar:  { width:72, height:72, borderRadius:20, backgroundColor: C.bg3,
    borderWidth:2, borderColor: C.orange, alignItems:'center', justifyContent:'center' },
  eloAvatarText: { fontSize:26, fontWeight:'900', color: C.orange },
  eloName:    { fontSize:24, fontWeight:'900', color: C.text },
  eloPos:     { fontSize:12, color: C.text2, marginTop:3 },
  eloComposite: { fontSize:40, fontWeight:'900', color: C.orange, lineHeight:44 },
  eloCompositeLabel: { fontSize:10, color: C.text3, letterSpacing:1 },
  eloDimHeader: { flexDirection:'row', justifyContent:'space-between', marginBottom:5 },
  eloDimLabel:  { fontSize:12, fontWeight:'600', color: C.text2 },
  eloDimValue:  { fontSize:16, fontWeight:'800' },
  eloTrack: { height:6, backgroundColor: C.bg3, borderRadius:3, overflow:'hidden' },
  eloFill:  { height:'100%', borderRadius:3 },
  medal: { backgroundColor: C.bg3, borderWidth:1, borderColor: C.border,
    borderRadius:10, paddingHorizontal:12, paddingVertical:8 },
  medalText: { fontSize:11, color: C.text2 },
  histChart: { flexDirection:'row', alignItems:'flex-end', gap:4, height:80, marginTop:10 },
  histBar:   { flex:1, borderRadius:3 },
  histLabels: { flexDirection:'row', justifyContent:'space-between', marginTop:4 },
  histLabel:  { fontSize:9, color: C.text3 },

  // Check-in
  bleBadge: { flexDirection:'row', alignItems:'center', gap:6,
    backgroundColor:'rgba(74,158,255,0.1)', borderWidth:1,
    borderColor:'rgba(74,158,255,0.2)', borderRadius:20,
    paddingHorizontal:14, paddingVertical:6, marginBottom:16 },
  bleDot:  { width:7, height:7, borderRadius:4, backgroundColor: C.blue },
  bleText: { fontSize:12, fontWeight:'600', color: C.blue },
  checkInTitle: { fontSize:36, fontWeight:'900', color: C.text, textAlign:'center', lineHeight:40 },
  checkInSub:   { fontSize:13, color: C.text2, textAlign:'center', marginTop:8, marginBottom:24 },
  pulseStatic:  { width:160, height:160, alignItems:'center', justifyContent:'center',
    marginBottom:16, position:'relative' },
  pulseRingA: { position:'absolute', width:120, height:120, borderRadius:60,
    borderWidth:1, borderColor: C.blue+'66' },
  pulseRingB: { position:'absolute', width:90, height:90, borderRadius:45,
    borderWidth:1, borderColor: C.blue+'44' },
  pulseCenter: { width:64, height:64, borderRadius:20, backgroundColor: C.blue,
    alignItems:'center', justifyContent:'center' },
  quorumBox:   { width:'100%', marginBottom:16 },
  quorumTrack: { height:6, backgroundColor: C.bg3, borderRadius:3, overflow:'hidden', marginBottom:8 },
  quorumFill:  { height:'100%', borderRadius:3 },
  quorumText:  { textAlign:'center' },
  quorumNum:   { fontSize:22, fontWeight:'900' },
  quorumSub:   { fontSize:13, color: C.text2 },
  playerRow:   { flexDirection:'row', alignItems:'center', gap:10 },
  playerAv:    { width:36, height:36, borderRadius:12, alignItems:'center', justifyContent:'center' },
  playerAvText:{ fontSize:12, fontWeight:'800', color:'white' },
  playerName:  { fontSize:13, fontWeight:'600', color: C.text },
  rssiBars:    { flexDirection:'row', alignItems:'flex-end', gap:2 },
  rssiBar:     { width:4, borderRadius:1 },
  rssiText:    { fontSize:10, color: C.text2 },
  validateBtn: { width:32, height:32, borderRadius:10, borderWidth:1,
    alignItems:'center', justifyContent:'center' },
  checkInBtn:  { width:'100%', backgroundColor: C.green, borderRadius:14,
    paddingVertical:16, alignItems:'center', marginTop:16 },
  checkInBtnText: { fontSize:18, fontWeight:'800', color:'#0A0A0F', letterSpacing:1 },

  // Pais
  statsGrid: { flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:8 },
  statCard:  { width:(width-48)/2, backgroundColor: C.bg3, borderWidth:1,
    borderColor: C.border, borderRadius:12, padding:12, gap:4 },
  statLabel: { fontSize:11, color: C.text2 },
  statValue: { fontSize:26, fontWeight:'900' },

  // Autorização
  infoGrid: { flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:12 },
  infoCell: { width:(width-80)/2, backgroundColor: C.bg4, borderRadius:10, padding:10 },
  infoCellKey: { fontSize:9, color: C.text3, textTransform:'uppercase', letterSpacing:1, marginBottom:2 },
  infoCellVal: { fontSize:13, fontWeight:'600', color: C.text },
  infoCellSub: { fontSize:10, color: C.text2, marginTop:1 },
  authBtn:     { flex:1, borderRadius:14, paddingVertical:14, alignItems:'center' },
  authBtnText: { fontSize:16, fontWeight:'800', color:'#0A0A0F', letterSpacing:1 },

  // Zeladoria
  issueGrid: { flexDirection:'row', flexWrap:'wrap', gap:6, marginTop:10 },
  issueChip: { backgroundColor: C.bg4, borderRadius:10, paddingHorizontal:10, paddingVertical:8 },
  issueChipText: { fontSize:11, color: C.text2 },
  resolvedFooter: { flexDirection:'row', justifyContent:'space-between',
    marginTop:8, paddingTop:8, borderTopWidth:1, borderTopColor: C.border },

  // Perfil selector
  profileBtn: { width:width-48, backgroundColor: C.bg3, borderWidth:1,
    borderColor: C.orange, borderRadius:20, padding:20, alignItems:'center', gap:6 },
  profileBtnIcon:  { fontSize:36 },
  profileBtnLabel: { fontSize:20, fontWeight:'900', color: C.text, letterSpacing:1 },
  profileBtnSub:   { fontSize:12, color: C.text2 },
});
