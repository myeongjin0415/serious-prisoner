@echo off
chcp 65001 > nul

:: Set working directory to script location
pushd %~dp0

:: Tweego storyformats path
set "TWEEGO_PATH=%~dp0devTools\tweego\storyformats"

echo =====================================
echo Interactive Story - Compiler
echo =====================================
echo.

:: Ensure dist directory exists
if not exist "%~dp0dist" (
    mkdir "%~dp0dist"
)

echo [1/2] Checking source directory...
echo   Source: %~dp0game
echo.

echo [2/2] Compiling with Tweego...
echo.

:: Compile with Tweego, using game/ as source root and head.html for <head>
CALL "%~dp0devTools\tweego\tweego.exe" ^
    -f sugarcube-2-36-1 ^
    --head "%~dp0devTools\head.html" ^
    -o "%~dp0dist\game.html" ^
    "%~dp0game"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =====================================
    echo Build successful!
    echo =====================================
    echo.
    echo Output: dist\game.html
    echo.
) else (
    echo.
    echo =====================================
    echo Build failed!
    echo =====================================
    echo.
)

pause
