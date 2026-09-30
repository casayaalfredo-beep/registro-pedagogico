@echo off
title Sistema de Registro Pedagogico
color 0B
echo ====================================================
echo    INICIANDO EL SISTEMA DE REGISTRO PEDAGOGICO
echo ====================================================
echo.
echo Cerrando instancias anteriores para evitar errores...
for /f "tokens=5" %%a in ('netstat -aon ^| find "3000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find "5000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find "5173" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo.
echo Creando respaldo de seguridad preventivo...
if not exist "%~dp0server\prisma\backups_auto" mkdir "%~dp0server\prisma\backups_auto"
if exist "%~dp0server\prisma\dev.db" powershell -Command "Copy-Item -Path '%~dp0server\prisma\dev.db' -Destination ('%~dp0server\prisma\backups_auto\dev_sesion_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.db') -Force" >nul 2>&1

echo 1. Iniciando la Base de Datos y el Servidor...
cd /d "%~dp0server"
start "Servidor_Registro" /MIN cmd /c "node index.js"
timeout /t 3 /nobreak > nul

echo 2. Iniciando la Interfaz Grafica...
cd /d "%~dp0client"
start "Cliente_Registro" /MIN cmd /c "npm run dev"
timeout /t 4 /nobreak > nul

echo 3. Abriendo la aplicacion en tu Navegador...
start http://localhost:5173

echo.
echo ====================================================
echo      ¡SISTEMA INICIADO Y LISTO PARA TRABAJAR!
echo ====================================================
echo.
echo IMPORTANTE: 
echo Mantenga esta ventana negra abierta (puede minimizarla)
echo mientras este trabajando en su registro.
echo.
echo Cuando haya terminado de trabajar y quiera APAGAR el sistema,
echo vuelva a esta ventana y presione cualquier tecla.
echo.
pause

echo.
echo Guardando respaldo final de la sesion...
if exist "%~dp0server\prisma\dev.db" powershell -Command "Copy-Item -Path '%~dp0server\prisma\dev.db' -Destination ('%~dp0server\prisma\backups_auto\dev_cierre_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.db') -Force" >nul 2>&1

echo Apagando el sistema...
for /f "tokens=5" %%a in ('netstat -aon ^| find "3000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find "5000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find "5173" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
echo Sistema apagado correctamente. Hasta pronto!
timeout /t 2 /nobreak > nul
