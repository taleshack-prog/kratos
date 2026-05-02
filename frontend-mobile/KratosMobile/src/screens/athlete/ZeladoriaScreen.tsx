import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, PermissionsAndroid,
  Platform, ActivityIndicator, Image,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Geolocation from '@react-native-community/geolocation';

const C = {
  bg:'#0A0A0F', bg2:'#111118', bg3:'#1A1A24', bg4:'#22222E',
  orange:'#FF6B1A', green:'#00E5A0', blue:'#4A9EFF',
  red:'#FF4A6B', text:'#F0F0F8', text2:'#9090A8', text3:'#5A5A72',
  border:'#2A2A3A',
};

const ISSUE_TYPES = [
  { id:'broken_hoop',  icon:'🏀', label:'Aro quebrado',   color: C.red    },
  { id:'lighting',     icon:'💡', label:'Iluminação',     color: C.orange },
  { id:'floor',        icon:'🚧', label:'Piso danificado',color: C.orange },
  { id:'cleanliness',  icon:'🧹', label:'Limpeza',        color: C.blue   },
  { id:'security',     icon:'🔒', label:'Segurança',      color: C.red    },
  { id:'vandalism',    icon:'🎨', label:'Vandalismo',     color: C.purple },
  { id:'other',        icon:'📋', label:'Outro',          color: C.text2  },
];

const MOCK_REPORTS = [
  { id:'r1', icon:'🏀', title:'Aro quebrado',  where:'Praça da Encol', when:'2h',    status:'reported',    pct:10, color:C.red,    eloZ:0  },
  { id:'r2', icon:'💡', title:'Poste sem luz', where:'Parcão',          when:'3 dias',status:'in_progress', pct:55, color:C.orange, eloZ:0  },
  { id:'r3', icon:'🧹', title:'Limpeza geral', where:'Praça Germânia',  when:'18h',  status:'resolved',    pct:100,color:C.green,  eloZ:5  },
];

const statusLabel = (s) =>
  s==='reported' ? 'Pendente' : s==='in_progress' ? 'Em andamento' : 'Resolvido';
const statusColor = (s) =>
  s==='reported' ? C.red : s==='in_progress' ? C.orange : C.green;

