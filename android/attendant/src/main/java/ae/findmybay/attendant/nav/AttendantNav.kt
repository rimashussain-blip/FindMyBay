package ae.findmybay.attendant.nav

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import ae.findmybay.attendant.ui.screens.BayBoardScreen
import ae.findmybay.attendant.ui.screens.BookingDetailScreen
import ae.findmybay.attendant.ui.screens.BookingsScreen
import ae.findmybay.attendant.ui.screens.ScannerScreen
import ae.findmybay.attendant.ui.screens.WalkInScreen

object Routes {
    const val BAY_BOARD = "bay-board"
    const val BOOKINGS = "bookings"
    const val SCANNER = "scanner"
    const val WALK_IN = "walk-in"
    const val DETAIL = "detail"
}

@Composable
fun AttendantNav() {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = Routes.BAY_BOARD) {
        composable(Routes.BAY_BOARD) {
            BayBoardScreen(
                onWalkIn = { nav.navigate(Routes.WALK_IN) },
                onScan = { nav.navigate(Routes.SCANNER) },
                onBookings = { nav.navigate(Routes.BOOKINGS) },
                onOpenBooking = { nav.navigate(Routes.DETAIL) },
            )
        }
        composable(Routes.BOOKINGS) {
            BookingsScreen(
                onBack = { nav.popBackStack() },
                onOpenBooking = { nav.navigate(Routes.DETAIL) },
            )
        }
        composable(Routes.SCANNER) {
            ScannerScreen(
                onClose = { nav.popBackStack() },
                onTypeCode = { nav.popBackStack() },
            )
        }
        composable(Routes.WALK_IN) {
            WalkInScreen(
                onBack = { nav.popBackStack() },
                onStart = { nav.popBackStack() },
            )
        }
        composable(Routes.DETAIL) {
            BookingDetailScreen(onClose = { nav.popBackStack() })
        }
    }
}
