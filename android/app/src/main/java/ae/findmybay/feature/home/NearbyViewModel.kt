package ae.findmybay.feature.home

import android.annotation.SuppressLint
import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.data.repo.VendorRepository
import ae.findmybay.domain.model.Vendor
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class NearbyUiState(
    val loading: Boolean = false,
    val lat: Double? = null,
    val lng: Double? = null,
    val vendors: List<Vendor> = emptyList(),
    val error: String? = null,
    val needsPermission: Boolean = true,
    // Filter state — applied client-side over [vendors] to produce the
    // [filteredVendors] view used by the map markers and peek card.
    val searchQuery: String = "",
    val freeNowOnly: Boolean = false,
    val under40Only: Boolean = false,
) {
    /**
     * The list after applying search + filter chips. Computed eagerly here
     * so the screen doesn't have to re-derive on every recomposition.
     */
    val filteredVendors: List<Vendor>
        get() {
            val q = searchQuery.trim().lowercase()
            return vendors.filter { v ->
                val matchesQuery = q.isEmpty() ||
                    v.brandName.lowercase().contains(q) ||
                    v.city.lowercase().contains(q)
                val matchesFree = !freeNowOnly || v.freeBays > 0
                val matchesPrice = !under40Only || (v.priceFromAed != null && v.priceFromAed < 40)
                matchesQuery && matchesFree && matchesPrice
            }
        }
}

@HiltViewModel
class NearbyViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val vendors: VendorRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(NearbyUiState())
    val state: StateFlow<NearbyUiState> = _state.asStateFlow()

    private val fused by lazy { LocationServices.getFusedLocationProviderClient(context) }

    fun onPermissionGranted() {
        _state.update { it.copy(needsPermission = false) }
        refresh()
    }

    fun onPermissionDenied() {
        // Fall back: center map on Dubai's Burj Khalifa with no auto-load.
        _state.update {
            it.copy(
                needsPermission = true,
                lat = 25.1972,
                lng = 55.2744,
                error = "Allow location access to see car washes near you.",
            )
        }
    }

    @SuppressLint("MissingPermission") // caller has already granted at this point
    fun refresh() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            val location = runCatching {
                val cts = CancellationTokenSource()
                fused.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, cts.token).await()
            }.getOrNull()

            if (location == null) {
                _state.update {
                    it.copy(
                        loading = false,
                        error = "Couldn't read your location. Try again outdoors or with GPS on.",
                    )
                }
                return@launch
            }

            _state.update { it.copy(lat = location.latitude, lng = location.longitude) }

            val list = runCatching { vendors.nearby(location.latitude, location.longitude) }
                .getOrElse {
                    _state.update { s -> s.copy(loading = false, error = friendly(it)) }
                    return@launch
                }

            _state.update { it.copy(loading = false, vendors = list) }
        }
    }

    // ── Filter setters ──────────────────────────────────────────────────

    fun setSearchQuery(q: String) = _state.update { it.copy(searchQuery = q) }
    fun toggleFreeNow() = _state.update { it.copy(freeNowOnly = !it.freeNowOnly) }
    fun toggleUnder40() = _state.update { it.copy(under40Only = !it.under40Only) }

    private fun friendly(e: Throwable): String =
        e.message?.takeIf { it.isNotBlank() } ?: "Couldn't load car washes nearby."
}
