const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withMainApplication
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function getPackageName(config) {
  return config.android?.package || config.androidPackage || "com.local.financetracker";
}

function addService(androidManifest) {
  const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  mainApplication.service = mainApplication.service || [];
  const serviceName = ".notifications.FinanceNotificationListenerService";
  const exists = mainApplication.service.some((item) => item.$["android:name"] === serviceName);
  if (!exists) {
    mainApplication.service.push({
      $: {
        "android:name": serviceName,
        "android:label": "Finance Tracker",
        "android:permission": "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
        "android:exported": "true"
      },
      "intent-filter": [
        {
          action: [
            {
              $: {
                "android:name": "android.service.notification.NotificationListenerService"
              }
            }
          ]
        }
      ]
    });
  }
  return androidManifest;
}

function patchMainApplication(contents, packageName) {
  if (contents.includes("FinanceNotificationPackage")) return contents;
  const importLine = `import ${packageName}.notifications.FinanceNotificationPackage`;
  const withImport = contents.includes(importLine)
    ? contents
    : contents.replace(/(package .+\n)/, `$1\n${importLine}\n`);

  if (withImport.includes("val packages = PackageList(this).packages")) {
    return withImport.replace(
      /val packages = PackageList\(this\)\.packages/,
      "val packages = PackageList(this).packages\n          packages.add(FinanceNotificationPackage())"
    );
  }

  if (withImport.includes("return PackageList(this).packages")) {
    return withImport.replace(
      /return PackageList\(this\)\.packages/,
      "return PackageList(this).packages.apply {\n              add(FinanceNotificationPackage())\n            }"
    );
  }

  return withImport;
}

function writeNativeSources(projectRoot, packageName) {
  const javaPackagePath = packageName.replace(/\./g, "/");
  const targetDir = path.join(projectRoot, "android/app/src/main/java", javaPackagePath, "notifications");
  fs.mkdirSync(targetDir, { recursive: true });

  fs.writeFileSync(
    path.join(targetDir, "FinanceNotificationListenerService.kt"),
    `package ${packageName}.notifications

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class FinanceNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    val extras = sbn.notification.extras
    val title = extras.getCharSequence("android.title")?.toString() ?: ""
    val text = extras.getCharSequence("android.text")?.toString() ?: ""
    FinanceNotificationStore.append(
      applicationContext,
      CapturedNotification(
        packageName = sbn.packageName,
        title = title,
        text = text,
        postedAt = sbn.postTime
      )
    )
  }
}
`
  );

  fs.writeFileSync(
    path.join(targetDir, "FinanceNotificationStore.kt"),
    `package ${packageName}.notifications

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class CapturedNotification(
  val packageName: String,
  val title: String,
  val text: String,
  val postedAt: Long
)

object FinanceNotificationStore {
  private const val PREFS = "finance_notification_store"
  private const val KEY = "pending_notifications"

  fun append(context: Context, notification: CapturedNotification) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val array = JSONArray(prefs.getString(KEY, "[]") ?: "[]")
    val obj = JSONObject()
    obj.put("packageName", notification.packageName)
    obj.put("title", notification.title)
    obj.put("text", notification.text)
    obj.put("postedAt", notification.postedAt)
    array.put(obj)
    prefs.edit().putString(KEY, array.toString()).apply()
  }

  fun read(context: Context): JSONArray {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return JSONArray(prefs.getString(KEY, "[]") ?: "[]")
  }

  fun clear(context: Context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY).apply()
  }
}
`
  );

  fs.writeFileSync(
    path.join(targetDir, "FinanceNotificationModule.kt"),
    `package ${packageName}.notifications

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class FinanceNotificationModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "FinanceNotificationModule"

  @ReactMethod
  fun openNotificationListenerSettings(promise: Promise) {
    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactContext.startActivity(intent)
    promise.resolve(true)
  }

  @ReactMethod
  fun getPendingNotifications(promise: Promise) {
    promise.resolve(FinanceNotificationStore.read(reactContext).toString())
  }

  @ReactMethod
  fun clearPendingNotifications(promise: Promise) {
    FinanceNotificationStore.clear(reactContext)
    promise.resolve(true)
  }
}
`
  );

  fs.writeFileSync(
    path.join(targetDir, "FinanceNotificationPackage.kt"),
    `package ${packageName}.notifications

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class FinanceNotificationPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(FinanceNotificationModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`
  );
}

function ensureSplashColor(projectRoot) {
  const drawableDir = path.join(projectRoot, "android/app/src/main/res/drawable");
  const splashFile = path.join(drawableDir, "splashscreen.xml");
  fs.mkdirSync(drawableDir, { recursive: true });
  fs.writeFileSync(
    splashFile,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#f8fafc"/>
</shape>
`
  );
}

module.exports = function withNotificationListener(config) {
  const packageName = getPackageName(config);
  config = withAndroidManifest(config, (mod) => {
    mod.modResults = addService(mod.modResults);
    return mod;
  });

  config = withDangerousMod(config, [
    "android",
    (mod) => {
      writeNativeSources(mod.modRequest.projectRoot, packageName);
      ensureSplashColor(mod.modRequest.projectRoot);
      return mod;
    }
  ]);

  config = withMainApplication(config, (mod) => {
    mod.modResults.contents = patchMainApplication(mod.modResults.contents, packageName);
    return mod;
  });

  return config;
};
