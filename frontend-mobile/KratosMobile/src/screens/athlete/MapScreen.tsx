import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { WebView } from 'react-native-webview';

const C = { bg:'#0A0A0F', bg2:'#111118', bg3:'#1A1A24', orange:'#FF6B1A', green:'#00E5A0', blue:'#4A9EFF', red:'#FF4A6B', text:'#F0F0F8', text2:'#9090A8', text3:'#5A5A72', border:'#2A2A3A' };

const COURTS = [
  { id:'1', name:'Praca da Encol',    district:'Bela Vista',      latitude:-30.0412, longitude:-51.1979, status:'busy',        activeMatch:'3v3', players:6,  distanceKm:0.8 },
  { id:'2', name:'Parcao',            district:'Moinhos de Vento', latitude:-30.0300, longitude:-51.1940, status:'active',      activeMatch:null,  players:0,  distanceKm:1.4 },
  { id:'3', name:'Marinha do Brasil', district:'Praia de Belas',   latitude:-30.0480, longitude:-51.2261, status:'maintenance', activeMatch:null,  players:0,  distanceKm:2.1 },
  { id:'4', name:'Praca Germania',    district:'Passo d Areia',    latitude:-30.0170, longitude:-51.1580, status:'active',      activeMatch:'1v1', players:2,  distanceKm:3.2 },
  { id:'5', name:'Parque Redencao',   district:'Farroupilha',      latitude:-30.0366, longitude:-51.2125, status:'busy',        activeMatch:'5v5', players:10, distanceKm:1.9 },
];

const statusColor = (s) => s==='active' ? C.green : s==='busy' ? C.orange : C.text3;
const statusLabel = (c) => c.status==='maintenance' ? 'Manutencao' : c.activeMatch || 'Disponivel';

const MAP_HTML = '<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>*{margin:0;padding:0}#map{width:100vw;height:100vh}</style></head><body><div id="map"></div><script>var map=L.map("map",{zoomControl:false}).setView([-30.0346,-51.2177],13);L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);L.control.zoom({position:"bottomright"}).addTo(map);var courts=' + JSON.stringify(COURTS) + ';courts.forEach(function(c){var color=c.status==="active"?"#00E5A0":c.status==="busy"?"#FF6B1A":"#5A5A72";var icon=L.divIcon({html:"<div style=width:22px;height:22px;border-radius:50%;background:"+color+";border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#0A0A0F>"+(c.players>0?c.players:"")+"</div>",iconSize:[22,22],iconAnchor:[11,11],className:""});if(c.players>0)L.circle([c.latitude,c.longitude],{radius:c.players*25,color:color,fillColor:color,fillOpacity:0.15,weight:1}).addTo(map);L.marker([c.latitude,c.longitude],{icon:icon}).addTo(map).on("click",function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:"select",id:c.id}))});});map.on("click",function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:"deselect"}))});</script></body></html>';

export default function MapScreen() {
  const [selected, setSelected] = useState(null);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const selectCourt = (id) => {
    const court = COURTS.find(c => c.id === id);
    setSelected(court);
    Animated.spring(slideAnim, { toValue:0, useNativeDriver:true, tension:80, friction:10 }).start();
  };
  const deselectCourt = () => {
    Animated.timing(slideAnim, { toValue:300, duration:250, useNativeDriver:true }).start(() => setSelected(null));
  };
  const onMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type==='select') selectCourt(data.id);
      if (data.type==='deselect') deselectCourt();
    } catch(e) {}
  };
  return (
    <View style={{flex:1,backgroundColor:'#0A0A0F'}}>
      <WebView style={{flex:1}} source={{html:MAP_HTML}} onMessage={onMessage} javaScriptEnabled={true} mixedContentMode="always" originWhitelist={['*']} />
      <View style={{position:'absolute',top:16,left:16,backgroundColor:'rgba(10,10,15,0.92)',borderWidth:1,borderColor:'#2A2A3A',borderRadius:12,padding:10,gap:6}}>
        {[{l:'Jogando',c:'#FF6B1A'},{l:'Livre',c:'#00E5A0'},{l:'Fechado',c:'#5A5A72'}].map(i=>(
          <View key={i.l} style={{flexDirection:'row',alignItems:'center',gap:6}}>
            <View style={{width:8,height:8,borderRadius:4,backgroundColor:i.c}}/>
            <Text style={{fontSize:10,color:'#9090A8'}}>{i.l}</Text>
          </View>
        ))}
      </View>
      {selected && (
        <Animated.View style={{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#111118',borderTopWidth:1,borderTopColor:'#2A2A3A',borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,paddingBottom:34,transform:[{translateY:slideAnim}]}}>
          <TouchableOpacity style={{position:'absolute',top:14,right:18}} onPress={deselectCourt}>
            <Text style={{fontSize:26,color:'#9090A8'}}>x</Text>
          </TouchableOpacity>
          <Text style={{fontSize:22,fontWeight:'900',color:'#F0F0F8'}}>{selected.name}</Text>
          <Text style={{fontSize:12,color:'#9090A8',marginTop:4}}>{selected.district}</Text>
          <Text style={{fontSize:28,fontWeight:'900',color:statusColor(selected.status),marginTop:8}}>{selected.distanceKm}km</Text>
          {selected.players>0 && <Text style={{fontSize:12,color:'#9090A8'}}>{selected.players} jogadores agora</Text>}
          <TouchableOpacity style={{backgroundColor:'#FF6B1A',borderRadius:14,padding:14,alignItems:'center',marginTop:14}}>
            <Text style={{fontSize:16,fontWeight:'900',color:'#0A0A0F',letterSpacing:1}}>VER PARTIDAS</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'rgba(10,10,15,0.88)',borderTopWidth:1,borderTopColor:'#2A2A3A'}} contentContainerStyle={{padding:10,gap:8}}>
          {COURTS.map(court=>(
            <TouchableOpacity key={court.id} style={{backgroundColor:'#1A1A24',borderWidth:1,borderColor:'#2A2A3A',borderRadius:12,padding:10,flexDirection:'row',alignItems:'center',gap:8,minWidth:130}} onPress={()=>selectCourt(court.id)}>
              <View style={{width:8,height:8,borderRadius:4,backgroundColor:statusColor(court.status)}}/>
              <View>
                <Text style={{fontSize:12,fontWeight:'600',color:'#F0F0F8'}} numberOfLines={1}>{court.name}</Text>
                <Text style={{fontSize:11,color:'#9090A8'}}>{court.distanceKm}km</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
