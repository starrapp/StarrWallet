package expo.modules.accessibilitydatasensitive

import android.app.Activity
import android.content.Context
import android.os.Build
import android.os.Bundle
import android.view.View
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class AccessibilityDataSensitivePackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
    listOf(object : ReactActivityLifecycleListener {
      override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
        // Do not show the recovery phrase to accessibility services that are not accessibility tools.
        // All child views get this value from the decor view.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
          activity.window.decorView.setAccessibilityDataSensitive(View.ACCESSIBILITY_DATA_SENSITIVE_YES)
        }
      }
    })
}
