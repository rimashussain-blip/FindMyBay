# Attendant app keep rules. Retrofit + OkHttp ship their own consumer rules;
# the entries below cover kotlinx.serialization models and the realtime / QR
# libraries so a minified release build keeps working.

# ── kotlinx.serialization ────────────────────────────────────────────────
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class ae.findmybay.attendant.data.** {
    *** Companion;
}
-keepclasseswithmembers class ae.findmybay.attendant.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class ae.findmybay.attendant.data.**$$serializer { *; }

# ── Socket.IO / Engine.IO realtime client ────────────────────────────────
-keep class io.socket.** { *; }
-dontwarn io.socket.**

# ── zxing QR decoder ─────────────────────────────────────────────────────
-keep class com.google.zxing.** { *; }
-dontwarn com.google.zxing.**
