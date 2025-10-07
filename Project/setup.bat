@echo off
echo ===============================
echo Anand Municipal Corporation Platform Setup
echo ===============================
echo.

echo Installing Node.js dependencies...
echo Please ensure you have Node.js installed on your system.
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version

echo.
echo NPM version:
npm --version

echo.
echo Installing dependencies...
npm install

echo.
echo Creating environment file...
if not exist .env (
    copy .env.example .env
    echo Environment file created. Please configure your settings in .env
) else (
    echo Environment file already exists.
)

echo.
echo Setting up database...
echo Please ensure MongoDB is installed and running, or update the connection string in .env

echo.
echo ===============================
echo Setup Complete!
echo ===============================
echo.
echo Next steps:
echo 1. Configure your .env file with proper credentials
echo 2. Ensure MongoDB is running
echo 3. Run 'npm run dev' to start the development server
echo 4. Run 'npm run seed' to populate with sample data (optional)
echo.
echo For production deployment:
echo - Run 'npm start' to start the production server
echo - Set NODE_ENV=production in your .env file
echo.
pause
