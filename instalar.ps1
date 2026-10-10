#Requires -Version 5.1
<#
================================================================================
  Camera Monitor - Instalador automatico (Windows)
================================================================================
  Dupo clique em "instalar.bat" ou execute:

      powershell -ExecutionPolicy Bypass -File .\instalar.ps1

  O que ele faz (tudo condicional / pode rodar quantas vezes quiser):
    [1/10] Requisitos ......... Node.js, Python, pip
    [2/10] PostgreSQL ......... detecta; baixa e instala silenciosamente se faltar
    [3/10] Arquivo .env ....... gera com segredos aleatorios (nunca sobrescreve o existente)
    [4/10] Dependencias Node .. npm install + prisma generate
    [5/10] Dependencias Python  pip install -r ai-service\requirements.txt
    [6/10] Binarios ........... ffmpeg, redis, mediamtx, cloudflared, modelo de pose
    [7/10] mediamtx.yml ....... gera se ausente
    [8/10] Banco .............. cria database, prisma migrate deploy, seed
    [9/10] Painel ............. compila dist\CameraMonitor-Panel.exe (PyInstaller)
    [10/10] Verificacao ....... relatorio final

  Parametros uteis:
      -DbPassword "senha"     senha do superusuario postgres (padrao: a do .env)
      -SkipPostgres           nao tenta instalar o PostgreSQL
      -SkipBinaries           nao baixa binarios (ja existirem no projeto)
      -StartNow               sobe todos os servidores ao final
================================================================================
#>

[CmdletBinding()]
param(
    [string]$DbPassword = "",
    [switch]$SkipPostgres,
    [switch]$SkipBinaries,
    [switch]$StartNow
)

# "Continue" (nao "Stop"): o PowerShell 5.1 converte o stderr de comandos nativos
# (node, npm, psql) em erros terminais se EAP=Stop, derrubando o instalador.
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

$TotalSteps = 10
$script:Failures = @()
$script:Downloaded = @()

# ----------------------------------------------------------------- utilidades
function Write-Banner {
    Write-Host ""
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host "  Camera Monitor - Instalador" -ForegroundColor Cyan
    Write-Host "  Projeto: $ProjectDir" -ForegroundColor DarkCyan
    Write-Host "======================================================" -ForegroundColor Cyan
}

function Step([int]$n, [string]$title) {
    Write-Host ""
    Write-Host ("[{0}/{1}] {2}" -f $n, $TotalSteps, $title) -ForegroundColor Yellow
}
function Ok([string]$m)    { Write-Host "   OK    $m" -ForegroundColor Green }
function Info([string]$m)  { Write-Host "   ...   $m" -ForegroundColor DarkGray }
function Warn([string]$m)  { Write-Host "   AVISO $m" -ForegroundColor DarkYellow }
function Fail([string]$m)  { Write-Host "   FALHA $m" -ForegroundColor Red; $script:Failures += $m }

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $user    = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

function New-Secret([int]$len = 48) {
    $bytes = New-Object byte[] $len
    $rng = New-Object Security.Cryptography.RNGCryptoServiceProvider
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return ([Convert]::ToBase64String($bytes) -replace '[+/=]', '')
}

function Get-Download([string]$url, [string]$dest) {
    if (Test-Path $dest) { return $dest }
    Info "baixando $(Split-Path $dest -Leaf) ..."
    $tmp = "$dest.download"
    if (Test-Path $tmp) { Remove-Item $tmp -Force }
    $attempt = 0
    while ($true) {
        $attempt++
        try {
            Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing -TimeoutSec 900
            Move-Item $tmp $dest -Force
            $script:Downloaded += $dest
            return $dest
        } catch {
            if ($attempt -ge 3) { throw "falha ao baixar $url -> $($_.Exception.Message)" }
            Info "retry $attempt/3 apos erro de rede"
            Start-Sleep -Seconds 3
        }
    }
}

function Expand-ZipFile([string]$zip, [string]$dest) {
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Expand-Archive -Path $zip -DestinationPath $dest -Force -ErrorAction Stop
}

