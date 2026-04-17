package app.aphylia;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import com.getcapacitor.BridgeActivity;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class MainActivity extends BridgeActivity {

    /**
     * FCM / GCM extras carried by a notification-tap intent. Once Capacitor's
     * push plugin has dispatched the JS event for these, we strip them so a
     * subsequent activity recreation (config change, crash recovery, OS-driven
     * restart) cannot re-fire the same "pushNotificationActionPerformed" over
     * and over — that replay loop is the crash-on-restart users reported.
     */
    private static final Set<String> FCM_EXTRA_PREFIXES = new HashSet<>(Arrays.asList(
        "google.", "gcm.", "firebase."
    ));
    private static final Set<String> FCM_EXTRA_KEYS = new HashSet<>(Arrays.asList(
        "from", "collapse_key", "message_type"
    ));

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Neuter service workers inside the Capacitor WebView before the bridge
        // starts. Earlier builds of the app registered a PWA service worker
        // whose `notificationclick` handler called `clients.openWindow()` — in
        // Android's WebView that dispatches an external ACTION_VIEW intent,
        // yanking the user into Chrome and leaving the shell in a crash loop.
        // Returning an empty response for every SW-originated fetch keeps any
        // lingering worker from downloading scripts or running handlers.
        // The native app never relies on service workers (VitePWA is disabled
        // in `build:web:native`), so this is safe to apply unconditionally.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
                    @Override
                    public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                        return new WebResourceResponse(
                            "text/plain",
                            "utf-8",
                            new ByteArrayInputStream(new byte[0])
                        );
                    }
                });
            } catch (Throwable ignored) {
                // If the platform WebView doesn't expose ServiceWorkerController,
                // fall through — the JS-side cleanup in main.tsx is still in place.
            }
        }

        super.onCreate(savedInstanceState);

        // Capacitor's push plugin reads the FCM extras during bridge init above;
        // now that it has, drop them from the launch intent so we don't replay
        // the same tap on a crash restart.
        consumeFcmNotificationExtras(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        consumeFcmNotificationExtras(intent);
    }

    private static void consumeFcmNotificationExtras(Intent intent) {
        if (intent == null) return;
        Bundle extras = intent.getExtras();
        if (extras == null || extras.isEmpty()) return;
        if (!extras.containsKey("google.message_id")) return;
        for (String key : new ArrayList<>(extras.keySet())) {
            if (FCM_EXTRA_KEYS.contains(key)) {
                intent.removeExtra(key);
                continue;
            }
            for (String prefix : FCM_EXTRA_PREFIXES) {
                if (key.startsWith(prefix)) {
                    intent.removeExtra(key);
                    break;
                }
            }
        }
    }
}
