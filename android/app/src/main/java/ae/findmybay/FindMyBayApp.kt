package ae.findmybay

import ae.findmybay.core.realtime.RealtimeClient
import ae.findmybay.core.storage.TokenStore
import ae.findmybay.data.repo.DeviceRepository
import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Implements [Configuration.Provider] so WorkManager picks up our
 * Hilt-built worker factory instead of using the default no-arg factory —
 * that's how AlertSafetyNetWorker gets its injected dependencies.
 *
 * The matching `<provider tools:node="remove">` lives in AndroidManifest.xml
 * to disable WorkManager's auto-initializer.
 */
@HiltAndroidApp
class FindMyBayApp : Application(), Configuration.Provider {

    @Inject lateinit var realtime: RealtimeClient
    @Inject lateinit var tokens: TokenStore
    @Inject lateinit var devices: DeviceRepository
    @Inject lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        // Boot the Socket.io client. It auto-resubscribes once a user is signed in.
        realtime.start()

        // If a session already exists from a previous run, re-register the
        // FCM token. This catches the case where onNewToken fired before the
        // user was ever signed in.
        scope.launch {
            if (tokens.accessToken() != null) {
                runCatching { devices.fetchAndRegister() }
            }
        }
    }
}
