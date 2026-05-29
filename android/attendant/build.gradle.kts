import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Read API_BASE_URL from gradle.properties / local.properties (same convention
// as the customer :app module).
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
    namespace = "ae.findmybay.attendant"
    compileSdk = 34

    defaultConfig {
        applicationId = "ae.findmybay.attendant"
        minSdk = 28
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
        vectorDrawables.useSupportLibrary = true

        // Attendant talks to the same backend as the vendor admin + customer app.
        buildConfigField(
            "String", "API_BASE_URL",
            "\"${prop("API_BASE_URL", "https://fmb-backend.bravegrass-00d218a4.uaenorth.azurecontainerapps.io/")}\"",
        )
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            resValue("string", "app_name", "FMB Attendant Dev")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            resValue("string", "app_name", "FMB Attendant")
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

    // Networking
    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)

    // Coroutines
    implementation(libs.kotlinx.coroutines.android)

    // Token storage
    implementation(libs.androidx.datastore.preferences)
}
