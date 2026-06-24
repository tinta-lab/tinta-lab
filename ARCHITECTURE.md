# Tinta Lab — Architecture

## Обзор

Tinta Lab — платформа для managed Home Assistant (HAOS) как услуги (MSP).  
Клиент получает изолированный HAOS, доступ через Zero Trust (Cloudflare Tunnel),  
управление через личный кабинет и автоматизированную поддержку.

---

## Структура монорепозитория

```
tinta-lab/
├── backend/           # NestJS API сервер (Node.js 20, TypeScript)
├── frontend/          # Next.js 15 веб-приложение (TypeScript, Tailwind)
├── tinta-agent/       # HA App — агент внутри клиентского HAOS (Node.js)
├── data/
│   ├── postgres/      # PostgreSQL 16 data (docker volume)
│   └── redis/         # Redis 7 data (docker volume)
└── docker-compose.yml # PostgreSQL + Redis + Adminer
```

---

## Архитектурная схема

```
Клиент (браузер)
    │ HTTPS
    ▼
Next.js Frontend :3001
    │ REST /api/* (proxy)
    ▼
NestJS Backend :3000
    ├── REST API
    ├── WebSocket /servers (ServersGateway)   ← frontend dashboard
    └── WebSocket /tinta/ws (TintaAgentGateway) ← агенты
            ▲
            │ outbound WSS (JWT)
            │
Клиентский HAOS (мини-ПК у клиента)
    ├── Home Assistant Core
    ├── Cloudflare Tunnel (cloudflared)        → *.tinta-lab.de (Zero Trust)
    └── Tinta Agent (HA App / Docker)
            ├── WS → HA Core /api/websocket
            └── WS → api.tinta-lab.de/tinta/ws

Инфраструктура:
    PostgreSQL 16   (docker, :5432)
    Redis 7         (docker, :6379)
    PM2             (process manager)
    Cloudflare      (Tunnels + DNS + Zero Trust)
```

---

## Backend — NestJS модули

```
backend/src/
│
├── app.module.ts              # Корневой модуль, регистрирует все
├── main.ts                    # Bootstrap, CORS, Swagger
│
├── auth/                      # Аутентификация
│   ├── auth.service.ts        # login / register / logout
│   ├── auth.controller.ts     # POST /auth/login|register|logout
│   ├── auth.module.ts
│   ├── token-blacklist.service.ts  # In-memory JWT blacklist (logout)
│   ├── strategies/
│   │   └── jwt.strategy.ts    # Passport JWT + blacklist check
│   ├── guards/
│   │   ├── jwt-auth.guard.ts  # @UseGuards для REST
│   │   ├── roles.guard.ts     # @Roles(UserRole.ADMIN) проверка
│   │   └── ws-jwt.guard.ts    # Guard для WebSocket
│   └── decorators/
│       └── roles.decorator.ts
│
├── users/                     # Пользователи системы
│   ├── user.entity.ts         # id, email, password, role(admin|support|sales|client)
│   ├── users.service.ts       # CRUD + bcrypt
│   └── users.controller.ts    # GET /users, PATCH /users/:id
│
├── clients/                   # Клиенты (привязаны к User)
│   ├── client.entity.ts       # id, user, phone, city, isInstalled
│   ├── clients.service.ts
│   └── clients.controller.ts  # GET /clients, PATCH /clients/:id
│
├── servers/                   # HAOS серверы клиентов
│   ├── server.entity.ts       # id, client, name, subdomain, tunnelId,
│   │                          # tunnelToken, cfDnsRecordId, status,
│   │                          # accessEnabled, accessExpiresAt, haVersion
│   ├── servers.service.ts     # CRUD + heartbeat + Cloudflare auto-provision
│   ├── servers.controller.ts  # REST /servers
│   └── servers.gateway.ts     # WS /servers — real-time статус для dashboard
│
├── access/                    # Управление доступом к HA
│   ├── access-log.entity.ts   # Лог подключений
│   ├── access.service.ts      # grant / revoke / checkExpired
│   ├── access.controller.ts   # POST /access/grant|revoke|connect
│   └── access.scheduler.ts    # @Cron каждую минуту — отзываем истёкший доступ
│
├── tickets/                   # Тикеты поддержки
│   ├── ticket.entity.ts       # subject, message, type, status, internalNotes
│   ├── tickets.service.ts
│   └── tickets.controller.ts  # POST /tickets/public, GET /tickets, PATCH /tickets/:id/status
│
├── cloudflare/                # Cloudflare API интеграция
│   ├── cloudflare.service.ts  # provisionServer() → tunnel + DNS + token
│   └── cloudflare.module.ts   # Optional — работает без API ключа
│
├── notifications/             # Уведомления
│   ├── notifications.service.ts  # Telegram Bot API
│   │                             # notifyAccessGranted/Revoked/ProvisioningComplete/AgentOffline
│   └── notifications.module.ts
│
├── tinta-core/                # Tinta Core — управление агентами
│   ├── entities/
│   │   ├── agent-session.entity.ts   # clientId, status, agentToken,
│   │   │                             # agentVersion, haVersion, metrics, appliedTemplates
│   │   └── golden-template.entity.ts # slug, name, automation (JSONB)
│   │
│   ├── tinta-agent.gateway.ts  # WS Gateway /tinta/ws
│   │                           # register (JWT validate) / heartbeat / metrics / state_update
│   ├── entity-mapper.service.ts # TintaCommand → HACommand
│   │                            # light/climate/switch/cover/security
│   ├── golden-template.service.ts   # findAll / findBySlug / markApplied
│   ├── golden-template-seed.service.ts  # OnModuleInit → 5 default templates
│   ├── tinta-core.service.ts    # provisionAgent / executeAction / applyGoldenTemplate
│   ├── tinta-core.controller.ts # REST /tinta-core (admin only)
│   ├── agent-monitor.scheduler.ts  # @Cron — авто-тикет если агент офлайн > 5 мин
│   └── tinta-core.module.ts
│
└── provisioning/              # One-Click провиженинг
    ├── provisioning.service.ts  # create client → server → Cloudflare → agent token → notify
    ├── provisioning.controller.ts  # POST /provisioning/client
    └── provisioning.module.ts
```

