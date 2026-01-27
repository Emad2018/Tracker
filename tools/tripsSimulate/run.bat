@echo off
setlocal enabledelayedexpansion

:: --- CONFIGURATION ---
set ENV_NAME=tracker_sim
set DATA_FILE=data/trips.json
set PROCESS_SCRIPT=data/tprocess_data.py
set GUI_SCRIPT=gui_main.py

echo [1/4] Checking Anaconda installation...
where conda >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Anaconda/Conda is not in your system PATH.
    echo Please install Anaconda or add it to PATH and try again.
    pause
    exit /b
)

echo [2/4] Checking for Conda environment: %ENV_NAME%...
call conda env list | findstr /C:"%ENV_NAME%" >nul
if %ERRORLEVEL% neq 0 (
    echo Environment '%ENV_NAME%' not found. Creating it now...
    :: Create the environment and install basic requirements
    call conda env create -f environment.yml
    call conda activate %ENV_NAME%
) else (
    echo Environment '%ENV_NAME%' exists.
    call conda activate %ENV_NAME%
)

echo [3/4] Checking for data file: %DATA_FILE%...
if not exist "%DATA_FILE%" (
    echo %DATA_FILE% missing. Running %PROCESS_SCRIPT%...
    if exist "%PROCESS_SCRIPT%" (
        python "%PROCESS_SCRIPT%"
    ) else (
        echo Error: %PROCESS_SCRIPT% not found. Cannot generate data.
        pause
        exit /b
    )
) else (
    echo %DATA_FILE% found.
)

echo [4/4] Starting GUI...
python "%GUI_SCRIPT%"

pause