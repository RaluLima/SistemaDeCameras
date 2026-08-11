# Sistema de Câmeras — App Mobile

Aplicativo React Native (bare, com Expo Modules) para o Sistema de Câmeras:
login JWT, push notifications (expo-notifications), lista de câmeras, gravações
e transmissão ao vivo (HLS).

## Requisitos

- Node.js >= 20
- JDK 17 (obrigatório para Android; RN não funciona com JDK 8)
- Android Studio / Android SDK (para build Android)
- macOS + Xcode + CocoaPods (para iOS)
- Conta Expo (para push real) — só precisa de `EXPO_PUSH_PROJECT_ID`

## Configuração

1. Instale as dependências:

   ```sh
   npm install
   ```

2. Configure a URL do backend e o projectId do Expo Push em `src/config.ts`:

   ```ts
   export const API_BASE = 'https://sistemadecameras.onrender.com';
   export const EXPO_PUSH_PROJECT_ID = 'seu-eas-project-id';
   ```

   Para obter o `projectId`, rode `npx eas init` na raiz do app (cria o projeto
   no Expo) ou copie o valor de `extra.eas.projectId` do `app.json` gerado.
   Sem esse valor o app não consegue registrar push tokens.

## Rodando

```sh
# Dev server (Metro)
npm start

# Android
npm run android

# iOS (instale os pods primeiro: bundle exec pod install)
npm run ios
```

O app foi configurado como **dev client** (`expo start --dev-client`). O código
nativo já inclui a integração Expo Modules (ver `android/`). É necessário buildar
o app nativo (emulador/dispositivo) — **não** é compatível com Expo Go.

## Build de produção

```sh
# Build Android via EAS (requer login Expo)
npx eas build --profile production --platform android
```

## Como funciona

- `src/api.ts` — cliente HTTP (login, câmeras, gravações, alertas, push).
  Autenticação via `Authorization: Bearer <jwt>`.
- `src/auth.tsx` — sessão persistida em AsyncStorage.
- `src/notifications.ts` — registro do push token (expo-notifications) e
  callback de resposta a notificações.
- `src/screens/` — telas: Login, Home, Câmeras, Gravações, Player de gravação,
  Ao Vivo (HLS), Alertas.
- `src/navigation/RootNavigator.tsx` — navegação com React Navigation
  (nativo), com rotas condicionais por autenticação.

## Contratos do backend usados

| Ação | Endpoint |
| --- | --- |
| Login | `POST /api/auth/token` |
| Usuário atual | `GET /api/me` |
| Listar câmeras | `GET /api/cameras` |
| Atualizar câmera | `PUT /api/cameras/[id]` |
| Listar gravações | `GET /api/recordings` |
| Arquivo de gravação | `GET /api/recordings/file/[id]` |
| Ao vivo (HLS) | `GET /api/live/[id]/index.m3u8` |
| Registrar push | `POST /api/push/register` |
| Alertas | `GET /api/alerts`, `PATCH /api/alerts/[id]` |

> Observação: o Ao Vivo depende do `LIVE_BASE_URL` (servidor HLS/Mediamtx)
> configurado no backend. Enquanto não houver essa variável, o endpoint
> retorna 503 e o app mostra o erro.

## Observações

- iOS não inclui o token de autenticação nos segmentos HLS (limitação do
  AVPlayer). Para uso em produção, considere assinar o HLS ou liberar o
  servidor de mídia por rede privada.
- A gravação é servida com suporte a `Range`, permitindo seek no player.
