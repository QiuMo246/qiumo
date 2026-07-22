@echo off
cd /d "%~dp0"

echo ========================================
echo  Deploy to Cloudflare - qiumo.site
echo ========================================
echo.

:: --- Auto-detect system proxy ---
set "GIT_PROXY="
for /f "tokens=2" %%a in ('netsh winhttp show proxy ^| findstr "代理服务器 Proxy"') do (
    if not "%%a"=="" set "GIT_PROXY=%%a"
)
if "%GIT_PROXY%"=="" (
    for /f "tokens=4 delims= " %%a in ('netsh winhttp show proxy ^| findstr "Proxy"') do (
        if not "%%a"=="" set "GIT_PROXY=%%a"
    )
)
if "%GIT_PROXY%"=="" set "GIT_PROXY=%http_proxy%"
if "%GIT_PROXY%"=="" set "GIT_PROXY=%HTTPS_PROXY%"

if not "%GIT_PROXY%"=="" (
    echo [INFO] Detected proxy: %GIT_PROXY%
    :: Environment variables are needed for Windows schannel to work
    set "HTTP_PROXY=%GIT_PROXY%"
    set "HTTPS_PROXY=%GIT_PROXY%"
    :: Also set git config as fallback
    git config http.proxy "%GIT_PROXY%" 2>nul
    git config https.proxy "%GIT_PROXY%" 2>nul
) else (
    echo [INFO] No system proxy detected
    set "HTTP_PROXY="
    set "HTTPS_PROXY="
    git config --unset http.proxy 2>nul
    git config --unset https.proxy 2>nul
)

:: --- Commit ---
git diff --quiet
if errorlevel 1 goto :has_changes
git diff --cached --quiet
if errorlevel 1 goto :has_changes

echo [INFO] No changes to commit
goto :push

:has_changes
git add .
git commit -m "deploy: %date% %time%"
if errorlevel 1 (
    echo [ERROR] git commit failed
    pause
    exit /b 1
)

:: --- Push ---
:push
echo.
echo [1/2] Pushing static site to GitHub...
git push
if errorlevel 1 (
    echo.
    echo [ERROR] git push failed
    if not "%GIT_PROXY%"=="" (
        echo [HINT] Proxy was set to "%GIT_PROXY%" but still failed.
        echo        Your proxy may need authentication or a different port.
    ) else (
        echo [HINT] If you use a proxy, try setting it manually:
        echo   set HTTP_PROXY=http://127.0.0.1:PORT
        echo   set HTTPS_PROXY=http://127.0.0.1:PORT
        echo   git push
    )
    pause
    exit /b 1
)
echo [OK] Pages will auto-deploy

:: --- Deploy Worker ---
echo.
echo [2/2] Deploying Cloudflare Worker...
if exist worker\ (
    cd worker
    npx wrangler deploy
    cd ..
    if errorlevel 1 (
        echo [WARN] Worker deploy may have failed
    ) else (
        echo [OK] Worker deployed
    )
) else (
    echo [WARN] worker\ directory not found, skipping
)

echo.
echo ========================================
echo  Done!
echo  Pages:  https://qiumo-me.pages.dev
echo ========================================
pause
