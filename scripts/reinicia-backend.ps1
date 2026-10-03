<#
.SYNOPSIS
  Reinicia o backend FastAPI (porta 8000) com segurança e confere se ele serve o código atual.

.DESCRIPTION
  Por que existe: os testes usam o TestClient direto no código, então passam
  mesmo com o servidor real servindo código velho. Já aconteceu de duas formas:
    (a) uma instância antiga rodando sem --reload;
    (b) o --reload travou (pasta no OneDrive) e, ao matar o dono da porta, o
        worker filho "spawn_main(parent_pid=...)" ficou órfão segurando o
        socket e respondendo com o código velho. O Get-NetTCPConnection mostra
        o PID do pai já morto, então "matar o dono da porta" não resolve.

  Passos:
    1. encerra os uvicorn deste repo (python do venv rodando app.main:app);
    2. encerra os workers spawn_main ligados a eles, inclusive órfãos;
    3. espera a porta liberar;
    4. sobe de novo em nova janela via backend\start.bat;
    5. espera /health e roda backend\scripts\confere_servidor.py.

  Use -DryRun para só listar o que seria encerrado, sem tocar em nada.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\reinicia-backend.ps1 -DryRun
#>
param(
    [switch]$DryRun,
    [int]$Porta = 8000,
    [int]$TimeoutPortaSeg = 15,
    [int]$TimeoutHealthSeg = 60
)

$ErrorActionPreference = 'Stop'

$Raiz = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Raiz 'backend'
$VenvPy = Join-Path $Backend 'venv\Scripts\python.exe'
$StartBat = Join-Path $Backend 'start.bat'
$Confere = Join-Path $Backend 'scripts\confere_servidor.py'

if (-not (Test-Path $VenvPy)) {
    Write-Host "python do venv não encontrado em $VenvPy" -ForegroundColor Red
    exit 2
}

# O python.exe do venv no Windows é só um lançador: ele cria um filho com o
# python BASE (o "home" do pyvenv.cfg), mas com a mesma linha de comando do
# venv. Os workers do --reload também rodam com esse python base. Por isso o
# critério do uvicorn é "linha de comando cita o python do venv" e não só o
# ExecutablePath.
$PythonBase = $null
$Cfg = Join-Path $Backend 'venv\pyvenv.cfg'
if (Test-Path $Cfg) {
    $linhaHome = Get-Content $Cfg | Where-Object { $_ -match '^\s*home\s*=' } | Select-Object -First 1
    if ($linhaHome) { $PythonBase = Join-Path (($linhaHome -split '=', 2)[1].Trim()) 'python.exe' }
}

function Contem([string]$texto, [string]$trecho) {
    if (-not $texto -or -not $trecho) { return $false }
    return $texto.IndexOf($trecho, [StringComparison]::OrdinalIgnoreCase) -ge 0
}

