@echo off
chcp 65001 >nul
title AI Low Token Sync V2

echo ================================
echo  AI 自动索引 + 同步系统 v2
echo ================================

echo.
echo [1] 生成项目索引...
node generate-map.js

echo.
echo [2] 生成 Git diff...
node generate-diff.js

echo.
echo [3] 构建 AI 上下文...
node generate-context.js

echo.
echo [4] Git 提交...

git add .
git commit -m "auto sync v2"

echo.
echo [5] 推送...
git push

echo.
echo ================================
echo 完成！
echo ================================
pause