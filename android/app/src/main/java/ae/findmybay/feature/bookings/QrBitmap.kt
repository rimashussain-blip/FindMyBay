package ae.findmybay.feature.bookings

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import java.io.OutputStream

/**
 * Renders the branded QR card (white background, rounded "pixels", center
 * water-drop logo, booking-code label) into a Bitmap suitable for sharing or
 * saving to the gallery.
 *
 * The on-screen Compose version uses Compose Canvas; this is the AWT-style
 * mirror so we can produce a real Bitmap without needing a captured view.
 */
fun buildBrandedQrBitmap(
    qrString: String,
    shortCode: String,
    sizePx: Int = 1024,
): Bitmap {
    val bitmap = Bitmap.createBitmap(sizePx, sizePx + 160, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    // White background
    canvas.drawColor(Color.WHITE)

    // Module matrix
    val matrix = QRCodeWriter().encode(
        qrString,
        BarcodeFormat.QR_CODE,
        37, 37,
        mapOf(
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.H,
            EncodeHintType.MARGIN to 0,
        ),
    )

    val pad = sizePx * 0.06f
    val drawSize = sizePx - 2 * pad
    val cell = drawSize / matrix.width
    val r = cell * 0.32f
    val cx = sizePx / 2f
    val cy = sizePx / 2f
    val logoRadius = sizePx * 0.10f

    val modulePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#0B3B36") }

    for (x in 0 until matrix.width) {
        for (y in 0 until matrix.height) {
            if (!matrix[x, y]) continue
            val px = pad + x * cell + cell / 2
            val py = pad + y * cell + cell / 2
            val dx = px - cx
            val dy = py - cy
            if (dx * dx + dy * dy < (logoRadius * 0.95f) * (logoRadius * 0.95f)) continue
            val left = pad + x * cell + cell * 0.12f
            val top = pad + y * cell + cell * 0.12f
            val right = pad + (x + 1) * cell - cell * 0.12f
            val bottom = pad + (y + 1) * cell - cell * 0.12f
            canvas.drawRoundRect(RectF(left, top, right, bottom), r, r, modulePaint)
        }
    }

    // Logo: white halo + teal disc + white drop
    val haloPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    val tealPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#14B8A6") }
    canvas.drawCircle(cx, cy, logoRadius * 1.15f, haloPaint)
    canvas.drawCircle(cx, cy, logoRadius, tealPaint)

    val w = logoRadius
    val h = logoRadius * 1.1f
    val drop = Path().apply {
        moveTo(cx - w * 0.5f + w / 2, cy - h * 0.55f + 0f)
        cubicTo(
            cx - w * 0.5f + w / 2, cy - h * 0.55f + 0f,
            cx - w * 0.5f + w * 0.05f, cy - h * 0.55f + h * 0.45f,
            cx - w * 0.5f + w * 0.05f, cy - h * 0.55f + h * 0.65f,
        )
        cubicTo(
            cx - w * 0.5f + w * 0.05f, cy - h * 0.55f + h * 0.85f,
            cx - w * 0.5f + w * 0.30f, cy - h * 0.55f + h,
            cx - w * 0.5f + w / 2, cy - h * 0.55f + h,
        )
        cubicTo(
            cx - w * 0.5f + w * 0.70f, cy - h * 0.55f + h,
            cx - w * 0.5f + w * 0.95f, cy - h * 0.55f + h * 0.85f,
            cx - w * 0.5f + w * 0.95f, cy - h * 0.55f + h * 0.65f,
        )
        cubicTo(
            cx - w * 0.5f + w * 0.95f, cy - h * 0.55f + h * 0.45f,
            cx - w * 0.5f + w / 2, cy - h * 0.55f + 0f,
            cx - w * 0.5f + w / 2, cy - h * 0.55f + 0f,
        )
        close()
    }
    canvas.drawPath(drop, haloPaint)

    // Booking-code label below the QR
    val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#3F6B65")
        textAlign = Paint.Align.CENTER
        textSize = sizePx * 0.024f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        letterSpacing = 0.15f
    }
    val codePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor("#0B3B36")
        textAlign = Paint.Align.CENTER
        textSize = sizePx * 0.044f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        letterSpacing = 0.25f
    }
    canvas.drawText("BOOKING CODE", cx, sizePx + 50f, labelPaint)
    canvas.drawText("FMB-$shortCode", cx, sizePx + 110f, codePaint)

    return bitmap
}

/**
 * Writes the bitmap to the device gallery under Pictures/FindMyBay.
 * Returns the inserted Uri or null on failure.
 */
fun saveQrBitmapToGallery(context: Context, bitmap: Bitmap, displayName: String): Uri? {
    val resolver = context.contentResolver
    val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
    } else {
        MediaStore.Images.Media.EXTERNAL_CONTENT_URI
    }
    val values = ContentValues().apply {
        put(MediaStore.Images.Media.DISPLAY_NAME, "$displayName.png")
        put(MediaStore.Images.Media.MIME_TYPE, "image/png")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/FindMyBay")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
    }
    val uri = resolver.insert(collection, values) ?: return null
    try {
        resolver.openOutputStream(uri).use { os: OutputStream? ->
            os ?: return null
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, os)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val pendingClear = ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }
            resolver.update(uri, pendingClear, null, null)
        }
        return uri
    } catch (t: Throwable) {
        runCatching { resolver.delete(uri, null, null) }
        return null
    }
}
