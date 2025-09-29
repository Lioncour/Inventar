@echo off
timeout /t 1 /nobreak >nul
git status --porcelain
timeout /t 1 /nobreak >nul
git add .
timeout /t 1 /nobreak >nul
git commit -m "Auto commit changes"
timeout /t 1 /nobreak >nul
git pull --no-edit
timeout /t 1 /nobreak >nul
git push

