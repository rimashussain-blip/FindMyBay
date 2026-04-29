package ae.findmybay.feature.payment

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBackIos
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import ae.findmybay.core.components.FmbPrimaryButton
import ae.findmybay.core.theme.FmbAqua
import ae.findmybay.core.theme.FmbBlue100
import ae.findmybay.core.theme.FmbBlue500
import ae.findmybay.core.theme.FmbBlue700
import ae.findmybay.core.theme.FmbBlue900
import ae.findmybay.core.theme.FmbCream
import ae.findmybay.core.theme.FmbMint
import ae.findmybay.core.theme.FmbMintEdge
import ae.findmybay.core.theme.FmbNeutral500
import ae.findmybay.core.theme.FmbNeutral700
import ae.findmybay.core.theme.FmbSand
import ae.findmybay.core.theme.primaryCtaGradient
import ae.findmybay.domain.model.Booking
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

// Visual-only payment method options. The actual /bookings/:id/pay call is the
// same regardless of which row is selected — saved cards, Google Pay tokenization,
// and "add new card" all need real backend support before they branch differently.
private enum class PaymentMethod { SAVED_CARD, GOOGLE_PAY, NEW_CARD }

@Composable
fun ReviewPayScreen(
    onBack: () -> Unit,
    onPaid: (bookingId: String) -> Unit,
    vm: ReviewPayViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val ctx = LocalContext.current
    var selected by remember { mutableStateOf(PaymentMethod.SAVED_CARD) }

    LaunchedEffect(state.confirmed) {
        if (state.confirmed) onPaid(vm.bookingId)
    }

    Scaffold(
        containerColor = FmbCream,
        bottomBar = {
            PayBar(
                amountAed = state.booking?.totalAed ?: 0,
                disabled = state.booking == null || state.launching || state.polling || state.confirmed,
                inFlight = state.launching || state.polling,
                onClick = { vm.pay(ctx) },
            )
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when {
                state.loading -> CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                state.error != null -> Text(
                    state.error!!,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                )
                state.booking != null -> CheckoutContent(
                    booking = state.booking!!,
                    failureReason = state.failureReason,
                    selected = selected,
                    onSelect = { selected = it },
                    onCancel = onBack,
                )
            }
        }
    }
}

// ────────────────────────────────────────────────────────────────────────
// Top bar (Cancel · Checkout · ✓)
// ────────────────────────────────────────────────────────────────────────

@Composable
private fun TopBar(onCancel: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Cancel — chevron + label
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(20.dp))
                .clickable(onClick = onCancel)
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Filled.ArrowBackIos,
                contentDescription = "Cancel",
                tint = FmbBlue700,
                modifier = Modifier.size(14.dp),
            )
            Spacer(Modifier.width(2.dp))
            Text("Cancel", color = FmbBlue700, fontSize = 14.sp, fontWeight = FontWeight.Medium)
        }

        Spacer(Modifier.weight(1f))

        Text(
            "Checkout",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = (-0.2).sp,
            color = FmbBlue900,
        )

        Spacer(Modifier.weight(1f))

        // Decorative completion check on the right (mirrors mockup chrome).
        Box(
            modifier = Modifier
                .size(24.dp)
                .clip(CircleShape)
                .background(FmbMint)
                .border(1.dp, FmbMintEdge, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.Check,
                contentDescription = null,
                tint = FmbBlue500,
                modifier = Modifier.size(14.dp),
            )
        }
    }
}

// ────────────────────────────────────────────────────────────────────────
// Body
// ────────────────────────────────────────────────────────────────────────

@Composable
private fun CheckoutContent(
    booking: Booking,
    failureReason: String?,
    selected: PaymentMethod,
    onSelect: (PaymentMethod) -> Unit,
    onCancel: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        TopBar(onCancel = onCancel)
        Spacer(Modifier.height(4.dp))
        VendorSummaryCard(booking)
        Spacer(Modifier.height(20.dp))
        TotalBlock(amountAed = booking.totalAed)
        Spacer(Modifier.height(20.dp))
        SectionEyebrow("PAY WITH", modifier = Modifier.padding(start = 22.dp))
        Spacer(Modifier.height(10.dp))
        PaymentMethodList(selected = selected, onSelect = onSelect)
        Spacer(Modifier.height(14.dp))
        LoyaltyBanner()
        if (failureReason != null) {
            Spacer(Modifier.height(12.dp))
            FailureCallout(failureReason)
        }
        Spacer(Modifier.height(16.dp))
        TrustLine()
        Spacer(Modifier.height(8.dp))
    }
}

// ────────────────────────────────────────────────────────────────────────
// Vendor summary card with HOLD pill
// ────────────────────────────────────────────────────────────────────────

