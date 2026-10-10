# Camera Monitor — Instalação

Instalação automática para Windows. Em um PC novo, basta copiar a pasta do projeto e rodar **um arquivo**.

---

## Instalação rápida

> Dê dois cliques em **`instalar.bat`**

Ou, pela linha de comando, dentro da pasta do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File .\instalar.ps1
```

> **Importante:** execute como **Administrador** se o PostgreSQL ainda não estiver instalado (a instalação silenciosa dele exige privilégios de admin).

O instalador é **idempotente** — pode rodar quantas vezes quiser. Cada etapa só executa se o que ela cria estiver faltando, e nada que já exista é sobrescrito (inclusive o `.env`).

### O que ele faz

| Etapa | O que verifica/instala |
|---|---|
| 1 | Node.js ≥ 18 e Python 3.10+ (instala via **winget** se faltar) |
| 2 | PostgreSQL 18 — detecta o instalado; se não achar, baixa o oficial e instala em silencioso |
| 3 | `.env` — cria com segredos aleatórios; se já existe, só acrescenta chaves faltantes |
| 4 | `npm install` + `prisma generate` |
| 5 | `pip install -r ai-service/requirements.txt` (FastAPI, MediaPipe, OpenCV…) |
| 6 | Binários: **ffmpeg**, **Redis**, **MediaMTX v1.11.1**, **cloudflared**, **modelo de pose** |
| 7 | `mediamtx.yml` (a partir do pacote oficial, se ausente) |
| 8 | Cria o banco `camera_monitor`, roda `prisma migrate deploy` e o `seed` |
| 9 | Compila o painel `dist\CameraMonitor-Panel.exe` (PyInstaller) |
| 10 | Relatório final de tudo que foi verificado |

### Parâmetros

```powershell
.\instalar.ps1 -DbPassword "minha-senha"   # senha do superuser postgres
.\instalar.ps1 -SkipPostgres               # não tenta instalar o PostgreSQL
.\instalar.ps1 -SkipBinaries               # não baixa binários
.\instalar.ps1 -StartNow                   # sobe todos os servidores ao final
```

---

## Depois de instalar

| Arquivo | O que faz |
|---|---|
| **`start-server.bat`** | Sobe tudo: Redis, PostgreSQL, banco, Next.js, AI Service, MediaMTX, Recorder e o túnel Cloudflare. Mostra a URL pública. |
| **`abrir-painel.bat`** | Abre o painel gráfico com os botões Iniciar/Parar de cada serviço e os links de acesso. |
| **`start-recorder.bat`** | Só o worker de gravação de segmentos. |

**Acesse:** <http://localhost:3000>

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | `admin@admin.com` | `admin123` |
| Usuário | `user@user.com` | `user123` |

---

## Requisitos manuais (se algo falhar)

O instalador tenta automaticamente, mas caso o download falhe:

| Componente | De onde baixar |
|---|---|
| Node.js | https://nodejs.org |
| Python 3.12 | https://python.org/downloads |
| PostgreSQL 18 | https://www.enterprisedb.com/downloads/postgresql-postgresql-downloads |
| ffmpeg | https://www.gyan.dev/ffmpeg/builds/ |
| Redis (Windows) | https://github.com/tporadowski/redis/releases |
| MediaMTX v1.11.1 | https://github.com/bluenviron/mediamtx/releases |
| cloudflared | https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ |
| Modelo de pose | `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task` |

Depois de instalar o que faltou, rode `instalar.bat` de novo — ele só fará o que ainda estiver pendente.

---

## Portas usadas

| Serviço | Porta |
|---|---|
| Next.js | 3000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| AI Service | 8000 |
| MediaMTX — RTSP | 8554 |
| MediaMTX — HLS | 8888 |
| MediaMTX — WebRTC | 8889 |
| cloudflared (métricas) | 20241 |

---

## Arquivos gerados pelo instalador

- `.env` — configurações e segredos (nunca é sobrescrito, só completado)
- `recordings/` — gravações dos segmentos
- `dist/CameraMonitor-Panel.exe` — painel gráfico
- `node_modules/`, `ai-service` (pacotes pip)
- Logs: `server.log`, `ai-service.log`, `recorder.log`, `tunnel-err.log`

---

## Solução de problemas

**`npm install` falhou**
```powershell
rm -rf node_modules package-lock.json
npm install
```

**Pacotes da IA não importam (etapa 5)**
```powershell
python -m pip install --upgrade pip
python -m pip install -r ai-service\requirements.txt
```
O MediaPipe exige **Python 3.10–3.12**.

**PostgreSQL não conecta**
Confira `PG_BIN`, `PG_DATA` e `PG_PASSWORD` no `.env`. Os dois primeiros scripts (`start-server.ps1` e o painel) leem esses valores de lá; se não existirem, usam `D:\PostgreSQL\18\...`.

**Porta já em uso**
```powershell
netstat -ano | findstr ":3000"
taskkill /F /PID <pid>
```

**Túnel da internet não aparece**
Ele é temporário (trycloudflare) e muda a cada reinício. Veja `tunnel-err.log`.

---

## Desinstalar / limpar

Remova a pasta do projeto. Para apagar o banco:

```powershell
& "D:\PostgreSQL\18\bin\psql.exe" -U postgres -c "DROP DATABASE IF EXISTS camera_monitor;"
```
