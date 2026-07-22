@echo off
cd /d "%~dp0"

echo ========================================
echo  Deploy to Cloudflare - qiumo.site
echo ========================================
echo.

:: --- Auto-detect system proxy ---
set "GIT_PROXY="
for /f "tokens=2" %%a in ('netsh winhttp show proxy ^| findstr "代理服务器 Proxy"') do (
    if not "%%a"=="" (
        set "GIT_PROXY=%%a"
    )
)
if "%GIT_PROXY%"=="" (
    for /f "tokens=4 delims= " %%a in ('netsh winhttp show proxy ^| findstr "Proxy"') do (
        if not "%%a"=="" set "GIT_PROXY=%%a"
    )
)
:: Also check environment proxy vars
if "%GIT_PROXY%"=="" set "GIT_PROXY=%http_proxy%"
if "%GIT_PROXY%"=="" set "GIT_PROXY=%HTTPS_PROXY%"

if not "%GIT_PROXY%"=="" (
    echo [INFO] Detected proxy: %GIT_PROXY%
    git config http.proxy "%GIT_PROXY%"
    git config https.proxy "%GIT_PROXY%"
) else (
    echo [INFO] No system proxy detected
    :: Remove any stale proxy config
    git config --unset http.proxy 2>nul
    git config --unset https.proxy 2>nul
)

:: --- Commit ---
set "HAS_CHANGES=1"
git diff --quiet
if not errorlevel 1 set "HAS_CHANGES=0"
git diff --cached --quiet
if not errorlevel 1 (
    if "%HAS_CHANGES%"=="0" set "HAS_CHANGES=0"
) else (
    set "HAS_CHANGES=1"
)

if "%HAS_CHANGES%"=="1" (
    git add .
    git commit -m "deploy: %date% %time%"
    if errorlevel 1 (
        echo [ERROR] git commit failed
        pause
        exit /b 1
    )
) else (
    echo [INFO] No changes to commit
)

:: --- Push ---
echo.
echo [1/2] Pushing static site to GitHub...
git push
if errorlevel 1 (
    echo.
    echo [ERROR] git push failed - trying proxy fallback...
    if "%GIT_PROXY%"=="" (
        echo [HINT] Your network may need a proxy. Try:
        echo   git config http.proxy http://127.0.0.1:PORT
        echo   git config https.proxy http://127.0.0.1:PORT
        echo   ^(Replace PORT with your proxy port, e.g. 7890, 7897, 10809^)
    ) else (
        echo [HINT] Proxy "%GIT_PROXY%" was configured but still failed.
        echo        Check if the proxy address is correct.
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
