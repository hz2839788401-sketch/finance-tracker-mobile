package com.local.financetracker.notifications

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
