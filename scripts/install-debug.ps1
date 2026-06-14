. "$PSScriptRoot\env.ps1"
$Root = Split-Path -Parent $PSScriptRoot
$Apk = Join-Path $Root "android\app\build\outputs\apk\debug\app-debug.apk"
if (!(Test-Path -LiteralPath $Apk)) {
  throw "APK not found: $Apk. Run scripts\build-debug.ps1 first."
}
adb devices -l
adb install -r $Apk
adb shell monkey -p com.local.financetracker -c android.intent.category.LAUNCHER 1
