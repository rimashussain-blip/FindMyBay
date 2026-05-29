package ae.findmybay.attendant.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner

/**
 * Invokes [onResume] every time the screen returns to the foreground — e.g.
 * popping back from the walk-in flow, the scanner, or a booking detail — so the
 * list reflects whatever changed while it was away. The very first resume
 * (right after the ViewModel's own init-load) is skipped to avoid a redundant
 * double fetch.
 */
@Composable
fun RefreshOnResume(onResume: () -> Unit) {
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner) {
        var first = true
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                if (first) first = false else onResume()
            }
        }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
}
