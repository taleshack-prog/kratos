import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Easing, Alert, PermissionsAndroid, Platform,
} from 'react-native';
import { BleManager, Device, State } from 'react-native-ble-plx';

const C = {
  bg:'#0A0A0F', bg2:'#111118', bg3:'#1A1A24', bg4:'#22222E',
  orange:'#FF6B1A', green:'#00E5A0', blue:'#4A9EFF',
  red:'#FF4A6B', text:'#F0F0F8', text2:'#9090A8', text3:'#5A5A72',
  border:'#2A2A3A',
};

const RSSI_MIN = -80;
const MATCH_ID = 'match-demo-uuid-001';
const MIN_QUORUM = 6;

const bleManager = new BleManager();

const rssiColor = (r) => r >= -65 ? C.green : r >= -75 ? C.orange : C.red;
const rssiBars  = (r) => r >= -60 ? 4 : r >= -70 ? 3 : r >= -80 ? 2 : 1;
const rssiDist  = (r) => r >= -60 ? '~2m' : r >= -70 ? '~5m' : r >= -80 ? '~10m' : '>10m';

export default function CheckInP2PScreen() {
  const [bleState, setBleState]       = useState('unknown');
  const [scanning, setScanning]       = useState(false);
  const [devices, setDevices]         = useState([]);
  const [validated, setValidated]     = useState(1);
  const [checkedIn, setCheckedIn]     = useState(false);
  const [loading, setLoading]         = useState(false);

  // Animações de pulso
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(null);

  // Inicia animação de pulso
  const startPulse = useCallback(() => {
    const anim = (val, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue:1, duration:2000, easing: Easing.out(Easing.ease), useNativeDriver:true }),
        Animated.timing(val, { toValue:0, duration:0, useNativeDriver:true }),
      ])
    );
    scanAnim.current = Animated.parallel([anim(pulse1,0), anim(pulse2,600), anim(pulse3,1200)]);
    scanAnim.current.start();
  }, []);

  const stopPulse = useCallback(() => {
    scanAnim.current?.stop();
    pulse1.setValue(0); pulse2.setValue(0); pulse3.setValue(0);
  }, []);

  // Monitora estado do BLE
  useEffect(() => {
    const sub = bleManager.onStateChange((state) => {
      setBleState(state);
      if (state === State.PoweredOn) startScan();
    }, true);
    startPulse();
    return () => {
      sub.remove();
      bleManager.stopDeviceScan();
      stopPulse();
    };
  }, []);

  // Solicita permissões Android
  const requestPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    const grants = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(grants).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
  };

  // Inicia scan BLE
  const startScan = async () => {
    const ok = await requestPermissions();
    if (!ok) {
      Alert.alert('Permissão negada', 'Ative o Bluetooth e a localização para fazer check-in.');
      return;
    }
    setScanning(true);
    setDevices([]);

    bleManager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) { setScanning(false); return; }
      if (!device || device.rssi === null) return;
      if (device.rssi < RSSI_MIN) return; // muito longe

      setDevices(prev => {
        const exists = prev.find(d => d.id === device.id);
        const entry = {
          id:      device.id,
          name:    device.name || device.localName || 'Dispositivo',
          rssi:    device.rssi,
          initials: (device.name || 'DV').slice(0,2).toUpperCase(),
          color:   ['#FF6B1A','#4A9EFF','#9B59B6','#00E5A0','#E74C3C'][prev.length % 5],
          validated: false,
        };
        if (exists) return prev.map(d => d.id === device.id ? { ...d, rssi: device.rssi } : d);
        return [...prev, entry].sort((a,b) => b.rssi - a.rssi).slice(0, 6);
      });
    });

    // Para o scan após 15 segundos
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setScanning(false);
    }, 15000);
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      // Gera token efêmero
      const token = `${MATCH_ID}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Simula validação com o par mais próximo
      await new Promise(r => setTimeout(r, 1200));

      // Marca primeiro dispositivo como validado
      setDevices(prev => prev.map((d, i) => i === 0 ? { ...d, validated: true } : d));
      setValidated(v => Math.min(v + 1, MIN_QUORUM));

      if (validated + 1 >= MIN_QUORUM) {
        setCheckedIn(true);
        stopPulse();
        Alert.alert('✅ Check-in confirmado!', 'Quórum atingido. O jogo pode começar!');
      }
    } finally {
      setLoading(false);
    }
  };

  const pulseStyle = (val) => ({
    opacity:   val.interpolate({ inputRange:[0,0.5,1], outputRange:[0.7,0.3,0] }),
    transform: [{ scale: val.interpolate({ inputRange:[0,1], outputRange:[0.4,1.6] }) }],
  });

  const quorumPct = Math.min(validated / MIN_QUORUM, 1);

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Badge BLE */}
        <View style={[s.bleBadge, bleState === State.PoweredOn ? s.bleBadgeOn : s.bleBadgeOff]}>
          <View style={[s.bleDot, { backgroundColor: bleState === State.PoweredOn ? C.blue : C.red }]} />
          <Text style={[s.bleText, { color: bleState === State.PoweredOn ? C.blue : C.red }]}>
            {bleState === State.PoweredOn ? 'Bluetooth LE · Ativo' : 'Bluetooth · Desligado'}
          </Text>
        </View>

        <Text style={s.title}>Validar{'\n'}Presença</Text>
        <Text style={s.subtitle}>Raio de validação: 10 metros{'\n'}RSSI mínimo: {RSSI_MIN} dBm</Text>

        {/* Animação de pulso */}
        <View style={s.pulseContainer}>
          {[pulse1, pulse2, pulse3].map((p, i) => (
            <Animated.View key={i} style={[s.pulseRing, pulseStyle(p)]} />
          ))}
          <View style={[s.pulseCenter, checkedIn && { backgroundColor: C.green }]}>
            <Text style={s.pulseIcon}>{checkedIn ? '✓' : '📡'}</Text>
          </View>
          {scanning && (
            <View style={s.scanBadge}>
              <Text style={s.scanBadgeText}>Escaneando...</Text>
            </View>
          )}
        </View>

        {/* Barra de quórum */}
        <View style={s.quorumBox}>
          <View style={s.quorumTrack}>
            <Animated.View style={[s.quorumFill, {
              width: `${quorumPct * 100}%`,
              backgroundColor: quorumPct >= 1 ? C.green : C.orange,
            }]} />
          </View>
          <View style={s.quorumRow}>
            <Text style={s.quorumText}>
              <Text style={[s.quorumNum, { color: quorumPct >= 1 ? C.green : C.orange }]}>{validated}</Text>
              <Text style={s.quorumSub}>/{MIN_QUORUM} validados</Text>
            </Text>
            {quorumPct >= 1 && (
              <View style={s.quorumOk}>
                <Text style={s.quorumOkText}>QUÓRUM OK</Text>
              </View>
            )}
          </View>
        </View>

        {/* Botão de re-scan */}
        {!scanning && (
          <TouchableOpacity style={s.rescanBtn} onPress={startScan}>
            <Text style={s.rescanText}>🔄 Escanear novamente</Text>
          </TouchableOpacity>
        )}

        {/* Lista de dispositivos */}
        <Text style={s.sectionTitle}>
          {devices.length === 0 ? 'AGUARDANDO DISPOSITIVOS...' : `${devices.length} DISPOSITIVO(S) DETECTADO(S)`}
        </Text>

        <View style={s.deviceList}>
          {devices.map((d, i) => (
            <View key={d.id} style={[s.deviceRow, d.validated && s.deviceRowValidated]}>
              <View style={[s.avatar, { backgroundColor: d.color }]}>
                <Text style={s.avatarText}>{d.initials}</Text>
              </View>
              <View style={s.deviceInfo}>
                <Text style={s.deviceName} numberOfLines={1}>{d.name}</Text>
                <View style={s.rssiRow}>
                  <View style={s.rssiBars}>
                    {[1,2,3,4].map(b => (
                      <View key={b} style={[s.rssiBar, { height: 3 + b*3 },
                        b <= rssiBars(d.rssi)
                          ? { backgroundColor: rssiColor(d.rssi) }
                          : { backgroundColor: C.bg4 }
                      ]} />
                    ))}
                  </View>
                  <Text style={s.rssiText}>{rssiDist(d.rssi)} · {d.rssi} dBm</Text>
                </View>
              </View>
              <View style={[s.validateBtn,
                d.validated ? s.validateBtnOk : s.validateBtnPending
              ]}>
                <Text style={{ color: d.validated ? C.green : C.text2, fontSize:14 }}>
                  {d.validated ? '✓' : '○'}
                </Text>
              </View>
            </View>
          ))}

          {devices.length === 0 && (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>
                {bleState === State.PoweredOn
                  ? 'Procurando jogadores próximos...'
                  : 'Ligue o Bluetooth para detectar jogadores'}
              </Text>
            </View>
          )}
        </View>

        {/* Botão check-in */}
        <TouchableOpacity
          style={[
            s.checkInBtn,
            checkedIn && { backgroundColor: C.green },
            loading && s.checkInBtnLoading,
          ]}
          onPress={handleCheckIn}
          disabled={loading || checkedIn}
        >
          <Text style={s.checkInBtnText}>
            {loading ? 'VALIDANDO...' : checkedIn ? 'CHECK-IN CONFIRMADO ✓' : 'FAZER CHECK-IN'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex:1, backgroundColor:C.bg },
  scroll:     { alignItems:'center', paddingTop:50, paddingHorizontal:20 },

  bleBadge:   { flexDirection:'row', alignItems:'center', gap:6, borderRadius:20, borderWidth:1, paddingHorizontal:14, paddingVertical:6, marginBottom:16 },
  bleBadgeOn: { backgroundColor:'rgba(74,158,255,0.1)', borderColor:'rgba(74,158,255,0.2)' },
  bleBadgeOff:{ backgroundColor:'rgba(255,74,107,0.1)', borderColor:'rgba(255,74,107,0.2)' },
  bleDot:     { width:7, height:7, borderRadius:4 },
  bleText:    { fontSize:12, fontWeight:'600' },

  title:    { fontSize:36, fontWeight:'900', color:C.text, textAlign:'center', lineHeight:40 },
  subtitle: { fontSize:13, color:C.text2, textAlign:'center', marginTop:8, lineHeight:20 },

  pulseContainer: { width:180, height:180, alignItems:'center', justifyContent:'center', marginVertical:24 },
  pulseRing: { position:'absolute', width:120, height:120, borderRadius:60, borderWidth:2, borderColor:C.blue },
  pulseCenter: { width:64, height:64, borderRadius:20, backgroundColor:C.blue, alignItems:'center', justifyContent:'center' },
  pulseIcon:  { fontSize:28 },
  scanBadge:  { position:'absolute', bottom:-20, backgroundColor:'rgba(74,158,255,0.15)', borderRadius:10, paddingHorizontal:10, paddingVertical:4 },
  scanBadgeText: { fontSize:10, color:C.blue, fontWeight:'600' },

  quorumBox:   { width:'100%', marginBottom:12 },
  quorumTrack: { height:6, backgroundColor:C.bg3, borderRadius:3, overflow:'hidden', marginBottom:8 },
  quorumFill:  { height:'100%', borderRadius:3 },
  quorumRow:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  quorumText:  {},
  quorumNum:   { fontSize:22, fontWeight:'900' },
  quorumSub:   { fontSize:13, color:C.text2 },
  quorumOk:    { backgroundColor:'rgba(0,229,160,0.15)', borderRadius:20, paddingHorizontal:10, paddingVertical:3 },
  quorumOkText:{ fontSize:10, fontWeight:'700', color:C.green },

  rescanBtn:  { marginBottom:12, paddingVertical:8, paddingHorizontal:16, borderRadius:20, borderWidth:1, borderColor:C.border },
  rescanText: { fontSize:12, color:C.text2 },

  sectionTitle: { fontSize:11, fontWeight:'700', color:C.text2, letterSpacing:2, alignSelf:'flex-start', marginBottom:8 },

  deviceList: { width:'100%', gap:8 },
  deviceRow:  { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:C.bg3, borderWidth:1, borderColor:C.border, borderRadius:14, padding:12 },
  deviceRowValidated: { borderColor:'rgba(0,229,160,0.3)' },

  avatar:     { width:40, height:40, borderRadius:13, alignItems:'center', justifyContent:'center', flexShrink:0 },
  avatarText: { fontSize:13, fontWeight:'800', color:'white' },

  deviceInfo: { flex:1 },
  deviceName: { fontSize:13, fontWeight:'600', color:C.text },
  rssiRow:    { flexDirection:'row', alignItems:'center', gap:6, marginTop:4 },
  rssiBars:   { flexDirection:'row', alignItems:'flex-end', gap:2 },
  rssiBar:    { width:4, borderRadius:1 },
  rssiText:   { fontSize:10, color:C.text2 },

  validateBtn:        { width:32, height:32, borderRadius:10, borderWidth:1, alignItems:'center', justifyContent:'center' },
  validateBtnOk:      { backgroundColor:'rgba(0,229,160,0.2)', borderColor:'rgba(0,229,160,0.4)' },
  validateBtnPending: { backgroundColor:C.bg4, borderColor:C.border },

  emptyBox:  { width:'100%', padding:24, alignItems:'center', backgroundColor:C.bg3, borderRadius:14, borderWidth:1, borderColor:C.border },
  emptyText: { color:C.text3, fontSize:13, textAlign:'center' },

  checkInBtn:        { width:'100%', backgroundColor:C.green, borderRadius:16, paddingVertical:16, alignItems:'center', marginTop:16 },
  checkInBtnLoading: { opacity:0.6 },
  checkInBtnText:    { fontSize:18, fontWeight:'900', color:'#0A0A0F', letterSpacing:1 },
});
