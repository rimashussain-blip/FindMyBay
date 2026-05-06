package ae.findmybay.core.components

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

/**
 * Renders a vendor logo from either:
 *   - a `data:image/...;base64,...` URL (decoded inline; this is what our
 *     vendor-admin uploader produces)
 *   - an http(s) URL (Coil fetches it)
 *   - null/blank → a circular tile with the first letter of the brand name
 *
 * Coil 2.x doesn't natively understand `data:` URLs, so we handle that case
 * ourselves with BitmapFactory.
 */
@Composable
fun VendorLogo(
    logoUrl: String?,
    brandName: String,
    modifier: Modifier = Modifier,
    size: Dp = 48.dp,
    shape: Shape = CircleShape,
) {
    val trimmed = logoUrl?.trim().orEmpty()

    when {
        trimmed.startsWith("data:image") -> {
            // Decode the base64 portion once and remember the bitmap so we
            // don't redo it on every recomposition.
            val bitmap = remember(trimmed) { decodeDataUrl(trimmed) }
            if (bitmap != null) {
                Image(
                    painter = BitmapPainter(bitmap.asImageBitmap()),
                    contentDescription = "$brandName logo",
                    contentScale = ContentScale.Crop,
                    modifier = modifier
                        .size(size)
                        .clip(shape)
                        .background(MaterialTheme.colorScheme.surface),
                )
            } else {
                FallbackInitial(brandName = brandName, size = size, shape = shape, modifier = modifier)
            }
        }

        trimmed.startsWith("http") -> {
            AsyncImage(
                model = trimmed,
                contentDescription = "$brandName logo",
                contentScale = ContentScale.Crop,
                modifier = modifier
                    .size(size)
                    .clip(shape)
                    .background(MaterialTheme.colorScheme.surface),
            )
        }

        else -> FallbackInitial(brandName = brandName, size = size, shape = shape, modifier = modifier)
    }
}

@Composable
private fun FallbackInitial(
    brandName: String,
    size: Dp,
    shape: Shape,
    modifier: Modifier = Modifier,
) {
    val initial = brandName.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?"
    Box(
        modifier = modifier
            .size(size)
            .clip(shape)
            .background(MaterialTheme.colorScheme.primaryContainer),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = initial,
            color = MaterialTheme.colorScheme.onPrimaryContainer,
            // Scale font roughly with the tile size — looks balanced for 32–96 dp.
            fontSize = (size.value * 0.45f).sp,
            style = MaterialTheme.typography.titleLarge,
        )
    }
}

private fun decodeDataUrl(dataUrl: String): android.graphics.Bitmap? {
    return try {
        val commaIdx = dataUrl.indexOf(',')
        if (commaIdx < 0) return null
        val base64Body = dataUrl.substring(commaIdx + 1)
        val bytes = Base64.decode(base64Body, Base64.DEFAULT)
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    } catch (e: Exception) {
        null
    }
}