function DonosDaPorta {
    @(Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
}

$pythons = @(Get-CimInstance Win32_Process -Filter "Name='python.exe'")
$vivos = @{}
Get-Process | ForEach-Object { $vivos[[int]$_.Id] = $true }

# --- 1. uvicorn deste repo ---------------------------------------------------
# Só o que roda "uvicorn app.main:app" pelo venv DESTE repo. Outro projeto com
# uvicorn, ou qualquer outro python da máquina, fica de fora.
$uvicorns = @($pythons | Where-Object {
        (Contem $_.CommandLine 'uvicorn app.main:app') -and
        (($_.ExecutablePath -eq $VenvPy) -or (Contem $_.CommandLine $VenvPy))
    })
$idsUvicorn = @{}
$uvicorns | ForEach-Object { $idsUvicorn[[int]$_.ProcessId] = $true }

# --- 2. workers spawn_main --------------------------------------------------
# O --reload roda o servidor num worker "spawn_main(parent_pid=N)". Se o pai
# morre, o worker pode continuar vivo segurando a porta (caso b). Critérios:
#   - pai é um dos uvicorn acima -> encerra (vai junto com o pai);
#   - pai já morreu -> só encerra se houver evidência de que é o nosso: o
#     executável é o python do venv/base dele E a porta 8000 está registrada
#     em nome de um PID que não existe mais (o sintoma do órfão). Sem essa
#     evidência, o órfão é só listado como ignorado — pode ser de outro projeto.
$donos = DonosDaPorta
$donoMorto = @($donos | Where-Object { -not $vivos[[int]$_] })
$portaComDonoMorto = $donoMorto.Count -gt 0

$workers = @()
$ignorados = @()
foreach ($p in $pythons) {
    if (-not ($p.CommandLine -match 'spawn_main\(parent_pid=(\d+)')) { continue }
    $pai = [int]$Matches[1]
    if ($idsUvicorn[$pai]) {
        $workers += [pscustomobject]@{ Proc = $p; Motivo = "filho do uvicorn $pai" }
        continue
    }
    if ($vivos[$pai]) { continue }  # pai vivo e não é nosso: não é da nossa conta
    $exeNosso = ($p.ExecutablePath -eq $VenvPy) -or ($PythonBase -and ($p.ExecutablePath -eq $PythonBase))
    if ($exeNosso -and $portaComDonoMorto) {
        $workers += [pscustomobject]@{ Proc = $p; Motivo = "órfão (pai $pai morto; porta $Porta em nome de PID morto)" }
    }
    else {
        $ignorados += [pscustomobject]@{ Proc = $p; Motivo = "órfão sem ligação comprovada com a porta $Porta (pai $pai morto)" }
    }
}

# --- mostra o que vai fazer -------------------------------------------------
$titulo = if ($DryRun) { 'DRY-RUN — encerraria:' } else { 'Encerrando:' }
Write-Host $titulo -ForegroundColor Cyan
if ($uvicorns.Count -eq 0 -and $workers.Count -eq 0) { Write-Host '  (nada)' }
foreach ($u in $uvicorns) {
    Write-Host ("  PID {0,-7} uvicorn (pai {1})  {2}" -f $u.ProcessId, $u.ParentProcessId, $u.CommandLine)
}
foreach ($w in $workers) {
    Write-Host ("  PID {0,-7} worker {1}  {2}" -f $w.Proc.ProcessId, $w.Motivo, $w.Proc.CommandLine)
}
foreach ($i in $ignorados) {
    Write-Host ("  ignorado PID {0}: {1}" -f $i.Proc.ProcessId, $i.Motivo) -ForegroundColor Yellow
}
$descDonos = if ($donos.Count) { ($donos | ForEach-Object { if ($vivos[[int]$_]) { "$_" } else { "$_ (morto)" } }) -join ', ' } else { 'ninguém' }
Write-Host "Porta $Porta em escuta por: $descDonos"

if ($DryRun) {
    Write-Host "DRY-RUN: nada foi encerrado nem iniciado. Subiria: $StartBat (dir $Backend)" -ForegroundColor Cyan
    exit 0
}

# --- encerra ----------------------------------------------------------------
# Workers primeiro: são eles que seguram o socket; depois os uvicorn.
foreach ($id in @($workers | ForEach-Object { $_.Proc.ProcessId }) + @($uvicorns | ForEach-Object { $_.ProcessId })) {
    try { Stop-Process -Id $id -Force -ErrorAction Stop }
    catch { if (Get-Process -Id $id -ErrorAction SilentlyContinue) { Write-Host "  não consegui encerrar PID ${id}: $_" -ForegroundColor Yellow } }
}

# --- 3. espera a porta liberar ---------------------------------------------
# Se algo continua escutando, subir outro uvicorn só daria "address in use"
# (ou, pior, os dois disputando). Melhor parar e dizer quem é.
$limite = (Get-Date).AddSeconds($TimeoutPortaSeg)
while ((DonosDaPorta).Count -gt 0) {
    if ((Get-Date) -gt $limite) {
        $resto = (DonosDaPorta) -join ', '
        Write-Host "A porta $Porta não liberou em ${TimeoutPortaSeg}s (PID registrado: $resto)." -ForegroundColor Red
        Write-Host "Confira com: Get-CimInstance Win32_Process -Filter ""Name='python.exe'"" | Select ProcessId,ParentProcessId,CommandLine" -ForegroundColor Red
        exit 3
    }
    Start-Sleep -Milliseconds 500
}
Write-Host "Porta $Porta livre."

# --- 4. sobe de novo --------------------------------------------------------
# Mesmo comando do dia a dia (start.bat), numa janela própria: o servidor não
# fica preso a este terminal e o log aparece onde o Marco já espera.
Start-Process -FilePath $StartBat -WorkingDirectory $Backend | Out-Null
Write-Host "Backend iniciado em nova janela ($StartBat)."

# --- 5. espera /health e confere -------------------------------------------
$limite = (Get-Date).AddSeconds($TimeoutHealthSeg)
$ok = $false
while (-not $ok) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$Porta/health" -UseBasicParsing -TimeoutSec 2
        $ok = ($r.StatusCode -eq 200)
    }
    catch { }
    if (-not $ok) {
        if ((Get-Date) -gt $limite) {
            Write-Host "/health não respondeu 200 em ${TimeoutHealthSeg}s — veja a janela do backend." -ForegroundColor Red
            exit 4
        }
        Start-Sleep -Milliseconds 500
    }
}
Write-Host "/health OK."

& $VenvPy $Confere --url "http://localhost:$Porta"
exit $LASTEXITCODE