---

## Frontend — Next.js страницы

```
frontend/src/
│
├── app/
│   ├── page.tsx               # / → redirect по роли
│   ├── layout.tsx             # Root layout (Toaster)
│   │
│   ├── auth/
│   │   ├── login/page.tsx     # Форма входа
│   │   └── register/page.tsx  # Публичная регистрация клиента
│   │
│   └── dashboard/
│       ├── admin/
│       │   ├── page.tsx           # Главная: статистика + навигация
│       │   ├── users/page.tsx     # Управление пользователями
│       │   ├── servers/page.tsx   # Серверы + управление доступом
│       │   ├── tickets/page.tsx   # Тикеты поддержки
│       │   └── agents/page.tsx    # Tinta Agents: статус, метрики, шаблоны,
│       │                          # One-Click провиженинг
│       ├── client/page.tsx        # Личный кабинет клиента
│       ├── support/page.tsx       # Dashboard поддержки
│       └── sales/page.tsx         # Dashboard продаж
│
├── hooks/
│   ├── useAuth.ts             # Zustand store: user, login, logout, register
│   └── useServersSocket.ts    # Socket.io клиент /servers
│
├── lib/
│   ├── api.ts                 # Axios instance + JWT interceptor
│   └── utils.ts               # cn() helper
│
└── types/index.ts             # Shared types: User, Client, Server, AgentSession,
                               # GoldenTemplate, Ticket, AgentMetrics
```

---

## Tinta Agent — HA App

```
tinta-agent/
├── config.yaml           # HA App manifest (arch: amd64 + aarch64)
├── Dockerfile            # Multi-arch build (FROM ha-base)
├── run.sh                # Entrypoint (bashio::config read)
├── package.json          # Node.js 20, socket.io-client, ws
├── tsconfig.json
├── src/
│   ├── agent.ts          # Main: connect HA + Core + health server :3100
│   ├── websocket-ha.ts   # Нативный HA WebSocket клиент
│   │                     # connect / callService / subscribeEvents / getStates
│   ├── websocket-core.ts # Socket.io → Tinta Core
│   │                     # register / heartbeat / onCommand / onApplyTemplate
│   │                     # sendStateUpdate / sendMetrics
│   └── entities.ts       # haStateToTintaEntity() / buildHACommand()
│                         # Маппинг: light/climate/switch/cover/alarm_control_panel
└── .github/workflows/
    └── build.yml         # CI: build multi-arch → ghcr.io/tinta-lab/tinta-agent
```

---

## База данных — PostgreSQL 16

| Таблица           | Назначение                                      |
|-------------------|-------------------------------------------------|
| `users`           | Аккаунты (admin / support / sales / client)     |
| `clients`         | Клиенты (1:1 с user, телефон, город)            |
| `servers`         | HAOS серверы (tunnelId, tunnelToken, статус)    |
| `access_logs`     | Лог подключений к HA                            |
| `tickets`         | Тикеты поддержки                                |
| `agent_sessions`  | Сессии Tinta Agent (метрики, версии, шаблоны)   |
| `golden_templates`| Библиотека автоматизаций (JSONB)                |

