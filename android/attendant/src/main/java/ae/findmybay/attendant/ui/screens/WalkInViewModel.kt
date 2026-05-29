package ae.findmybay.attendant.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ae.findmybay.attendant.data.AttendantRepository
import ae.findmybay.attendant.data.BayOption
import ae.findmybay.attendant.data.ServiceOption
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class WalkInUiState(
    val loading: Boolean = true,
    val bays: List<BayOption> = emptyList(),
    val services: List<ServiceOption> = emptyList(),
    val selectedBayId: String? = null,
    val selectedServiceId: String? = null,
    val name: String = "",
    val phone: String = "",
    val expanded: Boolean = false,
    val submitting: Boolean = false,
    val error: String? = null,
    val done: Boolean = false,
) {
    val selectedService: ServiceOption? get() = services.firstOrNull { it.id == selectedServiceId }
    val canSubmit: Boolean get() = selectedBayId != null && selectedServiceId != null && !submitting
}

class WalkInViewModel(private val repo: AttendantRepository) : ViewModel() {
    private val _state = MutableStateFlow(WalkInUiState())
    val state: StateFlow<WalkInUiState> = _state.asStateFlow()

    init { load() }

    private fun load() {
        viewModelScope.launch {
            runCatching { repo.loadWalkInOptions() }
                .onSuccess { opts ->
                    _state.update {
                        it.copy(
                            loading = false,
                            bays = opts.bays,
                            services = opts.services,
                            // default to the first free bay + first service
                            selectedBayId = opts.bays.firstOrNull { b -> b.status == "free" }?.id,
                            selectedServiceId = opts.services.firstOrNull()?.id,
                        )
                    }
                }
                .onFailure { e -> _state.update { it.copy(loading = false, error = e.message ?: "Couldn't load services") } }
        }
    }

    fun selectBay(id: String) = _state.update { it.copy(selectedBayId = id) }
    fun selectService(id: String) = _state.update { it.copy(selectedServiceId = id) }
    fun setName(v: String) = _state.update { it.copy(name = v) }
    fun setPhone(v: String) = _state.update { it.copy(phone = v) }
    fun toggleExpanded() = _state.update { it.copy(expanded = !it.expanded) }

    fun submit() {
        val s = _state.value
        if (!s.canSubmit) return
        _state.update { it.copy(submitting = true, error = null) }
        viewModelScope.launch {
            runCatching { repo.createWalkIn(s.selectedBayId!!, s.selectedServiceId!!, s.name, s.phone) }
                .onSuccess { _state.update { it.copy(submitting = false, done = true) } }
                .onFailure { e -> _state.update { it.copy(submitting = false, error = e.message ?: "Couldn't start the walk-in") } }
        }
    }
}
