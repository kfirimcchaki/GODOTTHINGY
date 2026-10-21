@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "ENGINE_DIR=%~dp0upstream\godot"
set "MODULE_DIR=%~dp0integration\modules\psych_engine"

if not exist "%ENGINE_DIR%\SConstruct" (
    echo Godot 4.7.2 source submodule is not initialized. Fetching it now...
    git submodule update --init --depth 1 -- upstream/godot
    if errorlevel 1 (
        echo ERROR: Could not initialize the Godot source submodule.
        exit /b 1
    )
)

set "PYTHON="
where py >nul 2>nul
if not errorlevel 1 (
    set "PYTHON=py -3"
) else (
    where python >nul 2>nul
    if not errorlevel 1 set "PYTHON=python"
)
if not defined PYTHON (
    echo ERROR: Python 3 was not found. Install Python 3 and ensure it is on PATH.
    exit /b 1
)

%PYTHON% --version >nul 2>nul
if errorlevel 1 (
    echo ERROR: The detected Python command could not run.
    exit /b 1
)

%PYTHON% -c "import SCons" >nul 2>nul
if errorlevel 1 (
    echo SCons is missing. Installing it for the current user...
    %PYTHON% -m pip --version >nul 2>nul
    if errorlevel 1 %PYTHON% -m ensurepip --upgrade
    if errorlevel 1 (
        echo ERROR: pip could not be enabled for this Python installation.
        exit /b 1
    )
    %PYTHON% -m pip install --user scons
    if errorlevel 1 (
        echo ERROR: SCons installation failed.
        exit /b 1
    )
    for /f "usebackq delims=" %%P in (`%PYTHON% -c "import site; print(site.USER_BASE + r'\Scripts')"`) do set "PYTHON_SCRIPTS=%%P"
    if defined PYTHON_SCRIPTS set "PATH=%PYTHON_SCRIPTS%;%PATH%"
)

for /f "usebackq delims=" %%P in (`%PYTHON% -c "import site; print(site.USER_BASE + r'\Scripts')"`) do set "PYTHON_SCRIPTS=%%P"
if defined PYTHON_SCRIPTS set "PATH=%PYTHON_SCRIPTS%;%PATH%"

where scons >nul 2>nul
if errorlevel 1 (
    echo ERROR: SCons is installed but its executable is not on PATH.
    echo Add the Python Scripts directory to PATH and rerun build.bat.
    exit /b 1
)

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" set "VSWHERE=%ProgramFiles%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" (
    echo ERROR: vswhere.exe was not found. Install Visual Studio 2022 with the C++ desktop workload.
    exit /b 1
)

set "VSINSTALL="
for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSINSTALL=%%i"
if not defined VSINSTALL (
    echo ERROR: Visual Studio C++ x64 build tools were not found.
    exit /b 1
)

set "VCVARS=%VSINSTALL%\VC\Auxiliary\Build\vcvars64.bat"
if not exist "%VCVARS%" (
    echo ERROR: vcvars64.bat was not found at "%VCVARS%".
    exit /b 1
)
call "%VCVARS%"
if errorlevel 1 (
    echo ERROR: MSVC environment initialization failed.
    exit /b 1
)

%PYTHON% "%~dp0tools\integrate.py" --engine "%ENGINE_DIR%"
if errorlevel 1 exit /b 1

set "JOBS=%NUMBER_OF_PROCESSORS%"
if not defined JOBS set "JOBS=4"
cd /d "%ENGINE_DIR%"
call scons platform=windows target=editor dev_build=no optimize=speed -j%JOBS% custom_modules="%MODULE_DIR%"
if errorlevel 1 (
    echo ERROR: Godot build failed.
    exit /b 1
)

echo Build succeeded: %ENGINE_DIR%\bin\godot.windows.editor.x86_64.exe
exit /b 0
