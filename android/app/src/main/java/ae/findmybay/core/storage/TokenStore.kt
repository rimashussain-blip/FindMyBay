package ae.findmybay.core.storage

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore by preferencesDataStore("fmb_secure")

/**
 * Persists JWT access + refresh tokens. NOTE: DataStore is plaintext on disk.
 * Before launch, swap to EncryptedSharedPreferences or AndroidKeyStore-backed
 * encryption. For an MVP skeleton this is intentional and clearly marked.
 */
@Singleton
class TokenStore @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val accessKey = stringPreferencesKey("access_token")
    private val refreshKey = stringPreferencesKey("refresh_token")
    private val userIdKey = stringPreferencesKey("user_id")

    val accessTokenFlow: Flow<String?> =
        context.dataStore.data.map { it[accessKey] }

    val userIdFlow: Flow<String?> =
        context.dataStore.data.map { it[userIdKey] }

    suspend fun accessToken(): String? = accessTokenFlow.first()
    suspend fun userId(): String? = userIdFlow.first()

    suspend fun save(access: String, refresh: String, userId: String? = null) {
        context.dataStore.edit {
            it[accessKey] = access
            it[refreshKey] = refresh
            if (userId != null) it[userIdKey] = userId
        }
    }

    suspend fun clear() {
        context.dataStore.edit {
            it.remove(accessKey)
            it.remove(refreshKey)
            it.remove(userIdKey)
        }
    }
}
