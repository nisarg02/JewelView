@echo off
echo [Point 1 Restore] Restoring the src folder from point1 backup...
if exist "backups\point1\src" (
    xcopy /E /I /Y backups\point1\src src
    echo.
    echo Successfully restored the code to point1 state!
) else (
    echo Error: No backup found at backups\point1\src!
)
