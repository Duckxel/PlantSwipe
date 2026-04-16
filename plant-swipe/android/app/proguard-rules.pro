# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Preserve source file + line numbers so Crashlytics/Sentry stack traces resolve.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# --- Capacitor + Cordova plugins ---
# Plugins are discovered by reflection; strip nothing in those packages.
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-keep class org.apache.cordova.** { *; }

# Any subclass of the Capacitor Plugin base must survive reflective lookup.
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.CapacitorPlugin <methods>;
    @com.getcapacitor.PluginMethod <methods>;
}
-keep public class * extends com.getcapacitor.Plugin

# JS bridge: WebView -> Java entry points must keep their @JavascriptInterface.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- AndroidX / support ---
-keep class androidx.appcompat.widget.** { *; }
-dontwarn androidx.**

# --- Kotlin metadata (if any plugin ships Kotlin) ---
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**

# --- Third-party SDKs pulled in transitively by plugins ---
# Firebase (push notifications)
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
# GSON / Jackson style reflection in plugin configs
-keepattributes Signature
-keepattributes *Annotation*

# Strip Log.v/d calls in release for a small size + perf win.
-assumenosideeffects class android.util.Log {
    public static *** v(...);
    public static *** d(...);
}
