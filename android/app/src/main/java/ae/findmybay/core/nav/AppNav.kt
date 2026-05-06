package ae.findmybay.core.nav

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.navigation
import ae.findmybay.feature.alert.LeaveNowScreen
import ae.findmybay.feature.auth.AuthViewModel
import ae.findmybay.feature.auth.OtpVerifyScreen
import ae.findmybay.feature.auth.PhoneOtpScreen
import ae.findmybay.feature.booking.BookingConfirmedScreen
import ae.findmybay.feature.booking.SlotPickerScreen
import ae.findmybay.feature.bookings.MyBookingsScreen
import ae.findmybay.feature.bookings.RateBookingScreen
import ae.findmybay.feature.bookings.ShowQrScreen
import ae.findmybay.feature.home.NearbyMapScreen
import ae.findmybay.feature.onboarding.OnboardingScreen
import ae.findmybay.feature.payment.ReviewPayScreen
import ae.findmybay.feature.profile.ProfileScreen
import ae.findmybay.feature.splash.SplashScreen
import ae.findmybay.feature.stub.LoyaltyScreen
import ae.findmybay.feature.vendor.VendorDetailScreen

object Routes {
    const val SPLASH = "splash"
    const val AUTH_GRAPH = "auth"
    const val PHONE = "phone"
    const val OTP_VERIFY = "otp/{phone}"
    const val ONBOARDING = "onboarding"
    const val NEARBY = "nearby"
    const val VENDOR_DETAIL = "vendor/{vendorId}"
    const val SLOT_PICKER = "vendor/{vendorId}/slot-picker"
    const val REVIEW_PAY = "booking/{bookingId}/pay"
    const val BOOKING_CONFIRMED = "booking/{bookingId}/confirmed"
    const val LEAVE_NOW = "alert/leave-now/{vendorName}/{etaMin}/{slotTime}"
    const val MY_BOOKINGS = "bookings"
    const val LOYALTY = "loyalty"
    const val PROFILE = "profile"
    const val SHOW_QR = "bookings/{bookingId}/qr"
    const val RATE_BOOKING = "bookings/{bookingId}/rate"

    fun otpVerify(phone: String) = "otp/$phone"
    fun vendorDetail(vendorId: String) = "vendor/$vendorId"
    fun slotPicker(vendorId: String) = "vendor/$vendorId/slot-picker"
    fun reviewPay(bookingId: String) = "booking/$bookingId/pay"
    fun bookingConfirmed(bookingId: String) = "booking/$bookingId/confirmed"
    fun showQr(bookingId: String) = "bookings/$bookingId/qr"
    fun rateBooking(bookingId: String) = "bookings/$bookingId/rate"
    fun leaveNow(vendorName: String, etaMin: Int, slotTime: String): String {
        val v = java.net.URLEncoder.encode(vendorName, "UTF-8")
        val s = java.net.URLEncoder.encode(slotTime, "UTF-8")
        return "alert/leave-now/$v/$etaMin/$s"
    }
}

/** Top-level tab destinations that render the BottomNav. */
private val TAB_ROUTES = setOf(Routes.NEARBY, Routes.MY_BOOKINGS, Routes.LOYALTY, Routes.PROFILE)

@Composable
private inline fun <reified T : androidx.lifecycle.ViewModel> NavBackStackEntry.graphViewModel(
    nav: NavHostController,
    graphRoute: String,
): T {
    val parentEntry = remember(this) { nav.getBackStackEntry(graphRoute) }
    return hiltViewModel(parentEntry)
}

