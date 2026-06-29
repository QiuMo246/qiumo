@echo off
chcp 65001 >nul
title Git 自动更新工具

echo.
echo =====================================
echo          Git 自动更新工具
echo =====================================
echo.

:: 检查是否在 Git 仓库
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [错误] 当前目录不是 Git 仓库！
    pause
    exit /b
)

:: 检查是否有修改
git diff --quiet
if %errorlevel%==0 (
    git diff --cached --quiet
    if %errorlevel%==0 (
        echo [提示] 没有任何修改需要上传。
        echo.
        pause
        exit /b
    )
)

echo [1/4] 添加文件...
git add .

echo.
echo [2/4] 创建提交...

set msg=%date% %time:~0,8%

git commit -m "%msg%"
if errorlevel 1 (
    echo.
    echo [错误] Commit 失败！
    pause
    exit /b
)

echo.
echo [3/4] 推送到 GitHub...
git push

if errorlevel 1 (
    echo.
    echo [错误] Push 失败！
    pause
    exit /b
)

echo.
echo =====================================
echo        上传成功！
echo =====================================
echo Commit:
echo %msg%
echo.
pause