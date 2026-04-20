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
        // The distributed APK is built by CI without a `google-services.json`
        // (the file is gitignored and no CI secret materialises it).  That means
        // `FirebaseInitProvider` never finishes wiring up a default
        // `FirebaseApp`, so the first call to `FirebaseMessaging.getInstance()`
        // — which Capacitor's push plugin makes from `register()` as soon as the
        // user grants POST_NOTIFICATIONS — throws `IllegalStateException` on
        // the UI thread and the OS force-closes the app.  From then on every
        // launch retries the registration (permission is already granted) and
        // crashes the same way, producing the reported "accept notifications →
        // crash loop on every open" behaviour.
        //
        // We can't ship a real Firebase config without a Firebase project +
        // CI secret, so instead we prime a *stub* default FirebaseApp with
        // harmless placeholder credentials.  That keeps `getInstance()` from
        // throwing; the subsequent `getToken()` still fails — but *asynchronously*
        // inside FCM, which the Capacitor plugin surfaces as a benign
        // `registrationError` event on the JS side.  The app stays up; push
        // delivery simply doesn't work until a real `google-services.json` is
        // wired in.  Permission grant no longer kills the app.
        ensureFirebaseAppInitialized();

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

    /**
     * If the Google Services Gradle plugin didn't run (no `google-services.json`
     * at build time), the `google_app_id` string resource is absent and
     * `FirebaseInitProvider` silently skips initialisation.  We then register
     * a stub default app so downstream code that calls
     * `FirebaseApp.getInstance()` / `FirebaseMessaging.getInstance()` doesn't
     * throw.  Done reflectively so this source still compiles in environments
     * where Firebase classes aren't on the compileOnly classpath.
     */
    private void ensureFirebaseAppInitialized() {
        try {
            Class<?> firebaseAppCls = Class.forName("com.google.firebase.FirebaseApp");
            // FirebaseApp.getApps(Context) returns any already-initialised apps.
            Object apps = firebaseAppCls
                .getMethod("getApps", android.content.Context.class)
                .invoke(null, getApplicationContext());
            if (apps instanceof java.util.List && !((java.util.List<?>) apps).isEmpty()) {
                return;
            }

            // Platform already wired Firebase up via the Gradle plugin? Nothing to do.
            int googleAppIdRes = getResources()
                .getIdentifier("google_app_id", "string", getPackageName());
            if (googleAppIdRes != 0) {
                // Resource exists — let FirebaseInitProvider handle it.
                return;
            }

            Class<?> optionsCls = Class.forName("com.google.firebase.FirebaseOptions");
            Class<?> builderCls = Class.forName("com.google.firebase.FirebaseOptions$Builder");
            Object builder = builderCls.getConstructor().newInstance();
            // These values are deliberately placeholders — FCM token retrieval
            // will fail, but `FirebaseApp.getInstance()` and
            // `FirebaseMessaging.getInstance()` will no longer throw, so the
            // Capacitor push plugin can report the failure via its normal
            // `registrationError` channel instead of crashing the app.
            // Application ID format: 1:<sender>:android:<hash>.
            builder = builderCls.getMethod("setApplicationId", String.class)
                .invoke(builder, "1:000000000000:android:0000000000000000");
            builder = builderCls.getMethod("setApiKey", String.class)
                .invoke(builder, "AIzaSy_stub_key_do_not_use_for_real_requests");
            builder = builderCls.getMethod("setProjectId", String.class)
                .invoke(builder, "aphylia-stub-no-fcm");
            Object options = builderCls.getMethod("build").invoke(builder);

            firebaseAppCls
                .getMethod("initializeApp", android.content.Context.class, optionsCls)
                .invoke(null, getApplicationContext(), options);
        } catch (Throwable ignored) {
            // Firebase classes genuinely missing, or init failed for another
            // reason — nothing we can do here.  Push won't work but the app
            // will still launch, which is what matters.
        }
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
