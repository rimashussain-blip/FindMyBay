package ae.findmybay.feature.booking

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.data.repo.BookingRepository
import ae.findmybay.data.repo.VendorRepository
import ae.findmybay.domain.model.Booking
import ae.findmybay.domain.model.Service
import ae.findmybay.domain.model.Slot
import ae.findmybay.domain.model.VendorDetail
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject

data class SlotPickerUiState(
    val loading: Boolean = false,
    val vendor: VendorDetail? = null,
    val selectedService: Service? = null,
    val date: LocalDate = LocalDate.now(),
    val availableDates: List<LocalDate> = (0..3).map { LocalDate.now().plusDays(it.toLong()) },
    val slots: List<Slot> = emptyList(),
    val selectedSlot: Slot? = null,
    val booking: Booking? = null,
    val confirming: Boolean = false,
    val error: String? = null,
    // Promo-code state. The user types into `promoCodeInput` and hits the
    // confirm button — the code is sent server-side which is the source
    // of truth for whether it's valid. On success the booking DTO comes
    // back with discountAed > 0 + promoCode populated; on failure we get
    // a 4xx and surface its message via `error`.
    val promoCodeInput: String = "",
    val promoExpanded: Boolean = false,
)

@HiltViewModel
class SlotPickerViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val vendors: VendorRepository,
    private val bookings: BookingRepository,
) : ViewModel() {

    val vendorId: String = checkNotNull(savedStateHandle["vendorId"])
    // Optional initial service id, forwarded from the vendor detail screen
    // when the customer picked a non-default service before tapping Book.
    // Null when arriving via a deep link or back-stack restore.
    private val initialServiceId: String? = savedStateHandle["serviceId"]

    private val _state = MutableStateFlow(SlotPickerUiState())
    val state: StateFlow<SlotPickerUiState> = _state.asStateFlow()

    init { loadVendor() }

    private fun loadVendor() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching { vendors.detail(vendorId) }
                .onSuccess { v ->
                    // Honour the forwarded serviceId if it matches one of the
                    // vendor's services; otherwise default to the first
                    // (legacy behaviour for deep links / restored state).
                    val preselected = initialServiceId?.let { id ->
                        v.services.firstOrNull { it.id == id }
                    } ?: v.services.firstOrNull()
                    _state.update { it.copy(loading = false, vendor = v, selectedService = preselected) }
                    if (preselected != null) loadSlots()
                }
                .onFailure { e -> _state.update { it.copy(loading = false, error = e.message ?: "Couldn't load vendor") } }
        }
    }

    fun selectService(service: Service) {
        _state.update { it.copy(selectedService = service, selectedSlot = null) }
        loadSlots()
    }

    fun selectDate(date: LocalDate) {
        if (date == _state.value.date) return
        _state.update { it.copy(date = date, selectedSlot = null) }
        loadSlots()
    }

    private fun loadSlots() {
        val service = _state.value.selectedService ?: return
        val date = _state.value.date.format(DateTimeFormatter.ISO_LOCAL_DATE)
        _state.update { it.copy(loading = true, error = null, slots = emptyList()) }
        viewModelScope.launch {
            runCatching { vendors.availability(vendorId, service.id, date) }
                .onSuccess { resp -> _state.update { it.copy(loading = false, slots = resp.slots) } }
                .onFailure { e -> _state.update { it.copy(loading = false, error = e.message ?: "Couldn't load slots") } }
        }
    }

    fun selectSlot(slot: Slot) {
        if (slot.available) _state.update { it.copy(selectedSlot = slot) }
    }

    fun setPromoCode(value: String) {
        _state.update { it.copy(promoCodeInput = value, error = null) }
    }

    fun togglePromoExpanded() {
        _state.update { it.copy(promoExpanded = !it.promoExpanded) }
    }

    fun confirm() {
        val s = _state.value
        val service = s.selectedService ?: return
        val slot = s.selectedSlot ?: return
        _state.update { it.copy(confirming = true, error = null) }
        viewModelScope.launch {
            runCatching {
                bookings.create(
                    vendorId = vendorId,
                    serviceId = service.id,
                    slotStartIso = slot.startsAt,
                    promoCode = s.promoCodeInput.trim().ifEmpty { null },
                )
            }
                .onSuccess { booking -> _state.update { it.copy(confirming = false, booking = booking) } }
                .onFailure { e -> _state.update { it.copy(confirming = false, error = e.message ?: "Couldn't confirm booking") } }
        }
    }
}
