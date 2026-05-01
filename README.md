# 🏀 Kratos Basquete Urbano — SaaS

Plataforma de gestão de quadras públicas, governança urbana e engajamento comunitário.

---

## Arquitetura

```
kratos-saas/
├── database/
│   ├── 01_kratos_core.sql      ← Schema operacional (atletas, partidas, Elo, P2P)
│   └── 02_pmpa_govtech.sql     ← Schema de governança (PMPA, analytics, auditoria)
│
├── backend-kratos/             ← NestJS (TypeScript) | porta 3001
│   └── src/
│       ├── entities/           ← TypeORM entities
│       ├── modules/
│       │   ├── reputation/     ← Algoritmo Elo H+C+Z
│       │   ├── checkin/        ← Validação P2P Bluetooth + GPS
│       │   └── matches/        ← Agendamento + conflito de horário
│       └── main.ts
│
├── backend-pmpa/               ← Node.js/Express (TypeScript) | porta 3000
│   └── src/
│       └── app.ts              ← 4 módulos de governança
│
├── docker-compose.yml
└── .env.example
```

---

## Pré-requisitos

- Docker Desktop (ou Docker Engine + Compose)
- Node.js 20+
- npm 10+

---

## Setup — Passo a Passo

### 1. Clonar e configurar ambiente

```bash
git clone <repo> kratos-saas
cd kratos-saas

cp .env.example .env
# Edite o .env com seus segredos reais
```

### 2. Subir a infraestrutura

```bash
docker compose up -d
# Aguarda ~30s para os bancos inicializarem e rodarem as migrations automáticas
```

Os arquivos `.sql` em `database/` são montados no `docker-entrypoint-initdb.d/`
dos containers PostgreSQL e executados automaticamente na primeira inicialização.

### 3. Verificar os bancos

```bash
# kratos_core (porta 5432)
docker exec -it kratos_db_core psql -U kratos_admin -d kratos_core -c "\dt"

# pmpa_govtech (porta 5433)
docker exec -it kratos_db_pmpa psql -U pmpa_admin -d pmpa_govtech -c "\dt"
```

### 4. Backend Kratos (NestJS)

```bash
cd backend-kratos
npm install
npm run start:dev
# Disponível em: http://localhost:3001
```

### 5. Backend PMPA (Express)

```bash
cd ../backend-pmpa
npm install
npm run start:dev
# Disponível em: http://localhost:3000
```

---

## API — Endpoints Principais

### Backend Kratos (porta 3001)

| Método | Rota                          | Descrição                              |
|--------|-------------------------------|----------------------------------------|
| POST   | /auth/register                | Cadastro de atleta (hash biométrico)   |
| POST   | /auth/login                   | Login com biometria (retorna JWT)      |
| GET    | /courts/nearby?lat=&lng=      | Quadras num raio de 5km (PostGIS)      |
| POST   | /matches/schedule             | Agenda nova partida                    |
| POST   | /checkin/p2p                  | Valida presença via Bluetooth + GPS    |
| POST   | /reputation/elo/update        | Atualiza Elo H+C+Z após partida        |
| POST   | /zeladoria/report             | Reporta problema na quadra             |
| GET    | /parents/:id/pending          | Autorizações pendentes do responsável  |
| PATCH  | /parents/authorize/:matchId   | Aprova/nega partida de menor           |

### Backend PMPA (porta 3000)

| Método | Rota                              | Descrição                           |
|--------|-----------------------------------|-------------------------------------|
| GET    | /api/courts                       | Lista quadras públicas              |
| POST   | /api/courts                       | Cadastra nova quadra (admin PMPA)   |
| PATCH  | /api/courts/:id/status            | Atualiza status (manutenção, etc.)  |
| GET    | /api/analytics/vitality/:courtId  | Métricas de uso da quadra           |
| GET    | /api/analytics/dashboard          | Dashboard do Secretário             |
| POST   | /api/zeladoria/sync               | Webhook Kratos → PMPA               |
| PATCH  | /api/zeladoria/:id/status         | Atualiza OS municipal               |
| GET    | /api/audit                        | Consulta logs de auditoria          |

---

## Algoritmo Elo H+C+Z

```
Elo_final = Elo_atual + K × (Resultado - E) + (H×0.5) + (C×0.3) + (Z×0.2)
```

| Dimensão | Peso | Descrição                              |
|----------|------|----------------------------------------|
| H        | 50%  | Habilidade técnica (resultado da partida) |
| C        | 30%  | Comportamento / Fair-play (avaliação dos pares) |
| Z        | 20%  | Zeladoria (bônus por reports válidos)  |

---

## Validação P2P (Bluetooth LE + GPS)

1. Atleta A e B emitem UUID da partida via BLE
2. RSSI mínimo: **-80 dBm** (filtra distância)
3. GPS validado via **ST_Within** no polígono da quadra (PostGIS)
4. Token efêmero cruzado entre os dois dispositivos
5. Backend confirma consenso → `fn_update_match_quorum()`

---

## Módulo de Pais / Responsáveis

- Menores (`is_minor = TRUE`) exigem `parent_id` vinculado
- Ao agendar, `parent_authorizations` é gerado automaticamente com `status = 'pending'`
- App dispara push notification para o responsável
- Partida só entra na fase `checkin` após `status = 'approved'`

---

## KPIs PMPA (Dashboard do Secretário)

| KPI                    | Definição                              | Ação Governamental              |
|------------------------|----------------------------------------|---------------------------------|
| Taxa de Ocupação Real  | Presença validada / Slots disponíveis  | Expansão de iluminação          |
| Índice de Zeladoria    | Reports resolvidos / Tempo médio       | Verba SMSURB para praças críticas |
| Densidade de Guardiões | Atletas Elo_C > 1800 por praça         | Certificação "Praça Segura"     |
| Eficiência Reputacional| Média Elo_C local                      | Incentivos IPTU para atletas    |

---

## Segurança e LGPD

- `biometric_hash`: SHA-256 da biometria. **Dado bruto nunca persiste** (LGPD Art. 11)
- Dados de atletas chegam **anonimizados** ao banco `pmpa_govtech`
- `audit_logs` é **append-only** — triggers bloqueiam UPDATE e DELETE
- Comunicação interna Kratos ↔ PMPA autenticada por `KRATOS_INTERNAL_SECRET`

---

## Próximas Fases

- [ ] **Fase 4** — Frontend Mobile (React Native/Expo): 7 telas (4 Atletas, 3 Pais)
- [ ] **Fase 5** — Módulo de Capitães e progressão de reputação
- [ ] **Fase 6** — Marketplace de micro-caução (Pix + estorno automático)
- [ ] **Fase 7** — DaaS (Dashboard analytics para parceiros B2B)