> TypeORM `synchronize: true` — схема обновляется автоматически (dev).  
> Для prod: `synchronize: false` + migrations.

---

## API эндпоинты

### Auth
| Метод | URL | Доступ |
|-------|-----|--------|
| POST | `/auth/login` | public |
| POST | `/auth/register` | public |
| POST | `/auth/logout` | JWT |

### Users / Clients / Servers / Access / Tickets
| Метод | URL | Доступ |
|-------|-----|--------|
| GET | `/users` | admin |
| GET/PATCH | `/clients/:id` | admin / owner |
| GET/POST/PATCH/DELETE | `/servers` | admin |
| POST | `/servers/:id/heartbeat` | JWT |
| POST/DELETE | `/access/grant|revoke/:serverId` | admin |
| POST | `/access/connect/:serverId` | client |
| POST | `/tickets/public` | public |
| GET | `/tickets` | admin/support |
| PATCH | `/tickets/:id/status` | admin/support |

### Tinta Core (admin only)
| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/provisioning/client` | One-Click провиженинг (возвращает installUrl) |
| GET | `/install/:token` | Публичный — конфиг для Magic Install Link (48 ч) |
| POST | `/tinta-core/provision/:clientId` | Генерировать Agent JWT |
| GET | `/tinta-core/sessions` | Все сессии агентов |
| GET | `/tinta-core/connected` | Онлайн агенты |
| POST | `/tinta-core/execute/:clientId` | Команда агенту |
| POST | `/tinta-core/template/:clientId/:slug` | Применить шаблон |
| GET/POST | `/tinta-core/templates` | Библиотека шаблонов |

### WebSocket
| Namespace | Кто подключается | События |
|-----------|-----------------|---------|
| `/servers` | Frontend | `subscribe` → `server:update`, `server:access` |
| `/tinta/ws` | Tinta Agent | `register`, `heartbeat`, `metrics`, `state_update` → `command`, `apply_template` |

---

## Потоки данных

### Провиженинг нового клиента (One-Click)
```
Admin → POST /provisioning/client
  ├── Create User + Client (PostgreSQL)
  ├── Create Server
  │     └── CloudflareService.provisionServer()
  │           ├── Create Tunnel
  │           ├── Configure ingress (subdomain → localhost:8123)
  │           └── Create CNAME DNS record
  ├── TintaCoreService.provisionAgent() → generate JWT (365d)
  ├── Apply default golden templates (non-blocking)
  ├── Generate installToken (UUID, 48h TTL) → installUrl = /install/:token
  └── NotificationsService.notifyProvisioningComplete() → Telegram
Response: { clientId, agentToken, tunnelToken, dashboardUrl, installUrl }

GET /install/:token (public, 48h)
  └── Return { clientId, agentToken, coreWs, haHost, haPort, tunnelToken? }
        ← Используется страницей /install/[token] для пошаговой инструкции
```

### Подключение Tinta Agent
```
Agent → WS /tinta/ws { register: { clientId, jwt, agentVersion, haVersion } }
  ├── Verify JWT (AGENT_JWT_SECRET)
  ├── Compare jwt === agentSession.agentToken (DB)
  └── Store socket in Map<clientId, Socket>

Agent → { heartbeat } every 30s
  └── Update lastHeartbeatAt

AgentMonitorScheduler (every 1 min)
  └── IF lastHeartbeatAt < now - 5min → mark DISCONNECTED + create ticket [AUTO]
```

### Выполнение команды
```
Admin/Support → POST /tinta-core/execute/:clientId { entityType, haEntityId, action }
  ├── EntityMapperService.toHA(cmd) → { domain, service, serviceData }
  └── TintaAgentGateway.executeCommand() → socket.emit('command', haCmd)
        └── Agent → HA callService(domain, service, data)
```

---

## Безопасность

- **JWT** (15 мин) + in-memory blacklist при logout
- **Agent JWT** (365 дней, отдельный секрет `AGENT_JWT_SECRET`)
- **Roles**: admin / support / sales / client — декоратор `@Roles()`
- **Cloudflare Zero Trust** — клиентский HA доступен только через Tunnel
- **WebSocket auth**: `/servers` guard — `WsJwtGuard`; `/tinta/ws` — JWT verify + DB token match
- **Пароли**: bcrypt (saltRounds=10)

---

## Добавление нового клиента

```bash
# 1. Провиженинг через Admin → Agents → "Новый клиент"
#    (или вручную через скрипт)
cd tinta-lab/scripts && ./provision-client.sh

