package ae.findmybay.attendant.nav

import androidx.compose.runtime.Composable
import androidx.navigation.NavController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import ae.findmybay.attendant.ui.screens.BayBoardScreen
import ae.findmybay.attendant.ui.screens.BookingDetailScreen
import ae.findmybay.attendant.ui.screens.BookingsScreen
import ae.findmybay.attendant.ui.screens.LoginScreen
import ae.findmybay.attendant.ui.screens.ScannerScreen
import ae.findmybay.attendant.ui.screens.WalkInScreen

object Routes {
    const val LOGIN = "login"
    const val BAY_BOARD = "bay-board"
    const val BOOKINGS = "bookings"
    const val SCANNER = "scanner"
    const val WALK_IN = "walk-in"
    const val DETAIL = "detail/{id}"
    fun detail(id: String) = "detail/$id"
}

@Composable
fun AttendantNav(startDestination: String) {
    val nav = rememberNavController()
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
            )
        }
        composable(Routes.BOOKINGS) {
            BookingsScreen(onBack = { nav.popBackStack() }, onOpenBooking = { id -> nav.navigate(Routes.detail(id)) })
        }
        composable(Routes.SCANNER) {
            ScannerScreen(onClose = { nav.popBackStack() }, onTypeCode = { nav.popBackStack() })
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
