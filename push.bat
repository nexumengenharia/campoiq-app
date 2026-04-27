@echo off
REM =============================================================================
REM CampoIQ - Commit e push para o GitHub
REM =============================================================================
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Git nao instalado. Baixe em https://git-scm.com/download/win
  pause
  exit /b 1
)

if not exist ".git" (
  echo [INFO] Repositorio Git ainda nao inicializado. Rodando setup...
  git init
)

echo.
echo ============================================================
echo  CampoIQ - Push para GitHub
echo ============================================================
echo.

REM Verifica se ja tem remote origin
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo [CONFIGURACAO] Nenhum remote 'origin' configurado ainda.
  echo.
  echo 1) Crie um repositorio vazio no GitHub (NAO marque nenhuma opcao de init):
  echo    https://github.com/new
  echo.
  echo 2) Copie a URL do repo (algo como: https://github.com/seu-user/campoiq-app.git)
  echo.
  set /p REPO_URL="Cole a URL aqui e pressione ENTER: "
  git remote add origin !REPO_URL!
  git branch -M main
)

echo.
set /p COMMIT_MSG="Mensagem do commit (ENTER para 'atualizacao'): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=atualizacao

git add .
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo [INFO] Nada para commitar, ou o commit ja foi feito.
)

echo.
echo Enviando para o GitHub...
git push -u origin main
if errorlevel 1 (
  echo.
  echo [ERRO] Push falhou. Possiveis causas:
  echo   - Autenticacao: configure o GitHub no seu Git ^(git config --global user.name / user.email^)
  echo   - Token: pode precisar de Personal Access Token em https://github.com/settings/tokens
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  [OK] Push concluido com sucesso!
echo ============================================================
echo.
echo PROXIMO PASSO:
echo   - Va em https://vercel.com/new e importe seu repo do GitHub
echo   - Adicione as 3 variaveis de ambiente (mesmas do .env.local)
echo   - Clique em Deploy
echo.
pause
