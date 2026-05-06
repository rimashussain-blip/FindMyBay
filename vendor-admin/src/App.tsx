import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthBootstrap } from './components/AuthBootstrap';
import { Layout } from './components/Layout';
import { PlatformLayout } from './components/PlatformLayout';
import { useAuth } from './store/auth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BayBoardPage from './pages/BayBoardPage';
import BookingsPage from './pages/BookingsPage';
import BrandPage from './pages/BrandPage';
import ServicesPage from './pages/ServicesPage';
import ScanCheckinPage from './pages/ScanCheckinPage';
import ReviewsPage from './pages/ReviewsPage';
import WalkInPage from './pages/WalkInPage';
import PlatformVendorsPage from './pages/PlatformVendorsPage';
import PlatformNewVendorPage from './pages/PlatformNewVendorPage';
import PlatformVendorDetailPage from './pages/PlatformVendorDetailPage';
import PlatformUsersPage from './pages/PlatformUsersPage';
import PlatformUserDetailPage from './pages/PlatformUserDetailPage';

/** Require an auth token. Sends to /login otherwise. */
function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * Top-level route gate that splits traffic between the platform-admin shell
 * and the vendor-staff shell based on the signed-in user's role. We keep
 * `/platform/*` and `/...` (the vendor pages) entirely separate so a vendor
 * staff member can never see the platform UI and vice versa — even if they
 * type the URL.
 */
export default function App() {
  return (
    <AuthBootstrap>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/platform/*"
          element={
            <Protected>
              <PlatformShell />
            </Protected>
          }
        />

        <Route
          path="/*"
          element={
            <Protected>
              <VendorShell />
            </Protected>
          }
        />
      </Routes>
    </AuthBootstrap>
  );
}

function VendorShell() {
  const role = useAuth((s) => s.role);
  // A platform admin who lands on a vendor URL gets bounced to their queue.
  if (role === 'admin') return <Navigate to="/platform/vendors" replace />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/bays" element={<BayBoardPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/walk-in" element={<WalkInPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/scan" element={<ScanCheckinPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/brand" element={<BrandPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

function PlatformShell() {
  const role = useAuth((s) => s.role);
  // Anyone other than a super admin who stumbles onto /platform/* gets sent
  // back to the vendor area. The backend will 403 anyway, but redirecting
  // beats showing them broken pages.
  if (role !== 'admin') return <Navigate to="/" replace />;
  return (
    <PlatformLayout>
      <Routes>
        <Route path="/" element={<Navigate to="vendors" replace />} />
        <Route path="vendors" element={<PlatformVendorsPage />} />
        <Route path="vendors/new" element={<PlatformNewVendorPage />} />
        <Route path="vendors/:id" element={<PlatformVendorDetailPage />} />
        <Route path="users" element={<PlatformUsersPage />} />
        <Route path="users/:id" element={<PlatformUserDetailPage />} />
        <Route path="*" element={<Navigate to="vendors" replace />} />
      </Routes>
    </PlatformLayout>
  );
}