export default function ZeladoriaScreen() {
  const [step, setStep]             = useState('list');   // list | new | confirm
  const [selectedType, setSelectedType] = useState(null);
  const [photo, setPhoto]           = useState(null);
  const [location, setLocation]     = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [sending, setSending]       = useState(false);
  const [reports, setReports]       = useState(MOCK_REPORTS);

  // ── Solicita permissão de câmera ────────────────────────
  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      { title:'Câmera', message:'O Kratos precisa acessar a câmera para fotografar o problema.' }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  // ── Abre câmera ─────────────────────────────────────────
  const openCamera = useCallback(async () => {
    const ok = await requestCameraPermission();
    if (!ok) { Alert.alert('Permissão negada', 'Ative a câmera nas configurações.'); return; }
    launchCamera(
      { mediaType:'photo', quality:0.7, saveToPhotos:false, includeBase64:false },
      (response) => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (asset) {
          setPhoto(asset);
          getLocation();
        }
      }
    );
  }, []);

  // ── Abre galeria ─────────────────────────────────────────
  const openGallery = useCallback(() => {
    launchImageLibrary(
      { mediaType:'photo', quality:0.7, includeBase64:false },
      (response) => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (asset) {
          setPhoto(asset);
          getLocation();
        }
      }
    );
  }, []);

  // ── Captura localização via Wi-Fi + GPS ──────────────────
  const getLocation = useCallback(() => {
    setLocLoading(true);
    Geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:  Math.round(pos.coords.accuracy),
        });
        setLocLoading(false);
      },
      (err) => {
        setLocLoading(false);
        // Sem GPS/Wi-Fi: usa coordenadas da praça mais próxima como fallback
        setLocation({ latitude:-30.0412, longitude:-51.1979, accuracy:500, fallback:true });
      },
      { enableHighAccuracy:false, timeout:10000, maximumAge:60000 }
    );
  }, []);

  // ── Envia o report ───────────────────────────────────────
  const submitReport = useCallback(async () => {
    if (!selectedType) { Alert.alert('Selecione o tipo de problema.'); return; }
    setSending(true);
    try {
      await new Promise(r => setTimeout(r, 1500)); // simula API

      const newReport = {
        id:     'r' + Date.now(),
        icon:   ISSUE_TYPES.find(t => t.id === selectedType)?.icon ?? '📋',
        title:  ISSUE_TYPES.find(t => t.id === selectedType)?.label ?? 'Problema',
        where:  'Quadra próxima',
        when:   'agora',
        status: 'reported',
        pct:    10,
        color:  C.red,
        eloZ:   0,
      };

      setReports(prev => [newReport, ...prev]);
      setStep('list');
      setPhoto(null);
      setLocation(null);
      setSelectedType(null);

      Alert.alert(
        '✅ Report enviado!',
        '+5 pontos Elo Z serão creditados quando o report for validado.',
        [{ text: 'OK' }]
      );
    } finally {
      setSending(false);
    }
  }, [selectedType, photo, location]);

  // ── TELA: Lista de reports ───────────────────────────────
  if (step === 'list') {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Zeladoria</Text>
          <Text style={s.headerSub}>Reportar e acompanhar problemas</Text>
        </View>
        <ScrollView contentContainerStyle={s.scroll}>

          {/* Botão novo report */}
          <TouchableOpacity style={s.newReportBtn} onPress={() => setStep('new')}>
            <View style={s.newReportIcon}><Text style={{fontSize:24}}>📸</Text></View>
            <View style={{flex:1}}>
              <Text style={s.newReportTitle}>Reportar problema</Text>
              <Text style={s.newReportSub}>Foto + GPS capturados automaticamente</Text>
            </View>
            <View style={s.eloZBadge}>
              <Text style={s.eloZText}>+5 Elo Z</Text>
            </View>
          </TouchableOpacity>

          {/* Grade de tipos */}
          <View style={s.issueGrid}>
            {ISSUE_TYPES.slice(0,6).map(t => (
              <TouchableOpacity key={t.id} style={s.issueChip} onPress={() => { setSelectedType(t.id); setStep('new'); }}>
                <Text style={{fontSize:18}}>{t.icon}</Text>
                <Text style={s.issueChipText}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Reports ativos */}
          <Text style={s.sectionTitle}>REPORTS ATIVOS EM POA</Text>
          {reports.map(r => (
            <View key={r.id} style={[s.reportCard, r.status==='resolved' && {borderColor:C.green+'44'}]}>
              <View style={s.reportRow}>
                <View style={[s.reportIcon, {backgroundColor:r.color+'22'}]}>
                  <Text style={{fontSize:18}}>{r.icon}</Text>
                </View>
                <View style={{flex:1}}>
                  <View style={s.reportHeader}>
                    <Text style={s.reportTitle}>{r.title}</Text>
                    <View style={[s.badge, {backgroundColor:statusColor(r.status)+'22', borderColor:statusColor(r.status)+'44'}]}>
                      <Text style={[s.badgeText, {color:statusColor(r.status)}]}>{statusLabel(r.status)}</Text>
                    </View>
                  </View>
                  <Text style={s.reportMeta}>{r.where} · {r.when}</Text>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, {width:`${r.pct}%`, backgroundColor:r.color}]} />
                  </View>
                </View>
              </View>
              {r.status==='resolved' && (
                <View style={s.resolvedRow}>
                  <Text style={{fontSize:11, color:C.green}}>+{r.eloZ} Elo Z creditado</Text>
                  <Text style={{fontSize:11, color:C.text3}}>Resolvido em {r.when}</Text>
                </View>
              )}
            </View>
          ))}
          <View style={{height:80}} />
        </ScrollView>
      </View>
    );
  }

  // ── TELA: Novo report ────────────────────────────────────
  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => setStep('list')} style={s.backBtn}>
          <Text style={s.backBtnText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Novo Report</Text>
          <Text style={s.headerSub}>Fotografe o problema</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>

        {/* Seleção de tipo */}
        <Text style={s.sectionTitle}>TIPO DE PROBLEMA</Text>
        <View style={s.issueGrid}>
          {ISSUE_TYPES.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[s.issueChip, selectedType===t.id && {borderColor:t.color, backgroundColor:t.color+'22'}]}
              onPress={() => setSelectedType(t.id)}
            >
              <Text style={{fontSize:18}}>{t.icon}</Text>
              <Text style={[s.issueChipText, selectedType===t.id && {color:t.color}]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Foto */}
        <Text style={s.sectionTitle}>FOTO</Text>
        {photo ? (
          <View style={s.photoPreview}>
            <Image source={{uri: photo.uri}} style={s.photoImage} />
            <TouchableOpacity style={s.photoRetake} onPress={openCamera}>
              <Text style={{color:C.orange, fontSize:12, fontWeight:'700'}}>TROCAR FOTO</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.photoButtons}>
            <TouchableOpacity style={s.photoBtn} onPress={openCamera}>
              <Text style={{fontSize:28}}>📷</Text>
              <Text style={s.photoBtnText}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.photoBtn} onPress={openGallery}>
              <Text style={{fontSize:28}}>🖼️</Text>
              <Text style={s.photoBtnText}>Galeria</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Localização */}
        <Text style={s.sectionTitle}>LOCALIZAÇÃO</Text>
        <View style={s.locationCard}>
          {locLoading ? (
            <View style={s.locationRow}>
              <ActivityIndicator color={C.blue} size="small" />
              <Text style={s.locationText}>Obtendo localização...</Text>
            </View>
          ) : location ? (
            <View style={s.locationRow}>
              <View style={[s.locationDot, {backgroundColor: location.fallback ? C.orange : C.green}]} />
              <View>
                <Text style={s.locationText}>
                  {location.fallback ? 'Localização aproximada' : 'Localização obtida'}
                </Text>
                <Text style={s.locationSub}>
                  {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  {' · '}±{location.accuracy}m
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={s.locationRow} onPress={getLocation}>
              <Text style={{fontSize:18}}>📍</Text>
              <Text style={[s.locationText, {color:C.blue}]}>Toque para capturar localização</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Botão enviar */}
        <TouchableOpacity
          style={[s.submitBtn, (!selectedType || sending) && {opacity:0.5}]}
          onPress={submitReport}
          disabled={!selectedType || sending}
        >
          {sending
            ? <ActivityIndicator color="#0A0A0F" />
            : <Text style={s.submitBtnText}>ENVIAR REPORT → +5 ELO Z</Text>
          }
        </TouchableOpacity>

        <View style={{height:80}} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {flex:1, backgroundColor:C.bg},
  header:    {padding:16, paddingTop:20, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:12},
  headerTitle:{fontSize:24, fontWeight:'900', color:C.text},
  headerSub:  {fontSize:12, color:C.text2, marginTop:2},
  backBtn:    {width:36, height:36, borderRadius:12, backgroundColor:C.bg3, borderWidth:1, borderColor:C.border, alignItems:'center', justifyContent:'center'},
  backBtnText:{fontSize:18, color:C.text2},
  scroll:     {padding:16, gap:10},

  newReportBtn:{backgroundColor:C.bg3, borderWidth:1, borderColor:C.orange, borderStyle:'dashed', borderRadius:16, padding:14, flexDirection:'row', alignItems:'center', gap:12},
  newReportIcon:{width:48, height:48, borderRadius:16, backgroundColor:C.orange+'22', alignItems:'center', justifyContent:'center'},
  newReportTitle:{fontSize:14, fontWeight:'600', color:C.text},
  newReportSub:  {fontSize:11, color:C.text2, marginTop:2},
  eloZBadge:  {backgroundColor:C.orange+'22', borderRadius:20, paddingHorizontal:8, paddingVertical:4},
  eloZText:   {fontSize:11, fontWeight:'700', color:C.orange},

  issueGrid:  {flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:4},
  issueChip:  {backgroundColor:C.bg3, borderWidth:1, borderColor:C.border, borderRadius:12, padding:10, alignItems:'center', gap:4, width:'30%'},
  issueChipText:{fontSize:10, color:C.text2, textAlign:'center'},

  sectionTitle:{fontSize:11, fontWeight:'700', color:C.text2, letterSpacing:2, marginTop:8},

  reportCard: {backgroundColor:C.bg3, borderWidth:1, borderColor:C.border, borderRadius:14, padding:12},
  reportRow:  {flexDirection:'row', gap:10, alignItems:'flex-start'},
  reportIcon: {width:40, height:40, borderRadius:12, alignItems:'center', justifyContent:'center', flexShrink:0},
  reportHeader:{flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:4},
  reportTitle:{fontSize:13, fontWeight:'600', color:C.text, flex:1},
  reportMeta: {fontSize:11, color:C.text2, marginBottom:8},
  progressTrack:{height:5, backgroundColor:C.bg4, borderRadius:3, overflow:'hidden'},
  progressFill: {height:'100%', borderRadius:3},
  resolvedRow:{flexDirection:'row', justifyContent:'space-between', marginTop:8, paddingTop:8, borderTopWidth:1, borderTopColor:C.border},
  badge:      {borderRadius:20, borderWidth:1, paddingHorizontal:8, paddingVertical:3},
  badgeText:  {fontSize:9, fontWeight:'700'},

  photoButtons:{flexDirection:'row', gap:10},
  photoBtn:   {flex:1, backgroundColor:C.bg3, borderWidth:1, borderColor:C.border, borderRadius:14, padding:20, alignItems:'center', gap:8},
  photoBtnText:{fontSize:13, fontWeight:'600', color:C.text2},
  photoPreview:{borderRadius:14, overflow:'hidden', position:'relative'},
  photoImage: {width:'100%', height:200, borderRadius:14},
  photoRetake:{position:'absolute', bottom:10, right:10, backgroundColor:'rgba(10,10,15,0.85)', borderRadius:10, paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderColor:C.orange},

  locationCard:{backgroundColor:C.bg3, borderWidth:1, borderColor:C.border, borderRadius:14, padding:14},
  locationRow: {flexDirection:'row', alignItems:'center', gap:10},
  locationDot: {width:10, height:10, borderRadius:5},
  locationText:{fontSize:13, fontWeight:'600', color:C.text},
  locationSub: {fontSize:11, color:C.text2, marginTop:2},

  submitBtn:    {backgroundColor:C.orange, borderRadius:16, paddingVertical:16, alignItems:'center', marginTop:8},
  submitBtnText:{fontSize:16, fontWeight:'900', color:'#0A0A0F', letterSpacing:1},
});
