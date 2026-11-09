@echo off
chcp 65001 >nul
title Estudio de Video HETNA
cd /d "%~dp0"

if not exist "venv\Scripts\python.exe" (
    echo Primera vez: creando el entorno de Python...
    python -m venv venv
    if errorlevel 1 (
        echo.
        echo No se pudo crear el entorno. Verifica que Python este instalado.
        pause
        exit /b 1
    )
    echo Instalando librerias, esto tarda unos minutos...
    "venv\Scripts\python.exe" -m pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo Fallo la instalacion. Copia el error de arriba.
        pause
        exit /b 1
    )
)

echo Abriendo Estudio de Video HETNA en el navegador...
echo Para cerrarlo, cierra esta ventana.
"venv\Scripts\python.exe" app.py
pause
