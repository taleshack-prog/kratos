# Asphalt Hoops — Contexto de Desenvolvimento

## Renomeação
- Projeto era KRATOS Basquete Urbano → renomeado para **Asphalt Hoops**
- Package Android: `com.kratosmobile` (mantido por compatibilidade)
- Repositório GitHub: `taleshack-prog/kratos`

## Stack Completa
- **Frontend:** React Native 0.85.2 CLI (sem Expo Go)
  - Pasta: `frontend-mobile/KratosMobile/`
  - Metro na porta **8082** (8081 reservada para outro projeto)
  - Tablet Samsung SM-T295 Android 11 via USB (adb device: R9XN2065NDX)
  - Node 22 via NVM do VSCode

- **Backend Kratos:** NestJS porta 3001
  - 9 módulos: auth, athletes, courts, matches, checkin, zeladoria, parents, rotation, reputation
  - Base URL: http://192.168.0.195:3001/api/v1

- **Backend PMPA:** Express porta 3000

- **Bancos:** PostgreSQL + PostGIS
  - kratos_core: porta 5434
  - pmpa_govtech: porta 5433

- **Redis:** porta 6379

## Docker
  cd ~/kratos && docker compose up -d

## Comandos de desenvolvimento
  export NVM_DIR="$HOME/.var/app/com.visualstudio.code/config/nvm"
  source "$NVM_DIR/nvm.sh"
  export PATH="$NVM_DIR/versions/node/v22.22.2/bin:$PATH"
  cd ~/kratos/frontend-mobile/KratosMobile

  Terminal 1 — Metro:
  npx react-native start --port 8082

  Terminal 2 — Build no tablet:
  adb reverse tcp:8082 tcp:8082
  npx react-native run-android --port 8082

## Usuário de teste
- Email: tales@kratos.com
- Senha: abc123

## Estado das telas
- Login (src/screens/auth/LoginScreen.tsx) — API real
- Mapa (src/screens/athlete/MapScreen.tsx) — UI pronta, sem dados reais
- Agenda (App.tsx) — UI pronta, sem dados reais
- Elo (src/screens/athlete/EloScreen.tsx) — API real
- Check-in P2P (src/screens/athlete/CheckInP2PScreen.tsx) — UI pronta
- Zeladoria (src/screens/athlete/ZeladoriaScreen.tsx) — UI pronta
- Dashboard Pais (App.tsx) — UI pronta
- Autorização (App.tsx) — UI pronta

## Próximos passos
1. Seed SQL com quadras reais de POA (para MapScreen)
2. ZeladoriaScreen conectada à API
3. ScheduleScreen com agendamento real
4. ParentDashScreen com dados reais

## Design tokens
bg: #0A0A0F | orange: #FF6B1A | green: #00E5A0 | blue: #4A9EFF
red: #FF4A6B | text: #F0F0F8 | text2: #9090A8 | border: #2A2A3A
