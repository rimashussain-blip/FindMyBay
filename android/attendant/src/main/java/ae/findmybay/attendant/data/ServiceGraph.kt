package ae.findmybay.attendant.data

import android.content.Context

/**
 * Tiny manual DI container. The attendant app is small enough that Hilt would
 * be more ceremony than value — a single process-wide graph initialised from
 * the Application context covers it. Swap for Hilt if the app grows.
 */
object ServiceGraph {
    @Volatile private var initialised = false

    lateinit var tokenStore: TokenStore
        private set
    lateinit var repository: AttendantRepository
        private set

    fun init(appContext: Context) {
        if (initialised) return
        synchronized(this) {
            if (initialised) return
            tokenStore = TokenStore(appContext.applicationContext)
            // The api is rebuilt lazily so the auth interceptor always reads the
            // latest token (e.g. right after login).
            repository = AttendantRepository(
                tokenStore = tokenStore,
                apiProvider = { Network.buildApi(tokenStore) },
            )
            initialised = true
        }
    }
}
