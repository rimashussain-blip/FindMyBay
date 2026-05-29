package ae.findmybay.attendant.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "fmb-attendant-auth")

/**
 * Persists the access + refresh tokens for the signed-in vendor staff member.
 * DataStore-backed; survives process death. 90-day refresh TTL on the server,
 * so attendants sign in once during onboarding.
 */
class TokenStore(private val context: Context) {
    private val accessKey = stringPreferencesKey("access_token")
    private val refreshKey = stringPreferencesKey("refresh_token")
    private val roleKey = stringPreferencesKey("role")
    private val brandKey = stringPreferencesKey("brand_name")

    suspend fun accessToken(): String? =
        context.dataStore.data.map { it[accessKey] }.first()

    suspend fun refreshToken(): String? =
        context.dataStore.data.map { it[refreshKey] }.first()

    suspend fun save(access: String, refresh: String, role: String) {
        context.dataStore.edit {
            it[accessKey] = access
            it[refreshKey] = refresh
            it[roleKey] = role
        }
    }

    /** Persist a rotated access + refresh pair after a silent token refresh. */
    suspend fun updateTokens(access: String, refresh: String) {
        context.dataStore.edit {
            it[accessKey] = access
            it[refreshKey] = refresh
        }
    }

    suspend fun saveBrand(brand: String) {
        context.dataStore.edit { it[brandKey] = brand }
    }

    suspend fun brandName(): String? =
        context.dataStore.data.map { it[brandKey] }.first()

    suspend fun isSignedIn(): Boolean = accessToken() != null

    suspend fun clear() {
        context.dataStore.edit { it.clear() }
    }
}
