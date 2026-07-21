@echo off
cd /d "%~dp0"

echo ========================================
echo  Deploy to Cloudflare - qiumo.site
echo ========================================
echo.

git status --short

git diff --quiet && git diff --cached --quiet
if errorlevel 1 (
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

echo.
echo [1/2] Pushing static site to GitHub...
git push
if errorlevel 1 (
    echo [ERROR] git push failed
    pause
    exit /b 1
)
echo [OK] Pages will auto-deploy

echo.
echo [2/2] Deploying Cloudflare Worker...
cd worker
npx wrangler deploy
cd ..
if errorlevel 1 (
    echo [WARN] Worker deploy may have failed
) else (
    echo [OK] Worker deployed
)

echo.
echo ========================================
echo  Done!
echo  Pages:  https://qiumo-site.pages.dev
echo ========================================
pause
