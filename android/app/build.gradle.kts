import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
    alias(libs.plugins.gms.google.services)
}

// Read MAPS_API_KEY and API_BASE_URL from gradle.properties / local.properties
val gradleProps = Properties().apply {
    val f = rootProject.file("gradle.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun prop(name: String, default: String): String =
    (localProps.getProperty(name) ?: gradleProps.getProperty(name) ?: default)

android {
    namespace = "ae.findmybay"
    compileSdk = 34

    defaultConfig {
        applicationId = "ae.findmybay"
        minSdk = 28
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Maps key surfaces to AndroidManifest via ${MAPS_API_KEY}
        manifestPlaceholders["MAPS_API_KEY"] = prop("MAPS_API_KEY", "")

        // API base URL exposed as BuildConfig.API_BASE_URL
        buildConfigField("String", "API_BASE_URL", "\"${prop("API_BASE_URL", "https://api.findmybay.ae/")}\"")

        // We set vectorDrawables.useSupportLibrary explicitly so older OEMs render correctly.
        vectorDrawables.useSupportLibrary = true
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    // Compose
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    debugImplementation(libs.androidx.compose.ui.tooling)

    // Activity / Lifecycle / Navigation
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    // WorkManager + Hilt-Work — used for the alert safety-net job that fires
    // a local notification at slot_start - 5min if FCM never delivered the
    // smart-leave alert (UAE OEMs aggressively kill FCM).
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.hilt.work)
    ksp(libs.hilt.androidx.compiler)

    // Networking
    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)

    // Coroutines
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.play.services)

    // DataStore (token storage)
    implementation(libs.androidx.datastore.preferences)

    // Maps & Location
    implementation(libs.play.services.maps)
    implementation(libs.play.services.location)
    implementation(libs.maps.compose)

    // Permissions helper
    implementation(libs.accompanist.permissions)

    // Image loading
    implementation(libs.coil.compose)

    // Material XML theme parent (Theme.Material3.DayNight.NoActionBar)
    // Compose's material3 is Compose-only; XML themes need this separate lib.
    implementation(libs.material)

    // ZXing core — generates QR matrices from strings (we render to Bitmap ourselves).
    implementation(libs.zxing.core)

    // Socket.io client for realtime booking-status updates.
    implementation(libs.socketio.client)

    // Chrome Custom Tabs — opens the payment hosted page without leaving the app.
    implementation(libs.androidx.browser)

    // Firebase (push) — wire up after google-services.json is added
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)

    // Tests
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
