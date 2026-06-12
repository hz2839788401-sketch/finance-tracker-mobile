package com.local.financetracker.notifications

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
