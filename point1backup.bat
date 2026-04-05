@echo off
echo [Point 1 Backup] Backing up the current src folder...
if not exist "backups\point1" mkdir backups\point1
xcopy /E /I /Y src backups\point1\src
echo.
echo Backup point1 saved successfully!
