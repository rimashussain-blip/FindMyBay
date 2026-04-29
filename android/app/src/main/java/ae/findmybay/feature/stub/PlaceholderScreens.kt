package ae.findmybay.feature.stub

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * Placeholder screens for tab destinations not yet built.
 * Uses Material 3 surface tints + the brand mint container.
 */
@Composable
fun LoyaltyScreen() = Placeholder(
    icon = Icons.Filled.CardGiftcard,
    title = "Loyalty",
    body = "Track your stamps, see rewards you've unlocked, and redeem one free wash every five visits.",
)

@Composable
private fun Placeholder(icon: ImageVector, title: String, body: String) {
    val cs = MaterialTheme.colorScheme
    Scaffold(containerColor = cs.background) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(cs.primaryContainer),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        icon,
                        contentDescription = null,
                        modifier = Modifier.size(40.dp),
                        tint = cs.onPrimaryContainer,
                    )
                }
                Spacer(Modifier.height(20.dp))
                Text(
                    title,
                    style = MaterialTheme.typography.headlineMedium,
                    color = cs.onBackground,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    body,
                    style = MaterialTheme.typography.bodyMedium,
                    color = cs.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(24.dp))
                Text(
                    "Coming soon",
                    style = MaterialTheme.typography.labelLarge,
                    color = cs.primary,
                )
            }
        }
    }
}
