package ae.findmybay.core.nav

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.Event
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState

/** Bottom-nav destinations per the v2 Android handoff. */
enum class BottomNavDest(
    val route: String,
    val label: String,
    val selected: ImageVector,
    val unselected: ImageVector,
) {
    Home(Routes.NEARBY, "Home", Icons.Filled.Home, Icons.Outlined.Home),
    Bookings(Routes.MY_BOOKINGS, "Bookings", Icons.Filled.Event, Icons.Outlined.Event),
    Loyalty(Routes.LOYALTY, "Loyalty", Icons.Filled.CardGiftcard, Icons.Outlined.CardGiftcard),
    Profile(Routes.PROFILE, "Profile", Icons.Filled.Person, Icons.Outlined.Person),
}

@Composable
fun FmbBottomNavigation(nav: NavHostController) {
    val backStackEntry by nav.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    NavigationBar(
        containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surfaceContainer,
        tonalElevation = 0.dp,
    ) {
        BottomNavDest.values().forEach { dest ->
            val selected = currentRoute == dest.route ||
                backStackEntry?.destination?.hierarchy?.any { it.route == dest.route } == true
            NavigationBarItem(
                selected = selected,
                onClick = {
                    if (currentRoute != dest.route) {
                        nav.navigate(dest.route) {
                            popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                },
                icon = {
                    Icon(
                        if (selected) dest.selected else dest.unselected,
                        contentDescription = dest.label,
                    )
                },
                label = { Text(dest.label) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = androidx.compose.material3.MaterialTheme.colorScheme.onSecondaryContainer,
                    indicatorColor = androidx.compose.material3.MaterialTheme.colorScheme.secondaryContainer,
                ),
            )
        }
    }
}

