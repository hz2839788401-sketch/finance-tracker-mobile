package com.local.financetracker.notifications

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
