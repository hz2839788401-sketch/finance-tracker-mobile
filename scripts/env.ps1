$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Workspace = Split-Path -Parent $Root
$Toolchains = Join-Path $Workspace "toolchains"
$Jdk = Join-Path $Toolchains "jdk-17\jdk-17.0.19+10"
$Sdk = Join-Path $Toolchains "android-sdk"

$env:JAVA_HOME = $Jdk
$env:ANDROID_HOME = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk
$env:GRADLE_USER_HOME = Join-Path $Root ".gradle"
$env:npm_config_cache = Join-Path $Root ".npm-cache"
$env:__UNSAFE_EXPO_HOME_DIRECTORY = Join-Path $Root ".expo-home"
$env:TEMP = Join-Path $Root ".tmp"
$env:TMP = Join-Path $Root ".tmp"
$env:Path = "$Jdk\bin;$Sdk\platform-tools;$Sdk\cmdline-tools\latest\bin;$env:Path"
$env:NODE_ENV = "development"

New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME, $env:npm_config_cache, $env:__UNSAFE_EXPO_HOME_DIRECTORY, $env:TEMP | Out-Null

# Force project-local caches on D: (avoid C:\Users\...\.gradle)
Write-Host "Finance Tracker Android debug env (D: project caches)"
Write-Host "JAVA_HOME=$env:JAVA_HOME"
Write-Host "ANDROID_HOME=$env:ANDROID_HOME"
Write-Host "GRADLE_USER_HOME=$env:GRADLE_USER_HOME"
