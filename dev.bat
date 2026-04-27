@echo off
REM Roda o servidor de desenvolvimento local do CampoIQ
cd /d "%~dp0"

if not exist ".env.local" (
  echo [ERRO] .env.local nao encontrado. Rode setup.bat primeiro.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [AVISO] node_modules nao encontrado. Rodando npm install...
  call npm install
)

echo.
echo ============================================================
echo  CampoIQ - Servidor local
echo  Acesse http://localhost:3000 no navegador
echo  Pressione Ctrl+C para parar
echo ============================================================
echo.
call npm run dev
