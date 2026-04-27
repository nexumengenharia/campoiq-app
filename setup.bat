@echo off
REM =============================================================================
REM CampoIQ - Setup inicial (clique duplo para rodar)
REM =============================================================================
REM O que faz:
REM   1. Verifica Node.js e Git
REM   2. Cria .env.local a partir do exemplo (se ainda nao existe)
REM   3. Roda npm install
REM   4. Inicializa repo git (se ainda nao for)
REM =============================================================================

cd /d "%~dp0"
echo.
echo ============================================================
echo  CampoIQ - Setup inicial
echo ============================================================
echo.

REM Verifica Node
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Baixe em https://nodejs.org/
  echo        Instale a versao LTS e rode este script novamente.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo Node.js: %%v

REM Verifica Git
where git >nul 2>nul
if errorlevel 1 (
  echo [AVISO] Git nao encontrado. Para commitar e publicar no GitHub,
  echo         instale em https://git-scm.com/download/win
) else (
  for /f "tokens=*" %%v in ('git --version') do echo %%v
)
echo.

REM Cria .env.local se nao existe
if not exist ".env.local" (
  if exist ".env.local.example" (
    copy ".env.local.example" ".env.local" >nul
    echo [OK] Arquivo .env.local criado.
    echo     IMPORTANTE: abra .env.local e preencha com as 3 variaveis do Supabase.
  )
) else (
  echo [OK] .env.local ja existe.
)
echo.

REM npm install
echo Instalando dependencias (pode demorar 2-5 min na primeira vez)...
call npm install
if errorlevel 1 (
  echo [ERRO] npm install falhou. Verifique sua conexao de internet.
  pause
  exit /b 1
)
echo.

REM Inicializa git se ainda nao for repo
if not exist ".git" (
  where git >nul 2>nul
  if not errorlevel 1 (
    echo Inicializando repositorio Git...
    git init
    git add .
    git commit -m "CampoIQ: estrutura inicial"
    echo [OK] Repositorio Git criado com commit inicial.
  )
) else (
  echo [OK] Repositorio Git ja existe.
)
echo.

echo ============================================================
echo  Setup concluido!
echo ============================================================
echo.
echo PROXIMOS PASSOS:
echo   1) Abra .env.local e preencha as 3 variaveis do Supabase
echo      (Settings -^> API no painel do Supabase)
echo   2) De clique duplo em dev.bat para rodar localmente
echo   3) Quando pronto, de clique duplo em push.bat para enviar ao GitHub
echo.
echo Veja PASSO-A-PASSO.md para o roteiro completo.
echo.
pause
