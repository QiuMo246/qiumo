@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title Git 一键同步 V5 Pro

color 0A

echo.
echo ==========================================
echo           Git 一键同步 V5 Pro
echo ==========================================
echo.

:: ========= 检查 Git =========
where git >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [错误] 未安装 Git！
    pause
    exit /b
)

:: ========= 检查 Git 仓库 =========
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [错误] 当前目录不是 Git 仓库！
    pause
    exit /b
)

:: ========= 当前分支 =========
for /f %%i in ('git branch --show-current') do set BRANCH=%%i

echo 当前分支：!BRANCH!
echo.

:: ========= 是否有修改 =========
git status --porcelain > "%temp%\git_status.txt"

for %%A in ("%temp%\git_status.txt") do set SIZE=%%~zA

if "!SIZE!"=="0" (
    echo 没有需要提交的修改。
    echo.
    echo 正在检查远程更新...
    git fetch origin

    git status -uno

    echo.
    pause
    exit /b
)

echo 检测到以下修改：
echo -----------------------------------
type "%temp%\git_status.txt"
echo -----------------------------------
echo.

choice /C YN /M "确认上传这些修改？"

if errorlevel 2 (
    echo 已取消。
    pause
    exit /b
)

echo.
echo [1/5] 添加文件...
git add .

if errorlevel 1 (
    color 0C
    echo git add 失败！
    pause
    exit /b
)

echo.
echo [2/5] 提交...

set MSG=Update %date% %time:~0,8%

git commit -m "!MSG!"

if errorlevel 1 (
    color 0C
    echo Commit 失败！
    pause
    exit /b
)

echo.
echo [3/5] 获取远程更新...
git pull --rebase origin !BRANCH!

if errorlevel 1 (
    color 0C
    echo.
    echo Pull 失败！
    echo.
    echo 如果发生冲突，请解决后重新运行。
    pause
    exit /b
)

echo.
echo [4/5] 推送 GitHub...
git push origin !BRANCH!

if errorlevel 1 (
    color 0C
    echo Push 失败！
    pause
    exit /b
)

echo.
echo [5/5] 完成！

for /f %%i in ('git rev-parse --short HEAD') do set HASH=%%i

echo.
echo 最新 Commit：
echo !HASH!

echo.

for /f %%i in ('git config --get remote.origin.url') do set URL=%%i

echo GitHub：
echo !URL!

echo.

choice /C YN /M "打开 GitHub 仓库？"

if errorlevel 2 goto end

start "" !URL!

:end
echo.
echo 上传成功！
pause