. "$PSScriptRoot\env.ps1"
Push-Location (Join-Path (Split-Path -Parent $PSScriptRoot) "android")
try {
  .\gradlew.bat :app:assembleDebug --no-daemon
} finally {
  Pop-Location
}
