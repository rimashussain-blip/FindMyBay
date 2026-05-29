package ae.findmybay.feature.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ae.findmybay.data.repo.AuthRepository
import ae.findmybay.domain.model.CarType

/**
 * Drives the first-run customer onboarding flow shown right after Google
 * sign-in. Two visual steps:
 *   Step 1 — mobile number, car make, type, colour
 *   Step 2 — car plate number
 *
 * The viewmodel keeps the form state across both steps so a back-press in
 * step 2 returns the user to a fully-populated step 1.
 */
@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val auth: AuthRepository,
) : ViewModel() {

    data class State(
        val step: Step = Step.CarDetails,
        val phone: String = "+971",
        val carMake: String = "",
        val carType: CarType? = null,
        val carColor: String = "",
        val carPlate: String = "",
        val saving: Boolean = false,
        val error: String? = null,
        val done: Boolean = false,
    ) {
        /** Step 1 ready — required: phone, carMake, carType. Colour is optional but recommended. */
        val step1Valid: Boolean get() =
            phone.length >= 10 && carMake.trim().length >= 2 && carType != null

        /** Step 2 ready — plate must be at least 4 characters (e.g. "A123"). */
        val step2Valid: Boolean get() = carPlate.trim().length >= 4
    }

    enum class Step { CarDetails, Plate }

    private val _state = MutableStateFlow(State())
    val state = _state.asStateFlow()

    fun setPhone(value: String) {
        // Strip everything that isn't a digit or "+", keep "+" only at the start.
        val cleaned = value
            .replace(Regex("[^+0-9]"), "")
            .let { if (it.startsWith("+")) "+" + it.drop(1).filter { c -> c.isDigit() } else it }
        _state.update { it.copy(phone = cleaned, error = null) }
    }

    fun setCarMake(value: String) {
        _state.update { it.copy(carMake = value.take(40), error = null) }
    }

    fun setCarType(value: CarType) {
        _state.update { it.copy(carType = value, error = null) }
    }

    fun setCarColor(value: String) {
        _state.update { it.copy(carColor = value.take(20), error = null) }
    }

    fun setCarPlate(value: String) {
        _state.update { it.copy(carPlate = value.uppercase().take(20), error = null) }
    }

    fun goToPlateStep() {
        if (!_state.value.step1Valid) return
        _state.update { it.copy(step = Step.Plate, error = null) }
    }

    fun goBackToDetails() {
        _state.update { it.copy(step = Step.CarDetails, error = null) }
    }

    /**
     * Saves all fields in one call. Backend accepts partial updates so we
     * could split this across the two steps, but the UX of a single network
     * round-trip on Finish reads as cleaner — fewer ways for the user to
     * leave the app in an in-between state.
     */
    fun submit(onComplete: () -> Unit) {
        val s = _state.value
        if (!s.step1Valid || !s.step2Valid) return

        _state.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            runCatching {
                auth.updateCarProfile(
                    phone = s.phone,
                    carMake = s.carMake.trim(),
                    carType = s.carType,
                    carColor = s.carColor.trim().ifEmpty { null },
                    carPlate = s.carPlate.trim(),
                )
            }
                .onSuccess {
                    _state.update { it.copy(saving = false, done = true) }
                    onComplete()
                }
                .onFailure { e ->
                    _state.update { it.copy(saving = false, error = friendly(e)) }
                }
        }
    }

    private fun friendly(e: Throwable): String =
        e.message?.takeIf { it.isNotBlank() } ?: "Something went wrong, please try again."
}
