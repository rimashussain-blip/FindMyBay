package ae.findmybay.feature.alert

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ae.findmybay.core.theme.FmbCoral
import ae.findmybay.core.theme.FmbSand
import ae.findmybay.core.theme.FmbSandDeep
import ae.findmybay.core.theme.amberCtaGradient
import ae.findmybay.core.theme.heroGradient

@Composable
fun LeaveNowScreen(
    vendorName: String,
    etaMin: Int,
    slotTime: String,
    onLeavingNow: () -> Unit,
    onSnooze: () -> Unit,
) {
    val ink = Color(0xFF0B3B36)
    val inkSoft = Color(0xFF3F6B65)
    val primaryDeep = Color(0xFF0F766E)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(heroGradient()),
    ) {
        // Soft halo glows
        Box(
            modifier = Modifier
                .padding(top = 50.dp)
                .padding(start = 0.dp)
                .size(200.dp)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        colors = listOf(FmbSandDeep.copy(alpha = 0.45f), Color.Transparent),
                    )
                ),
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 22.dp),
        ) {
            Spacer(Modifier.height(60.dp))

            // Top row — eyebrow + close button
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "SMART LEAVE ALERT",
                    color = Color.White.copy(alpha = 0.75f),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.5.sp,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.12f))
                        .clickable(onClick = onSnooze),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Filled.Close,
                        contentDescription = "Dismiss",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }

            Spacer(Modifier.height(26.dp))

            // Pulsing hero icon (centered)
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                PulsingHeroIcon()
            }

            Spacer(Modifier.height(22.dp))

            Text(
                text = "Leave now",
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.8).sp,
                color = Color.White,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(6.dp))

            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Row {
                    Text(
                        "Heading to ",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.85f),
                    )
                    Text(
                        vendorName,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = FmbSand,
                    )
                }
                Row {
                    Text(
                        "for your ",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.85f),
                    )
                    Text(
                        slotTime,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        color = Color.White.copy(alpha = 0.95f),
                    )
                    Text(
                        " wash",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.85f),
                    )
                }
            }

            Spacer(Modifier.height(26.dp))

            // Glass info card with two columns split by hairline
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(Color.White.copy(alpha = 0.95f))
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                EtaStat(
                    label = "Drive",
                    value = "$etaMin",
                    unit = "min",
                    bottomLabel = "+3 traffic",
                    bottomColor = FmbCoral,
                    valueColor = ink,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .height(48.dp)
                        .background(ink.copy(alpha = 0.08f)),
                )
                EtaStat(
                    label = "Slot",
                    value = slotTime,
                    unit = "",
                    bottomLabel = "Bay 1 · Tue",
                    bottomColor = inkSoft,
                    valueColor = primaryDeep,
                    modifier = Modifier.weight(1f),
                )
            }

            Spacer(Modifier.weight(1f))

            // ALL-CAPS sand-gradient CTA
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .clip(RoundedCornerShape(28.dp))
                    .background(amberCtaGradient())
                    .clickable(onClick = onLeavingNow),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "I'M LEAVING NOW",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = primaryDeep,
                    letterSpacing = 0.6.sp,
                )
            }

            Spacer(Modifier.height(8.dp))

            // Snooze ghost button
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .clip(RoundedCornerShape(22.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.35f), RoundedCornerShape(22.dp))
                    .clickable(onClick = onSnooze),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "Snooze 5 min",
                    style = MaterialTheme.typography.labelLarge,
                    color = Color.White,
                )
            }

            Spacer(Modifier.height(28.dp))
        }
    }
}

@Composable
private fun PulsingHeroIcon() {
    val transition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by transition.animateFloat(
        initialValue = 1f,
        targetValue = 1.15f,
        animationSpec = infiniteRepeatable<Float>(
            animation = tween<Float>(durationMillis = 2000),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulseScale",
    )
    val pulseAlpha by transition.animateFloat(
        initialValue = 0.55f,
        targetValue = 0.25f,
        animationSpec = infiniteRepeatable<Float>(
            animation = tween<Float>(durationMillis = 2000),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulseAlpha",
    )

    Box(modifier = Modifier.size(112.dp), contentAlignment = Alignment.Center) {
        Box(
            modifier = Modifier
                .size(112.dp)
                .scale(pulseScale)
                .clip(CircleShape)
                .background(FmbSandDeep.copy(alpha = pulseAlpha)),
        )
        Box(
            modifier = Modifier
                .size(80.dp)
                .clip(RoundedCornerShape(26.dp))
                .background(amberCtaGradient()),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.DirectionsCar,
                contentDescription = null,
                modifier = Modifier.size(40.dp),
                tint = Color(0xFF0F766E),
            )
        }
    }
}

@Composable
private fun EtaStat(
    label: String,
    value: String,
    unit: String,
    bottomLabel: String,
    bottomColor: Color,
    valueColor: Color,
    modifier: Modifier = Modifier,
) {
    val inkSoft = Color(0xFF3F6B65)
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Medium,
            color = inkSoft,
        )
        Spacer(Modifier.height(4.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                value,
                fontSize = 30.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.6).sp,
                color = valueColor,
            )
            if (unit.isNotEmpty()) {
                Spacer(Modifier.width(2.dp))
                Text(
                    unit,
                    style = MaterialTheme.typography.bodySmall,
                    color = inkSoft,
                    modifier = Modifier.padding(bottom = 6.dp),
                )
            }
        }
        Spacer(Modifier.height(2.dp))
        Text(
            bottomLabel,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            color = bottomColor,
        )
    }
}