# Скрипт создаёт:
#   ✓ User + Client + Server в БД
#   ✓ Cloudflare Tunnel + DNS (если настроен CF_API_TOKEN)
#   ✓ Agent JWT (365 дней)
#   ✓ Magic Install Link (48 часов)

# 2. Добавить агент на сервер
cp /home/tinta/tinta-agent-pub/clients/.env.example \
   /home/tinta/tinta-agent-pub/clients/SUBDOMAIN.env
# Заполнить TINTA_CLIENT_ID, TINTA_AGENT_TOKEN, SUPERVISOR_TOKEN

# 3. Запустить агент
cd /home/tinta/tinta-agent-pub
# Добавить  app('SUBDOMAIN')  в ecosystem.config.js
pm2 start ecosystem.config.js --only tinta-agent-SUBDOMAIN
pm2 save
```

**Что меняем при добавлении клиента:**
| Файл | Действие |
|------|----------|
| `tinta-agent-pub/clients/SUBDOMAIN.env` | Создать новый |
| `tinta-agent-pub/ecosystem.config.js` | Добавить строку `app('SUBDOMAIN')` |

**Что НИКОГДА не трогаем:**
| Файл | Причина |
|------|---------|
| `backend/.env` | JWT-секреты, DB credentials — только для backend |
| `tinta-lab/.env` | Docker Compose credentials — только для инфраструктуры |
| `clients/vigol.env` (и другие) | Личные токены клиента — не в git |
| `tinta-agent-pub/tinta_agent/dist/` | Скомпилированный агент |

---

## Карта env-файлов

```
tinta-lab/
├── .env                      # Docker Compose: DB_PASSWORD, GRAFANA_ADMIN_PASSWORD
│                             # ← в .gitignore, не трогать вручную
├── backend/.env              # NestJS: JWT_SECRET, DB_*, REDIS_*, CF_*, TELEGRAM_*
│                             # ← в .gitignore, единый источник правды для API
└── frontend/.env.local       # Next.js: NEXT_PUBLIC_API_URL (если нужно переопределить)

tinta-agent-pub/
├── ecosystem.config.js       # PM2: список активных клиентов — добавлять сюда
├── clients/
│   ├── .env.example          # Шаблон для нового клиента
│   └── SUBDOMAIN.env         # Токены конкретного клиента — в .gitignore!
│                             # Содержит: TINTA_CLIENT_ID, TINTA_AGENT_TOKEN,
│                             #           TINTA_CORE_WS, HA_HOST, SUPERVISOR_TOKEN
└── agent.env.bak             # Устаревший файл — не использовать, игнорируется
```

---

## Переменные окружения (backend/.env)

```env
PORT=3000
NODE_ENV=development

# PostgreSQL (должен совпадать с .env → DB_PASSWORD)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=tinta
DB_PASSWORD=...
DB_NAME=tinta_lab

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=...             # User tokens (15 min) — openssl rand -hex 32
JWT_REFRESH_SECRET=...     # Refresh tokens — отдельный секрет
JWT_EXPIRES_IN=15m
AGENT_JWT_SECRET=...       # Agent tokens (365 days) — НИКОГДА не совпадает с JWT_SECRET

# CORS — обязательно, иначе фронтенд заблокируется браузером
FRONTEND_URL=https://app.tinta-lab.de

# Telegram notifications (необязательно)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Cloudflare (необязательно — auto-provisioning туннелей)
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_BASE_DOMAIN=tinta-lab.de
```

---

## Запуск

```bash
# Инфраструктура
docker compose up -d   # PostgreSQL + Redis

# Backend
cd backend && npm run build
pm2 start dist/main.js --name tinta-backend

# Frontend
cd frontend && npm run build
pm2 start "node_modules/.bin/next start -p 3001" --name tinta-frontend

# Tinta Agent (на клиентском HAOS)
# Устанавливается как HA App из ghcr.io/tinta-lab/tinta-agent
# Опции: tinta_client_id, tinta_agent_token, tinta_core_ws
```

---

## Технологический стек

| Слой | Технология |
|------|-----------|
| Backend API | NestJS 10, TypeScript, Passport/JWT |
| ORM | TypeORM 0.3, PostgreSQL 16 |
| Кэш/Blacklist | Redis 7 (in-memory для dev) |
| WebSocket | Socket.io 4 |
| Frontend | Next.js 15, React 19, Tailwind CSS 3 |
| State management | Zustand |
| Forms | react-hook-form + zod |
| Tinta Agent | Node.js 20, ws, socket.io-client |
| CI/CD | GitHub Actions (multi-arch Docker) |
| Process manager | PM2 |
| Infra | Proxmox, Docker Compose, Cloudflare Tunnels |
