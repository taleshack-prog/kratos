import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import Logo from '../../assets/Logo';

const C = {
  bg: '#0A0A0F', bg2: '#111118', bg3: '#1A1A24', bg4: '#22222E',
  orange: '#FF6B1A', green: '#00E5A0', blue: '#4A9EFF',
  red: '#FF4A6B', text: '#F0F0F8', text2: '#9090A8', text3: '#5A5A72',
  border: '#2A2A3A',
};

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail]           = useState('');
  const [senha, setSenha]           = useState('');
  const [showSenha, setShowSenha]   = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName]             = useState('');
  const { login, register, isLoading, error } = useAuthStore();

  async function handleSubmit() {
    if (!email || !senha) { Alert.alert('Atenção', 'Preencha email e senha.'); return; }
    const biometricHash = senha;
    try {
      if (isRegister) {
        if (!name) { Alert.alert('Atenção', 'Preencha seu nome.'); return; }
        await register({ name, email, biometricHash, birthDate: '2000-01-01' });
      } else {
        await login({ email, biometricHash });
      }
      onLogin();
    } catch {}
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.inner}>

        <View style={s.logoBox}>
          <Logo size={100} />
          <Text style={s.logoMain}>ASPHALT</Text>
          <Text style={s.logoSub}>HOOPS</Text>
          <Text style={s.logoTagline}>Basquete de Rua · Porto Alegre</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>{isRegister ? 'CRIAR CONTA' : 'ENTRAR'}</Text>

          {isRegister && (
            <View style={s.inputGroup}>
              <Text style={s.label}>NOME</Text>
              <TextInput style={s.input} placeholder="Seu nome completo"
                placeholderTextColor={C.text3} value={name} onChangeText={setName}
                autoCapitalize="words" />
            </View>
          )}

          <View style={s.inputGroup}>
            <Text style={s.label}>EMAIL</Text>
            <TextInput style={s.input} placeholder="seu@email.com"
              placeholderTextColor={C.text3} value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>SENHA</Text>
            <View style={s.inputRow}>
              <TextInput style={[s.input, { flex: 1 }]} placeholder="••••••••"
                placeholderTextColor={C.text3} value={senha} onChangeText={setSenha}
                secureTextEntry={!showSenha} autoCapitalize="none" />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowSenha(!showSenha)}>
                <Text style={{ fontSize: 18 }}>{showSenha ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={[s.submitBtn, isLoading && { opacity: 0.6 }]}
            onPress={handleSubmit} disabled={isLoading}>
            {isLoading
              ? <ActivityIndicator color="#0A0A0F" />
              : <Text style={s.submitBtnText}>{isRegister ? 'CRIAR CONTA' : 'ENTRAR →'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.switchBtn} onPress={() => setIsRegister(!isRegister)}>
            <Text style={s.switchText}>
              {isRegister ? 'Já tem conta? Entrar' : 'Novo por aqui? Criar conta'}
            </Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: C.bg },
  inner:         { flex: 1, justifyContent: 'center', padding: 24, gap: 24 },
  logoBox:       { alignItems: 'center', gap: 4 },
  logoMain:      { fontSize: 42, fontWeight: '900', color: C.text, letterSpacing: 6, lineHeight: 46 },
  logoSub:       { fontSize: 32, fontWeight: '900', color: C.orange, letterSpacing: 10, lineHeight: 36 },
  logoTagline:   { fontSize: 11, color: C.text2, marginTop: 6, letterSpacing: 2 },
  card:          { backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 24, gap: 14 },
  cardTitle:     { fontSize: 16, fontWeight: '900', color: C.text, letterSpacing: 2 },
  inputGroup:    { gap: 6 },
  label:         { fontSize: 10, fontWeight: '700', color: C.text2, letterSpacing: 2 },
  input:         { backgroundColor: C.bg4, borderWidth: 1, borderColor: C.border, borderRadius: 12,
                   paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text },
  inputRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn:        { backgroundColor: C.bg4, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12 },
  errorBox:      { backgroundColor: C.red + '22', borderWidth: 1, borderColor: C.red + '44', borderRadius: 10, padding: 10 },
  errorText:     { fontSize: 12, color: C.red, textAlign: 'center' },
  submitBtn:     { backgroundColor: C.orange, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: '900', color: '#0A0A0F', letterSpacing: 1 },
  switchBtn:     { alignItems: 'center', paddingVertical: 4 },
  switchText:    { fontSize: 13, color: C.blue },
});