@Composable
private fun VendorSummaryCard(b: Booking) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, FmbMintEdge, RoundedCornerShape(16.dp))
            .padding(horizontal = 12.dp, vertical = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(primaryCtaGradient()),
                contentAlignment = Alignment.Center,
            ) {
                Text("🚿", fontSize = 18.sp)
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    b.vendor.brandName,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = FmbBlue900,
                )
                Text(
                    "${b.service.name} · ${b.bay.name} · ${formatRelative(b.slotStart)}",
                    fontSize = 11.sp,
                    color = FmbNeutral700,
                )
            }
            HoldPill()
        }
    }
}

@Composable
private fun HoldPill() {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(FmbSand)
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        // 5-minute label is the visible reassurance; the actual server-side hold
        // is 15 minutes (see backend createBooking).
        Text(
            "HOLD 5M",
            fontSize = 10.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 1.sp,
            color = FmbBlue900,
        )
    }
}

// ────────────────────────────────────────────────────────────────────────
// Total block
// ────────────────────────────────────────────────────────────────────────

@Composable
private fun TotalBlock(amountAed: Int) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "TOTAL",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.6.sp,
            color = FmbNeutral500,
        )
        Spacer(Modifier.height(2.dp))
        // "AED 40.00" — AED + integer tower + smaller cents.
        Row(verticalAlignment = Alignment.Top) {
            Text(
                "AED ",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = FmbBlue900,
                modifier = Modifier.padding(top = 14.dp),
            )
            Text(
                amountAed.toString(),
                fontSize = 56.sp,
                fontWeight = FontWeight.ExtraBold,
                color = FmbBlue900,
                letterSpacing = (-1.2).sp,
            )
            Text(
                ".00",
                fontSize = 22.sp,
                fontWeight = FontWeight.SemiBold,
                color = FmbBlue900.copy(alpha = 0.55f),
                modifier = Modifier.padding(top = 16.dp),
            )
        }
        Spacer(Modifier.height(2.dp))
        Text(
            "Includes 5% VAT · Refundable up to 30 min before",
            fontSize = 11.sp,
            color = FmbNeutral700,
        )
    }
}

// ────────────────────────────────────────────────────────────────────────
// Payment method list
// ────────────────────────────────────────────────────────────────────────

@Composable
private fun PaymentMethodList(selected: PaymentMethod, onSelect: (PaymentMethod) -> Unit) {
    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
        SavedCardRow(
            selected = selected == PaymentMethod.SAVED_CARD,
            onClick = { onSelect(PaymentMethod.SAVED_CARD) },
        )
        Spacer(Modifier.height(10.dp))
        GooglePayRow(
            selected = selected == PaymentMethod.GOOGLE_PAY,
            onClick = { onSelect(PaymentMethod.GOOGLE_PAY) },
        )
        Spacer(Modifier.height(10.dp))
        AddNewCardRow(onClick = { onSelect(PaymentMethod.NEW_CARD) })
    }
}

@Composable
private fun SavedCardRow(selected: Boolean, onClick: () -> Unit) {
    MethodRow(selected = selected, onClick = onClick) {
        VisaBadge()
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text("Visa · 4242", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = FmbBlue900)
            Text("Expires 08/28 · Default", fontSize = 11.sp, color = FmbNeutral700)
        }
        SelectionDot(selected = selected)
    }
}

@Composable
private fun GooglePayRow(selected: Boolean, onClick: () -> Unit) {
    MethodRow(selected = selected, onClick = onClick) {
        GooglePayBadge()
        Spacer(Modifier.width(12.dp))
        Text(
            "Google Pay",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = FmbBlue900,
            modifier = Modifier.weight(1f),
        )
        SelectionDot(selected = selected)
    }
}

@Composable
private fun MethodRow(
    selected: Boolean,
    onClick: () -> Unit,
    content: @Composable RowScope.() -> Unit,
) {
    val borderColor = if (selected) FmbBlue500 else FmbMintEdge
    val borderWidth = if (selected) 2.dp else 1.dp
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(borderWidth, borderColor, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        content()
    }
}

