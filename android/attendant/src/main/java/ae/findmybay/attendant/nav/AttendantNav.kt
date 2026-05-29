package ae.findmybay.attendant.nav

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import ae.findmybay.attendant.data.SessionManager
import ae.findmybay.attendant.ui.screens.BayBoardScreen
import ae.findmybay.attendant.ui.screens.ChangePasswordScreen
import ae.findmybay.attendant.ui.screens.BookingDetailScreen
import ae.findmybay.attendant.ui.screens.BookingsScreen
import ae.findmybay.attendant.ui.screens.LoginScreen
import ae.findmybay.attendant.ui.screens.ScannerScreen
import ae.findmybay.attendant.ui.screens.WalkInScreen

object Routes {
    const val LOGIN = "login"
    const val BAY_BOARD = "bay-board"
    const val CHANGE_PASSWORD = "change-password"
    const val BOOKINGS = "bookings"
    const val SCANNER = "scanner"
    const val WALK_IN = "walk-in"
    const val DETAIL = "detail/{id}"
    fun detail(id: String) = "detail/$id"
}

@Composable
fun AttendantNav(startDestination: String) {
    val nav = rememberNavController()

    // Involuntary session expiry (refresh token finally rejected): kick back to
    // login from wherever the user is, clearing the back stack.
    val expired by SessionManager.expired.collectAsStateWithLifecycle()
    LaunchedEffect(expired) {
        if (expired) {
            nav.toLogin()
            SessionManager.reset()
        }
    }

    NavHost(navController = nav, startDestination = startDestination) {
        composable(Routes.LOGIN) {
            LoginScreen(onSignedIn = {
                nav.navigate(Routes.BAY_BOARD) {
                    popUpTo(Routes.LOGIN) { inclusive = true }
                }
            })
        }
        composable(Routes.BAY_BOARD) {
            BayBoardScreen(
                onWalkIn = { nav.navigate(Routes.WALK_IN) },
                onScan = { nav.navigate(Routes.SCANNER) },
                onBookings = { nav.navigate(Routes.BOOKINGS) },
                onOpenBooking = { id -> nav.navigate(Routes.detail(id)) },
                onSignedOut = { nav.toLogin() },
                onMustChangePassword = {
                    nav.navigate(Routes.CHANGE_PASSWORD) {
                        popUpTo(Routes.BAY_BOARD) { inclusive = true }
                    }
                },
            )
        }
        composable(Routes.CHANGE_PASSWORD) {
            ChangePasswordScreen(onDone = {
                nav.navigate(Routes.BAY_BOARD) {
                    popUpTo(Routes.CHANGE_PASSWORD) { inclusive = true }
                }
            })
        }
        composable(Routes.BOOKINGS) {
            BookingsScreen(onBack = { nav.popBackStack() }, onOpenBooking = { id -> nav.navigate(Routes.detail(id)) })
        }
        composable(Routes.SCANNER) {
            ScannerScreen(onClose = { nav.popBackStack() })
        }
        composable(Routes.WALK_IN) {
            WalkInScreen(onBack = { nav.popBackStack() }, onStart = { nav.popBackStack() })
        }
        composable(
            Routes.DETAIL,
            arguments = listOf(navArgument("id") { type = NavType.StringType }),
        ) { backStackEntry ->
            val id = backStackEntry.arguments?.getString("id").orEmpty()
            BookingDetailScreen(bookingId = id, onClose = { nav.popBackStack() })
        }
    }
}

private fun NavController.toLogin() {
    navigate(Routes.LOGIN) {
        popUpTo(0) { inclusive = true }
    }
}
