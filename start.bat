@echo off
REM ============================================================
REM  start.bat - sobe o frontend de desenvolvimento (Windows)
REM  Instala dependencias na primeira vez, garante o .env e
REM  inicia o Vite em http://localhost:5180
REM ============================================================
setlocal
cd /d "%~dp0"

REM --- verifica Node ---
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale Node 20+ e tente novamente.
  pause
  exit /b 1
)

REM --- instala dependencias se necessario ---
if not exist "node_modules" (
  echo Instalando dependencias ^(primeira execucao^)...
  call npm install
  if errorlevel 1 (
    echo [ERRO] Falha no npm install.
    pause
    exit /b 1
  )
)

REM --- garante o .env ---
if not exist ".env" (
  echo .env nao encontrado. Criando a partir de .env.example...
  copy ".env.example" ".env" >nul
  echo.
  echo [ATENCAO] Edite o .env e preencha VITE_N8N_WEBHOOK_URL
  echo           com a URL do webhook do n8n antes de usar o chat.
  echo.
)

echo Iniciando servidor em http://localhost:5180 ...
call npm run dev

endlocal
