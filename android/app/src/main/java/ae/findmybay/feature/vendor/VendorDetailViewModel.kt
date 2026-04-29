package ae.findmybay.feature.vendor

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.data.repo.VendorRepository
import ae.findmybay.domain.model.Service
import ae.findmybay.domain.model.VendorDetail
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class VendorDetailUiState(
    val loading: Boolean = true,
    val vendor: VendorDetail? = null,
    val selectedServiceId: String? = null,
    val error: String? = null,
) {
    val selectedService: Service?
        get() = vendor?.services?.firstOrNull { it.id == selectedServiceId }
}

@HiltViewModel
class VendorDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val vendors: VendorRepository,
) : ViewModel() {

    val vendorId: String = checkNotNull(savedStateHandle["vendorId"])

    private val _state = MutableStateFlow(VendorDetailUiState())
    val state: StateFlow<VendorDetailUiState> = _state.asStateFlow()

    init { load() }

    fun load() {
        _state.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            runCatching { vendors.detail(vendorId) }
                .onSuccess { v ->
                    _state.update {
                        it.copy(
                            loading = false,
                            vendor = v,
                            // Default-pick the first (cheapest) service.
                            selectedServiceId = it.selectedServiceId ?: v.services.firstOrNull()?.id,
                        )
                    }
                }
                .onFailure { e ->
                    _state.update { it.copy(loading = false, error = e.message ?: "Couldn't load vendor") }
                }
        }
    }

    fun selectService(serviceId: String) {
        _state.update { it.copy(selectedServiceId = serviceId) }
    }
}