function Copy-FirstFound([string]$root, [string]$name, [string]$destFile) {
    $f = Get-ChildItem -Path $root -Recurse -Filter $name -File -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $f) { return $false }
    $dir = Split-Path $destFile -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Copy-Item $f.FullName $destFile -Force
    return $true
}

function Get-EnvMap {
    $map = @{}
    $envFile = Join-Path $ProjectDir ".env"
    if (Test-Path $envFile) {
        # -Encoding UTF8 obrigatorio: sem ele o PS5.1 le como ANSI e corrói acentos
        foreach ($line in (Get-Content $envFile -Encoding UTF8)) {
            if ($line -match '^\s*([A-Za-z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$') {
                $map[$Matches[1]] = $Matches[2].Trim()
            }
        }
    }
    return $map
}

function Set-EnvFile([System.Collections.IDictionary]$desired) {
    $envFile = Join-Path $ProjectDir ".env"
    $existing = Get-EnvMap
    $lines = @()
    $seen = @{}

    if (Test-Path $envFile) {
        foreach ($line in (Get-Content $envFile -Encoding UTF8)) {
            if ($line -match '^# Gerado por instalar\.ps1') { continue }   # evita duplicar cabecalho
            if ($line.Trim() -eq "") { continue }
            if ($line -match '^\s*#') { $lines += $line; continue }
            if ($line -match '^\s*([A-Za-z0-9_]+)\s*=') {
                $name = $Matches[1]
                # ".Contains" (nao ".ContainsKey"): funciona em Hashtable e OrderedDictionary
                if ($desired.Keys -contains $name) {
                    # preserva o valor que ja existe; so usa o novo se a chave nao tiver valor
                    $v = if ($existing.ContainsKey($name)) { $existing[$name] } else { $desired[$name] }
                    $lines += ('{0}="{1}"' -f $name, $v)
                } else {
                    $lines += $line
                }
                $seen[$name] = $true
                continue
            }
            $lines += $line
        }
    }

    # acrescenta apenas as chaves que faltam
    $missing = @()
    foreach ($k in $desired.Keys) {
        if (-not $seen.ContainsKey($k)) { $missing += ('{0}="{1}"' -f $k, $desired[$k]) }
    }

    $final = @()
    $final += "# Gerado por instalar.ps1 - valores existentes nunca sao sobrescritos."
    if ($missing.Count -gt 0) {
        $final += $missing
        $final += ""
    }
    # $missing ja entrou acima; aqui so reaproveitamos as linhas ja existentes
    $final += $lines

    $text = (($final -join "`r`n") + "`r`n")

    # trava de seguranca: nunca substitui um .env util por um arquivo incompleto/duplicado
    $mandatory = @("DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL")
    foreach ($m in $mandatory) {
        $n = ([regex]::Matches($text, "(?m)^$m=")).Count
        if ($n -ne 1) { throw "recusado: .env gerado tem $n ocorrencias de $m (esperado 1) - arquivo original preservado" }
    }

    # UTF-8 SEM BOM: o Next.js e os scripts leem o .env linha a linha
    [IO.File]::WriteAllText($envFile, $text, (New-Object Text.UTF8Encoding $false))
}

# ============================================================ 1. REQUISITOS
Step 1 "Requisitos (Node.js, Python, pip)"

$hasNode = $false
try { $nv = (node --version) -replace 'v',''; $hasNode = ([version]$nv -ge [version]"18.0.0") } catch {}
if ($hasNode) {
    Ok "Node.js $((node --version))"
} else {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Info "Node.js ausente -> instalando via winget"
        try {
            winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --silent | Out-Null
            Refresh-Path
            if (Get-Command node -ErrorAction SilentlyContinue) { Ok "Node.js instalado ($((node --version)))" }
            else { Fail "Node.js instalado mas nao encontrado no PATH - reinicie o terminal e rode de novo" }
        } catch { Fail "Nao foi possivel instalar o Node.js automaticamente: $($_.Exception.Message)" }
    } else {
        Fail "Node.js >= 18 ausente e winget indisponivel. Instale manualmente: https://nodejs.org"
    }
}