@Composable
fun AppNav(initialDeepLink: AlertDeepLink? = null) {
    val nav = rememberNavController()

    LaunchedEffect(initialDeepLink) {
        when (val link = initialDeepLink) {
            null -> Unit
            is AlertDeepLink.LeaveNow -> {
                nav.navigate(Routes.leaveNow(link.vendorName, link.etaMin, link.slotTime)) {
                    popUpTo(0) { inclusive = false }
                }
            }
            is AlertDeepLink.RateWash -> {
                nav.navigate(Routes.rateBooking(link.bookingId)) {
                    popUpTo(0) { inclusive = false }
                }
            }
        }
    }

    val backStackEntry by nav.currentBackStackEntryAsState()
    val showBottomBar = backStackEntry?.destination?.route in TAB_ROUTES

    Scaffold(
        bottomBar = {
            if (showBottomBar) FmbBottomNavigation(nav)
        },
    ) { scaffoldPadding ->
        Box(modifier = Modifier.padding(scaffoldPadding)) {
            NavHost(navController = nav, startDestination = Routes.SPLASH) {

                // ── Splash — branches to login / onboarding / map ────────
                composable(Routes.SPLASH) {
                    SplashScreen(
                        onNeedsLogin = {
                            nav.navigate(Routes.AUTH_GRAPH) {
                                popUpTo(Routes.SPLASH) { inclusive = true }
                            }
                        },
                        onNeedsOnboarding = {
                            nav.navigate(Routes.ONBOARDING) {
                                popUpTo(Routes.SPLASH) { inclusive = true }
                            }
                        },
                        onSignedIn = {
                            nav.navigate(Routes.NEARBY) {
                                popUpTo(Routes.SPLASH) { inclusive = true }
                            }
                        },
                    )
                }

                // ── Auth flow ────────────────────────────────────────────
                navigation(startDestination = Routes.PHONE, route = Routes.AUTH_GRAPH) {
                    composable(Routes.PHONE) { entry ->
                        val vm = entry.graphViewModel<AuthViewModel>(nav, Routes.AUTH_GRAPH)
                        PhoneOtpScreen(
                            vm = vm,
                            onOtpSent = { phone -> nav.navigate(Routes.otpVerify(phone)) },
                            // Google Sign-In bypasses the OTP screen. Returning
                            // customers (profile already complete) go straight
                            // to the map; brand-new accounts go to onboarding
                            // first so we capture mobile + car details.
                            onGoogleVerified = {
                                nav.navigate(Routes.NEARBY) {
                                    popUpTo(Routes.AUTH_GRAPH) { inclusive = true }
                                }
                            },
                            onNeedsOnboarding = {
                                nav.navigate(Routes.ONBOARDING) {
                                    popUpTo(Routes.AUTH_GRAPH) { inclusive = true }
                                }
                            },
                        )
                    }
                    composable(Routes.ONBOARDING) {
                        OnboardingScreen(
                            onComplete = {
                                nav.navigate(Routes.NEARBY) {
                                    popUpTo(Routes.ONBOARDING) { inclusive = true }
                                }
                            },
                        )
                    }
                    composable(
                        route = Routes.OTP_VERIFY,
                        arguments = listOf(navArgument("phone") { type = NavType.StringType }),
                    ) { entry ->
                        val vm = entry.graphViewModel<AuthViewModel>(nav, Routes.AUTH_GRAPH)
                        val phone = entry.arguments?.getString("phone").orEmpty()
                        OtpVerifyScreen(
                            vm = vm,
                            phone = phone,
                            onVerified = {
                                nav.navigate(Routes.NEARBY) {
                                    popUpTo(Routes.AUTH_GRAPH) { inclusive = true }
                                }
                            },
                            onBack = { nav.popBackStack() },
                        )
                    }
                }

                // ── Tab destinations ─────────────────────────────────────
                composable(Routes.NEARBY) {
                    NearbyMapScreen(
                        onVendorClick = { vendorId -> nav.navigate(Routes.vendorDetail(vendorId)) },
                    )
                }

                composable(Routes.MY_BOOKINGS) {
                    MyBookingsScreen(
                        onAddBooking = { nav.popBackStack(Routes.NEARBY, inclusive = false) },
                        onShowQr = { bookingId -> nav.navigate(Routes.showQr(bookingId)) },
                        onRate = { bookingId -> nav.navigate(Routes.rateBooking(bookingId)) },
                    )
                }

                composable(
                    route = Routes.SHOW_QR,
                    arguments = listOf(navArgument("bookingId") { type = NavType.StringType }),
                ) {
                    ShowQrScreen(onBack = { nav.popBackStack() })
                }

                composable(
                    route = Routes.RATE_BOOKING,
                    arguments = listOf(navArgument("bookingId") { type = NavType.StringType }),
                ) {
                    RateBookingScreen(
                        onBack = { nav.popBackStack() },
                        onSubmitted = { nav.popBackStack() },
                    )
                }

                composable(Routes.LOYALTY) { LoyaltyScreen() }
                composable(Routes.PROFILE) {
                    ProfileScreen(
                        onSignedOut = {
                            nav.navigate(Routes.AUTH_GRAPH) {
                                popUpTo(0) { inclusive = true }
                            }
                        },
                    )
                }

                // ── Other authenticated flows ────────────────────────────
                composable(
                    route = Routes.VENDOR_DETAIL,
                    arguments = listOf(navArgument("vendorId") { type = NavType.StringType }),
                ) {
                    VendorDetailScreen(
                        onBack = { nav.popBackStack() },
                        onBook = { vendorId -> nav.navigate(Routes.slotPicker(vendorId)) },
                    )
                }

                composable(
                    route = Routes.SLOT_PICKER,
                    arguments = listOf(navArgument("vendorId") { type = NavType.StringType }),
                ) {
                    SlotPickerScreen(
                        onBack = { nav.popBackStack() },
                        onConfirmed = { bookingId ->
                            // Booking is in pending_payment — go to ReviewPay first.
                            nav.navigate(Routes.reviewPay(bookingId)) {
                                popUpTo(Routes.NEARBY) { inclusive = false }
                            }
                        },
                    )
                }

                composable(
                    route = Routes.REVIEW_PAY,
                    arguments = listOf(navArgument("bookingId") { type = NavType.StringType }),
                ) {
                    ReviewPayScreen(
                        onBack = { nav.popBackStack() },
                        onPaid = { bookingId ->
                            nav.navigate(Routes.bookingConfirmed(bookingId)) {
                                popUpTo(Routes.NEARBY) { inclusive = false }
                            }
                        },
                    )
                }

                composable(
                    route = Routes.BOOKING_CONFIRMED,
                    arguments = listOf(navArgument("bookingId") { type = NavType.StringType }),
                ) {
                    BookingConfirmedScreen(
                        onDone = { nav.popBackStack(Routes.NEARBY, inclusive = false) },
                    )
                }

                composable(
                    route = Routes.LEAVE_NOW,
                    arguments = listOf(
                        navArgument("vendorName") { type = NavType.StringType },
                        navArgument("etaMin") { type = NavType.IntType },
                        navArgument("slotTime") { type = NavType.StringType },
                    ),
                ) { entry ->
                    val v = java.net.URLDecoder.decode(entry.arguments?.getString("vendorName").orEmpty(), "UTF-8")
                    val eta = entry.arguments?.getInt("etaMin") ?: 0
                    val slot = java.net.URLDecoder.decode(entry.arguments?.getString("slotTime").orEmpty(), "UTF-8")
                    LeaveNowScreen(
                        vendorName = v,
                        etaMin = eta,
                        slotTime = slot,
                        onLeavingNow = { nav.popBackStack(Routes.NEARBY, inclusive = false) },
                        onSnooze = { nav.popBackStack() },
                    )
                }
            }
        }
    }
}

sealed class AlertDeepLink {
    data class LeaveNow(
        val vendorName: String,
        val etaMin: Int,
        val slotTime: String,
    ) : AlertDeepLink()

    data class RateWash(val bookingId: String) : AlertDeepLink()
}
