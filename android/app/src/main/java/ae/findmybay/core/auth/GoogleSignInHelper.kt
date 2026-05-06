package ae.findmybay.core.auth

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException

/**
 * Thin wrapper around the legacy GoogleSignInClient. The newer Credential
 * Manager API is the future, but for MVP this is simpler and well-trodden.
 *
 * Usage from a Composable:
 *   1. Build the client with [build] using the Web OAuth client ID.
 *   2. Get the sign-in Intent via [client.signInIntent] and launch it via
 *      ActivityResultLauncher (StartActivityForResult contract).
 *   3. On result, call [extractIdToken] to pull the ID token from the result
 *      data, then hand it to AuthRepository.signInWithGoogle().
 *
 * Result.failure carries a human-readable message when sign-in failed (user
 * cancelled, no internet, sign-in disabled, etc.).
 */
object GoogleSignInHelper {

    private const val TAG = "FmbGoogleSignIn"

    /**
     * Build a sign-in client. [serverClientId] must be the **Web** OAuth
     * client ID auto-created by Firebase when you registered the Android
     * app — it's what the backend verifies the ID token against.
     */
    fun build(context: Context, serverClientId: String): GoogleSignInClient {
        val opts = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(serverClientId)
            .requestEmail()
            .build()
        return GoogleSignIn.getClient(context, opts)
    }

    /**
     * Pull the ID token out of the [Activity.RESULT_OK] data returned by
     * GoogleSignInClient.signInIntent. Returns Failure with a friendly
     * message if anything went wrong.
     */
    fun extractIdToken(data: Intent?): Result<String> {
        if (data == null) return Result.failure(Exception("Sign-in cancelled"))
        return try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            val account: GoogleSignInAccount = task.getResult(ApiException::class.java)
                ?: return Result.failure(Exception("No Google account returned"))
            val idToken = account.idToken
                ?: return Result.failure(
                    Exception(
                        "Google didn't return an ID token. Check that GOOGLE_OAUTH_CLIENT_ID " +
                            "in local.properties matches the Web OAuth client in Firebase.",
                    ),
                )
            Result.success(idToken)
        } catch (e: ApiException) {
            Log.w(TAG, "GoogleSignIn ApiException code=${e.statusCode}", e)
            Result.failure(Exception(humanReadable(e)))
        }
    }

    private fun humanReadable(e: ApiException): String = when (e.statusCode) {
        12501 -> "Sign-in cancelled"
        7, 8 -> "Network error — check your connection"
        10 -> "Sign-in misconfigured (check the Web OAuth client ID and the Android SHA-1 in Firebase)"
        else -> "Google sign-in failed (code ${e.statusCode})"
    }
}