$hasPython = $false
try {
    $pv = (python --version 2>&1) -replace 'Python ',''
    $hasPython = ([version]$pv -ge [version]"3.10.0") -and ([version]$pv -lt [version]"4.0.0")
} catch {}
if ($hasPython) {
    Ok "Python $((python --version 2>&1))"
} else {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Info "Python 3.10+ ausente -> instalando via winget"
        try {
            winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements --silent | Out-Null
            Refresh-Path
            if (Get-Command python -ErrorAction SilentlyContinue) { Ok "Python instalado ($((python --version 2>&1)))" }
            else { Fail "Python instalado mas nao encontrado no PATH - reinicie o terminal e rode de novo" }
        } catch { Fail "Nao foi possivel instalar o Python automaticamente: $($_.Exception.Message)" }
    } else {
        Fail "Python 3.10+ ausente e winget indisponivel. Instale manualmente: https://python.org"
    }
}

if (Get-Command python -ErrorAction SilentlyContinue) {
    $null = python -m pip --version 2>&1
    if ($LASTEXITCODE -eq 0) { Ok "pip disponivel" } else { Fail "pip indisponivel" }
} else {
    Fail "pip indisponivel (python ausente)"
}

# ============================================================ 2. POSTGRESQL
Step 2 "PostgreSQL"

$envMap = Get-EnvMap
if (-not $DbPassword) {
    if ($envMap.ContainsKey("PG_PASSWORD")) { $DbPassword = $envMap["PG_PASSWORD"] }
    elseif ($envMap.ContainsKey("DATABASE_URL")) {
        if ($envMap["DATABASE_URL"] -match '://([^:]+):([^@]+)@') { $DbPassword = $Matches[2] }
    }
    if (-not $DbPassword) { $DbPassword = "ralu201527" }
}

$pgRoot = $null
$pgBin  = $null
$pgData = $null

function Find-Postgres {
    $candidates = @()
    if ($env:PG_BIN) { $candidates += $env:PG_BIN }
    if ($envMap.ContainsKey("PG_BIN")) { $candidates += $envMap["PG_BIN"] }
    $candidates += "D:\PostgreSQL\18\bin"
    $candidates += "C:\PostgreSQL\18\bin"
    foreach ($d in @("D:\","C:\")) {
        if (Test-Path $d) {
            $candidates += (Get-ChildItem -Path $d -Directory -Filter "PostgreSQL" -ErrorAction SilentlyContinue |
                ForEach-Object { Join-Path $_.FullName "18\bin" })
            $candidates += (Get-ChildItem -Path $d -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -like "PostgreSQL*" } |
                ForEach-Object { Join-Path $_.FullName "bin" })
        }
    }
    $candidates += "C:\Program Files\PostgreSQL\18\bin"
    foreach ($c in $candidates) {
        if ($c -and (Test-Path (Join-Path $c "psql.exe"))) { return $c }
    }
    return $null
}