@Composable
private fun SelectionDot(selected: Boolean) {
    Box(
        modifier = Modifier
            .size(20.dp)
            .clip(CircleShape)
            .background(if (selected) FmbBlue500 else MaterialTheme.colorScheme.surface)
            .border(
                width = if (selected) 0.dp else 1.5.dp,
                color = if (selected) Color.Transparent else FmbMintEdge,
                shape = CircleShape,
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (selected) {
            Icon(
                Icons.Filled.Check,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(12.dp),
            )
        }
    }
}

@Composable
private fun AddNewCardRow(onClick: () -> Unit) {
    // Dashed-look outlined tile. Compose has no first-class dashed border; we
    // approximate with a subtle color + label.
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(1.5.dp, FmbMintEdge, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Icon(
            Icons.Filled.Add,
            contentDescription = null,
            tint = FmbBlue700,
            modifier = Modifier.size(16.dp),
        )
        Spacer(Modifier.width(6.dp))
        Text("Add new card", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = FmbBlue700)
    }
}

// ── Brand badges ────────────────────────────────────────────────────────

@Composable
private fun VisaBadge() {
    Box(
        modifier = Modifier
            .size(width = 40.dp, height = 28.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(Color(0xFF1A1F71)), // Visa navy
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "VISA",
            color = Color.White,
            fontSize = 10.sp,
            fontWeight = FontWeight.ExtraBold,
            fontStyle = FontStyle.Italic,
            letterSpacing = 0.6.sp,
        )
    }
}

@Composable
private fun GooglePayBadge() {
    // Approximation of the standard Google Pay acceptance mark (white pill +
    // multi-color G + dark "Pay"). The licensed official asset should replace
    // this when shipping — either drop g_pay.png into res/drawable/ and swap
    // for an Image, or pull in com.google.android.gms:play-services-pay and
    // use the official PayButton composable.
    Box(
        modifier = Modifier
            .size(width = 56.dp, height = 28.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(14.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // The Google G logomark is a multi-color glyph that can't be coloured
            // per-quadrant with a single Text run; we use brand blue as a close
            // single-color stand-in.
            Text(
                "G",
                color = Color(0xFF4285F4),
                fontSize = 14.sp,
                fontWeight = FontWeight.ExtraBold,
            )
            Spacer(Modifier.width(2.dp))
            Text(
                "Pay",
                color = Color(0xFF3C4043),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

// ────────────────────────────────────────────────────────────────────────
// Loyalty + trust + footer
// ────────────────────────────────────────────────────────────────────────

@Composable
private fun LoyaltyBanner() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(FmbSand.copy(alpha = 0.6f))
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(28.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surface),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.Star,
                contentDescription = null,
                tint = FmbBlue900,
                modifier = Modifier.size(14.dp),
            )
        }
        Spacer(Modifier.width(10.dp))
        Text(
            buildAnnotatedString {
                pushStyle(SpanStyle(fontWeight = FontWeight.Bold))
                append("2 stars away")
                pop()
                append(" from a free Standard Wash")
            },
            fontSize = 12.sp,
            color = FmbBlue900,
            modifier = Modifier.weight(1f),
            lineHeight = 16.sp,
        )
        // Loyalty isn't shipped yet — the link is decorative for now.
        Text(
            "Apply",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = FmbBlue700,
        )
    }
}

@Composable
private fun TrustLine() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Icon(
            Icons.Filled.Lock,
            contentDescription = null,
            tint = FmbNeutral500,
            modifier = Modifier.size(12.dp),
        )
        Spacer(Modifier.width(6.dp))
        Text(
            "Secured payment · 256-bit TLS",
            fontSize = 11.sp,
            color = FmbNeutral500,
        )
    }
}

@Composable
private fun FailureCallout(reason: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.errorContainer)
            .padding(12.dp),
    ) {
        Text(
            reason,
            color = MaterialTheme.colorScheme.onErrorContainer,
            fontSize = 12.sp,
        )
    }
}

@Composable
private fun SectionEyebrow(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        modifier = modifier,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.4.sp,
        color = FmbNeutral500,
    )
}

// ────────────────────────────────────────────────────────────────────────
// Bottom Pay bar (gradient CTA + footer line)
// ────────────────────────────────────────────────────────────────────────

@Composable
private fun PayBar(
    amountAed: Int,
    disabled: Boolean,
    inFlight: Boolean,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(FmbCream)
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        FmbPrimaryButton(
            text = if (inFlight) "Processing…" else "Pay AED ${amountAed}.00",
            onClick = onClick,
            enabled = !disabled,
            loading = inFlight,
            height = 54.dp,
            cornerRadius = 16.dp,
            leadingIcon = if (!inFlight) {
                {
                    Icon(
                        Icons.Filled.CreditCard,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(18.dp),
                    )
                }
            } else null,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            buildAnnotatedString {
                append("By continuing you agree to the ")
                pushStyle(SpanStyle(color = FmbBlue700, fontWeight = FontWeight.SemiBold))
                append("Terms")
                pop()
                append(" & ")
                pushStyle(SpanStyle(color = FmbBlue700, fontWeight = FontWeight.SemiBold))
                append("Refund policy")
                pop()
            },
            fontSize = 10.sp,
            color = FmbNeutral500,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

private val TIME_FMT = DateTimeFormatter.ofPattern("HH:mm")
private val DAY_FMT = DateTimeFormatter.ofPattern("EEE d MMM")

/** "Today 10:00", "Tomorrow 14:30", or "Wed 30 Apr 09:00". */
private fun formatRelative(iso: String): String = runCatching {
    val zdt = OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.systemDefault())
    val today = LocalDate.now()
    val date = zdt.toLocalDate()
    val time = zdt.format(TIME_FMT)
    when (date) {
        today -> "Today $time"
        today.plusDays(1) -> "Tomorrow $time"
        else -> "${zdt.format(DAY_FMT)} $time"
    }
}.getOrDefault(iso)