$pgBin = Find-Postgres
if ($pgBin) {
    Ok "PostgreSQL encontrado em $pgBin"
    $pgRoot = Split-Path $pgBin -Parent
    $pgData = Join-Path $pgRoot "data"
    if (-not (Test-Path $pgData)) { $pgData = $null }
} elseif ($SkipPostgres) {
    Warn "PostgreSQL ausente e -SkipPostgres informado - pulando"
} elseif (-not (Test-Admin)) {
    Fail "PostgreSQL nao encontrado. Rode instalar.bat como Administrador para instalar automaticamente, ou instale manualmente: https://www.enterprisedb.com/downloads/postgresql-postgresql-downloads"
} else {
    Info "PostgreSQL nao encontrado -> baixando instalador oficial (18.3, ~370 MB)"
    $pgDrive = if (Test-Path "D:\") { "D:" } else { "C:" }
    $pgPrefix = "$pgDrive\PostgreSQL\18"
    $installer = Get-Download "https://get.enterprisedb.com/postgresql/postgresql-18.3-1-windows-x64.exe" (Join-Path $env:TEMP "postgresql-18.3-1-windows-x64.exe")
    Info "instalando em silencioso em $pgPrefix (superuser senha definida)"
    # $args e variavel automatica do PowerShell - nao usar como nome de variavel
    $pgArgs = @("--mode","unattended","--unattendedmodeui","none",
              "--superpassword",$DbPassword,
              "--serverport","5432",
              "--prefix",$pgPrefix,
              "--datadir","$pgPrefix\data")
    $p = Start-Process -FilePath $installer -ArgumentList $pgArgs -Wait -PassThru
    if ($p.ExitCode -eq 0 -or $p.ExitCode -eq 3010) {
        Ok "PostgreSQL instalado em $pgPrefix"
    } else {
        Fail "Instalador do PostgreSQL retornou codigo $($p.ExitCode). Instale manualmente e rode de novo."
    }
    $pgBin = Find-Postgres
    if ($pgBin) {
        $pgRoot = Split-Path $pgBin -Parent
        $pgData = Join-Path $pgRoot "data"
    }
}

if ($pgBin) {
    $svc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($svc) {
        if ($svc.Status -ne "Running") {
            Info "iniciando servico $($svc.Name)..."
            try { Start-Service $svc.Name; Start-Sleep -Seconds 3; Ok "servico $($svc.Name) rodando" }
            catch { Warn "nao consegui iniciar o servico automaticamente: $($_.Exception.Message)" }
        } else { Ok "servico $($svc.Name) rodando" }
    }
    $env:PGPASSWORD = $DbPassword
    $probe = & (Join-Path $pgBin "psql.exe") -U postgres -h localhost -tAc "SELECT 1" 2>&1
    if ("$probe" -match "^\s*1\s*$") {
        Ok "conexao com superuser 'postgres' OK"
    } else {
        Warn "conexao com senha atual falhou ($($probe | Select-Object -First 1)). Ajuste DATABASE_URL/PG_PASSWORD no .env."
    }
}

# ============================================================ 3. ARQUIVO .env
Step 3 "Arquivo .env"

$envFile = Join-Path $ProjectDir ".env"
$recordingsDir = ($ProjectDir -replace '\\','/') + "/recordings"
$pgPasswordOut = $DbPassword
if (-not $pgBin) { $pgBin = "D:\PostgreSQL\18\bin" }
if (-not $pgData) { $pgData = (Split-Path $pgBin -Parent) + "\data" }

$desired = [ordered]@{
    "DATABASE_URL"             = "postgresql://postgres:$pgPasswordOut@localhost:5432/camera_monitor?schema=public"
    "PG_BIN"                   = $pgBin
    "PG_DATA"                  = $pgData
    "PG_PASSWORD"              = $pgPasswordOut
    "NEXTAUTH_SECRET"          = (New-Secret)
    "NEXTAUTH_URL"             = "http://localhost:3000"
    "NEXT_PUBLIC_AI_SERVICE_URL" = "http://localhost:8000"
    "LIVE_BASE_URL"            = "http://localhost:8888"
    "REDIS_URL"                = "redis://localhost:6379"
    "RECORDINGS_DIR"           = $recordingsDir
    "AI_SERVICE_KEY"           = "camview-ai-secret-2024"
    "RECORDING_SERVICE_KEY"    = "camview-recorder-secret-2024"
    "AUTH_SECRET"              = (New-Secret)
}

if (-not (Test-Path $envFile)) {
    Info ".env nao existe -> criando com segredos aleatorios"
} else {
    Info ".env existe -> completando apenas as chaves ausentes"
}
try {
    Set-EnvFile $desired
    $envMap = Get-EnvMap
    Ok ".env pronto ($($envMap.Keys.Count) chaves)"
} catch {
    Fail ".env: $($_.Exception.Message)"
}
$envMap = Get-EnvMap

# ============================================================ 4. DEPENDENCIAS NODE
Step 4 "Dependencias Node (npm install)"

if (Test-Path (Join-Path $ProjectDir "node_modules\next\package.json")) {
    Ok "node_modules ja instalado"
} else {
    Info "executando npm install (pode demorar)..."
    Push-Location $ProjectDir
    & npm install --no-audit --no-fund 2>&1 | ForEach-Object { Info "$_" }
    $code = $LASTEXITCODE
    Pop-Location
    if ($code -eq 0) { Ok "npm install concluido" }
    else { Fail "npm install retornou codigo $code" }
}

Push-Location $ProjectDir
& npx prisma generate 2>&1 | Out-Null
$genCode = $LASTEXITCODE
Pop-Location
if ($genCode -eq 0) {
    Ok "prisma client gerado"
} elseif (Test-Path (Join-Path $ProjectDir "node_modules\.prisma\client\index.js")) {
    # EPERM acontece se o servidor esta rodando (DLL do query engine travada) -
    # o client ja existe e esta utilizavel, entao nao e erro.
    Warn "prisma generate nao reescreveu (servidor rodando?) - client existente mantido"
} else {
    Fail "prisma generate falhou (codigo $genCode)"
}

# ============================================================ 5. DEPENDENCIAS PYTHON
Step 5 "Dependencias Python (AI Service)"

$reqFile = Join-Path $ProjectDir "ai-service\requirements.txt"
if (-not (Test-Path $reqFile)) {
    Warn "ai-service\requirements.txt ausente - pulando"
} else {
    $null = python -c "import fastapi, uvicorn, mediapipe, cv2, numpy, httpx, redis" 2>&1
    $okImport = ($LASTEXITCODE -eq 0)
    if ($okImport) {
        Ok "pacotes da IA ja instalados"
    } else {
        Info "instalando pacotes (mediapipe/opencv, pode demorar)..."
        & python -m pip install -r $reqFile --disable-pip-version-check 2>&1 | ForEach-Object { Info "$_" }
        if ($LASTEXITCODE -ne 0) {
            Info "retry com --user"
            & python -m pip install -r $reqFile --user --disable-pip-version-check 2>&1 | ForEach-Object { Info "$_" }
        }
        $null = python -c "import fastapi, mediapipe, cv2" 2>&1
        if ($LASTEXITCODE -eq 0) { Ok "pacotes instalados e importaveis" }
        else { Fail "pacotes da IA nao importam - veja a saida acima" }
    }
}

# ============================================================ 6. BINARIOS
Step 6 "Binarios (ffmpeg, redis, MediaMTX, cloudflared, modelo de pose)"

$root = $ProjectDir
$bins = @(
    @{ Nome = "ffmpeg";        Url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";
       Zip = "$env:TEMP\cm-ffmpeg.zip"; Alvo = Join-Path $root "tools\ffmpeg\bin\ffmpeg.exe"; Arq = "ffmpeg.exe" },
    @{ Nome = "redis";         Url = "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip";
       Zip = "$env:TEMP\cm-redis.zip";  Alvo = Join-Path $root "tools\redis\redis-server.exe"; Arq = "redis-server.exe" },
    @{ Nome = "MediaMTX";      Url = "https://github.com/bluenviron/mediamtx/releases/download/v1.11.1/mediamtx_v1.11.1_windows_amd64.zip";
       Zip = "$env:TEMP\cm-mediamtx.zip"; Alvo = Join-Path $root "mediamtx.exe"; Arq = "mediamtx.exe" },
    @{ Nome = "cloudflared";   Url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe";
       Zip = $null; Alvo = Join-Path $root "cloudflared.exe"; Arq = "cloudflared.exe" },
    @{ Nome = "modelo de pose"; Url = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task";
       Zip = $null; Alvo = Join-Path $root "ai-service\pose_landmarker.task"; Arq = "pose_landmarker.task" }
)

foreach ($b in $bins) {
    if (Test-Path $b.Alvo) { Ok "$($b.Nome) ja presente"; continue }
    if ($SkipBinaries) { Warn "$($b.Nome) ausente e -SkipBinaries informado"; continue }
    try {
        if ($b.Zip) {
            Get-Download $b.Url $b.Zip | Out-Null
            $tmpDir = Join-Path $env:TEMP ("cm-extract-" + $b.Nome.Replace(" ","_"))
            Expand-ZipFile $b.Zip $tmpDir
            if (Copy-FirstFound $tmpDir $b.Arq $b.Alvo) {
                # leva junto os arquivos irmãos (configs do redis, mediamtx.yml etc)
                $found = Get-ChildItem -Path $tmpDir -Recurse -Filter $b.Arq -File | Select-Object -First 1
                foreach ($sibling in (Get-ChildItem -Path $found.DirectoryName -File)) {
                    $destDir = Split-Path $b.Alvo -Parent
                    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
                    Copy-Item $sibling.FullName $destDir -Force -ErrorAction SilentlyContinue
                }
                Ok "$($b.Nome) instalado"
            } else { Fail "$($b.Nome): arquivo $($b.Arq) nao encontrado no pacote" }
            Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
        } else {
            $destDir = Split-Path $b.Alvo -Parent
            if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            Get-Download $b.Url $b.Alvo | Out-Null
            Ok "$($b.Nome) baixado"
        }
    } catch {
        Fail "$($b.Nome): $($_.Exception.Message)"
    }
}

# ============================================================ 7. MEDIAMTX.YML
Step 7 "Configuracao do MediaMTX (mediamtx.yml)"

$mtxYml = Join-Path $root "mediamtx.yml"
if (Test-Path $mtxYml) {
    Ok "mediamtx.yml ja existe"
} else {
    $zip = "$env:TEMP\cm-mediamtx.zip"
    if (Test-Path $zip) {
        $tmpDir = Join-Path $env:TEMP "cm-extract-mediamtx"
        Expand-ZipFile $zip $tmpDir
        if (Copy-FirstFound $tmpDir "mediamtx.yml" $mtxYml) { Ok "mediamtx.yml gerado a partir do pacote oficial" }
        else { Fail "mediamtx.yml nao encontrado no pacote" }
        Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        Fail "mediamtx.yml ausente e o pacote do MediaMTX nao esta em cache - rode a etapa 6 de novo"
    }
}

# cria pastas do projeto
foreach ($d in @("recordings", "dist")) {
    if (-not (Test-Path (Join-Path $root $d))) { New-Item -ItemType Directory -Path (Join-Path $root $d) -Force | Out-Null }
}
Ok "pastas recordings/ e dist/ prontas"

# ============================================================ 8. BANCO
Step 8 "Banco de dados (criar, migrations, seed)"

if ($pgBin -and (Test-Path (Join-Path $pgBin "psql.exe"))) {
    $env:PGPASSWORD = $DbPassword
    $dbExists = & (Join-Path $pgBin "psql.exe") -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='camera_monitor'" 2>&1
    if ("$dbExists" -notmatch "1") {
        Info "criando banco camera_monitor..."
        & (Join-Path $pgBin "psql.exe") -U postgres -h localhost -c "CREATE DATABASE camera_monitor;" 2>&1 | Out-Null
    }
    $check = & (Join-Path $pgBin "psql.exe") -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='camera_monitor'" 2>&1
    if ("$check" -match "1") { Ok "banco camera_monitor pronto" }
    else { Fail "nao consegui criar/verificar o banco camera_monitor" }
} else {
    Fail "psql nao encontrado - banco nao configurado"
}

Push-Location $ProjectDir
Info "aplicando migrations..."
& npx prisma migrate deploy 2>&1 | ForEach-Object { if ("$_" -match "migration|Error|error") { Info "$_" } }
if ($LASTEXITCODE -eq 0) { Ok "migrations aplicadas" }
else { Fail "prisma migrate deploy falhou (codigo $LASTEXITCODE)" }

Info "executando seed (usuarios de teste)..."
& npm run db:seed 2>&1 | ForEach-Object { Info "$_" }
if ($LASTEXITCODE -eq 0) { Ok "seed concluido - admin@admin.com / user@user.com" }
else { Fail "seed falhou (codigo $LASTEXITCODE)" }
Pop-Location

# ============================================================ 9. PAINEL
Step 9 "Painel grafico (dist\CameraMonitor-Panel.exe)"

$panelSrc  = Join-Path $root "server_panel.py"
$panelExe  = Join-Path $root "dist\CameraMonitor-Panel.exe"

if (-not (Test-Path $panelSrc)) {
    Warn "server_panel.py ausente - pulando"
} elseif ((Test-Path $panelExe) -and ((Get-Item $panelExe).LastWriteTime -gt (Get-Item $panelSrc).LastWriteTime)) {
    Ok "exe do painel ja esta atualizado"
} else {
    $null = python -c "import PyInstaller" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Info "instalando PyInstaller..."
        & python -m pip install pyinstaller --disable-pip-version-check 2>&1 | ForEach-Object { Info "$_" }
    }
    Info "compilando painel (PyInstaller, ~1 min)..."
    Push-Location $root
    & python -m PyInstaller --noconfirm --clean --onefile --windowed --name "CameraMonitor-Panel" `
        --distpath "dist" --workpath "build" "server_panel.py" 2>&1 | Select-Object -Last 2 | ForEach-Object { Info "$_" }
    Remove-Item (Join-Path $root "build") -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $root "CameraMonitor-Panel.spec") -Force -ErrorAction SilentlyContinue
    Pop-Location
    if (Test-Path $panelExe) { Ok "painel compilado" }
    else { Fail "compilacao do painel falhou" }
}

# ============================================================ 10. VERIFICACAO
Step 10 "Verificacao final"

$checks = @(
    @{ N = "Node.js";           Ok = (Get-Command node -ErrorAction SilentlyContinue) -ne $null },
    @{ N = "Python";            Ok = (Get-Command python -ErrorAction SilentlyContinue) -ne $null },
    @{ N = "PostgreSQL psql";   Ok = $pgBin -and (Test-Path (Join-Path $pgBin "psql.exe")) },
    @{ N = "node_modules";      Ok = (Test-Path (Join-Path $ProjectDir "node_modules\next\package.json")) },
    @{ N = ".env";              Ok = (Test-Path $envFile) },
    @{ N = "ffmpeg";            Ok = (Test-Path (Join-Path $root "tools\ffmpeg\bin\ffmpeg.exe")) },
    @{ N = "redis-server";      Ok = (Test-Path (Join-Path $root "tools\redis\redis-server.exe")) },
    @{ N = "mediamtx.exe";      Ok = (Test-Path (Join-Path $root "mediamtx.exe")) },
    @{ N = "mediamtx.yml";      Ok = (Test-Path $mtxYml) },
    @{ N = "cloudflared.exe";   Ok = (Test-Path (Join-Path $root "cloudflared.exe")) },
    @{ N = "modelo de pose";    Ok = (Test-Path (Join-Path $root "ai-service\pose_landmarker.task")) },
    @{ N = "recorder/worker.js";Ok = (Test-Path (Join-Path $root "recorder\worker.js")) },
    @{ N = "Painel exe";        Ok = (Test-Path $panelExe) }
)

$allOk = $true
foreach ($c in $checks) {
    if ($c.Ok) { Ok $c.N } else { Fail $c.N; $allOk = $false }
}

Write-Host ""
if ($script:Failures.Count -eq 0) {
    Write-Host "======================================================" -ForegroundColor Green
    Write-Host "  INSTALACAO CONCLUIDA COM SUCESSO" -ForegroundColor Green
    Write-Host "======================================================" -ForegroundColor Green
} else {
    Write-Host "======================================================" -ForegroundColor Yellow
    Write-Host "  INSTALACAO CONCLUIDA COM $($script:Failures.Count) AVISO(S)/FALHA(S)" -ForegroundColor Yellow
    Write-Host "======================================================" -ForegroundColor Yellow
    foreach ($f in $script:Failures) { Write-Host "   - $f" -ForegroundColor DarkYellow }
}

Write-Host ""
Write-Host "  Proximos passos:" -ForegroundColor Cyan
Write-Host "    1) start-server.bat       sobe tudo (Redis, Postgres, Next, IA, recorder, tunnel)" -ForegroundColor White
Write-Host "    2) abrir-painel.bat       painel grafico de controle" -ForegroundColor White
Write-Host "    3) http://localhost:3000  admin@admin.com / admin123" -ForegroundColor White
Write-Host ""
Write-Host "  Veja INSTALACAO.md para detalhes e resolucao de problemas." -ForegroundColor DarkGray
Write-Host ""

if ($StartNow) {
    Info "iniciando servidores..."
    & (Join-Path $root "start-server.bat")
}

if ($script:Failures.Count -gt 0) { exit 1 }
exit 0
