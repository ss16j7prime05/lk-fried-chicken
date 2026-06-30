/* eslint-disable react-refresh/only-export-components -- entry point ไม่ใช่ component module, ไม่ผ่าน Fast Refresh boundary อยู่แล้ว */
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

// code splitting: โหลดทุกหน้าแบบ lazy ตาม route (ลด bundle หลักที่โหลดตอนเปิดเว็บครั้งแรก)
const App = lazy(() => import('./App.jsx'))
const Admin = lazy(() => import('./Admin.jsx'))
const Store = lazy(() => import('./Store.jsx'))
const CustomerOrderHistory = lazy(() => import('./CustomerOrderHistory.jsx'))
const TrackOrder = lazy(() => import('./TrackOrder.jsx'))
const Rider = lazy(() => import('./Rider.jsx'))

import { AuthProvider } from './AuthContext.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'
import { CartProvider } from './context/CartContext.jsx'
const Login = lazy(() => import('./login/Login.jsx'))
const Register = lazy(() => import('./login/Register.jsx'))
const RegisterCustomer = lazy(() => import('./register/RegisterCustomer.jsx'))
const RegisterStore = lazy(() => import('./register/RegisterStore.jsx'))
const RegisterRider = lazy(() => import('./register/RegisterRider.jsx'))
const ForgotPassword = lazy(() => import('./login/ForgotPassword.jsx'))
const AdminLogin = lazy(() => import('./login/AdminLogin.jsx'))
const StoreLogin = lazy(() => import('./login/StoreLogin.jsx'))
const CustomerLogin = lazy(() => import('./login/CustomerLogin.jsx'))
const RiderLogin = lazy(() => import('./login/RiderLogin.jsx'))
const SignupStore = lazy(() => import('./signup/SignupStore.jsx'))
const SignupRider = lazy(() => import('./signup/SignupRider.jsx'))
const StoreDashboard = lazy(() => import('./StoreDashboard.jsx'))
const StoreOrdersDashboard = lazy(() => import('./store/StoreOrdersDashboard.jsx'))
const StoreMenu = lazy(() => import('./StoreMenu.jsx'))
const RiderProfile = lazy(() => import('./RiderProfile.jsx'))
const RiderOrdersDashboard = lazy(() => import('./rider/RiderOrdersDashboard.jsx'))
const AdminDashboard = lazy(() => import('./AdminDashboard.jsx'))
const AdminControlCenter = lazy(() => import('./admin/AdminControlCenter.jsx'))

// New Store UI (production dashboard)
const StoreLayout = lazy(() => import('./layouts/StoreLayout.jsx').then((m) => ({ default: m.StoreLayout })))
const StoreDashboardNew = lazy(() => import('./pages/store/Dashboard.jsx').then((m) => ({ default: m.Dashboard })))
const StoreOrdersNew = lazy(() => import('./pages/store/Orders.jsx').then((m) => ({ default: m.Orders })))
const StoreKitchenNew = lazy(() => import('./pages/store/Kitchen.jsx').then((m) => ({ default: m.Kitchen })))
const StoreMenuNew = lazy(() => import('./pages/store/Menu.jsx').then((m) => ({ default: m.Menu })))
const StoreSettingsNew = lazy(() => import('./pages/store/Settings.jsx').then((m) => ({ default: m.Settings })))

// New customer UI (Tailwind redesign) — not yet connected to Firestore
const CustomerLayout = lazy(() => import('./layouts/CustomerLayout.jsx').then((m) => ({ default: m.CustomerLayout })))
const CustomerHome = lazy(() => import('./pages/customer/Home.jsx').then((m) => ({ default: m.Home })))
const CustomerOrders = lazy(() => import('./pages/customer/Orders.jsx').then((m) => ({ default: m.Orders })))
const CustomerOrderDetail = lazy(() => import('./pages/customer/OrderDetail.jsx').then((m) => ({ default: m.OrderDetail })))
const CustomerCheckout = lazy(() => import('./pages/customer/Checkout.jsx').then((m) => ({ default: m.Checkout })))
const CustomerProfile = lazy(() => import('./pages/customer/Profile.jsx').then((m) => ({ default: m.Profile })))
const CustomerNotifications = lazy(() => import('./pages/customer/Notifications.jsx').then((m) => ({ default: m.Notifications })))

const PageLoading = () => (
  <div style={{ minHeight: '100vh', background: '#121212', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
    กำลังโหลด...
  </div>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute loginPath="/login">
                <App />
              </ProtectedRoute>
            }
          />

          {/* Login pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/customer" element={<RegisterCustomer />} />
          <Route path="/register/store" element={<RegisterStore />} />
          <Route path="/register/rider" element={<RegisterRider />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/login/admin" element={<AdminLogin />} />
          <Route path="/login/store" element={<StoreLogin />} />
          <Route path="/login/customer" element={<CustomerLogin />} />
          <Route path="/login/rider" element={<RiderLogin />} />

          {/* Signup pages */}
          <Route path="/signup/store" element={<SignupStore />} />
          <Route path="/signup/rider" element={<SignupRider />} />

          {/* Protected systems */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin" loginPath="/login">
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute role="admin" loginPath="/login">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/center"
            element={
              <ProtectedRoute role="admin" loginPath="/login">
                <AdminControlCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/store"
            element={
              <ProtectedRoute role="store" loginPath="/login">
                <Store />
              </ProtectedRoute>
            }
          />
          <Route
            path="/store/dashboard"
            element={
              <ProtectedRoute role="store" loginPath="/login">
                <StoreDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/store/orders"
            element={
              <ProtectedRoute role="store" loginPath="/login">
                <StoreOrdersDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/store/menu"
            element={
              <ProtectedRoute role="store" loginPath="/login">
                <StoreMenu />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer"
            element={
              <ProtectedRoute role="customer" loginPath="/login">
                <App />
              </ProtectedRoute>
            }
          />
          <Route
            path="/track"
            element={
              <ProtectedRoute role="customer" loginPath="/login">
                <TrackOrder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rider"
            element={
              <ProtectedRoute role="rider" loginPath="/login">
                <Rider />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rider/dashboard"
            element={
              <ProtectedRoute role="rider" loginPath="/login">
                <RiderOrdersDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rider/profile"
            element={
              <ProtectedRoute role="rider" loginPath="/login">
                <RiderProfile />
              </ProtectedRoute>
            }
          />

          {/* New Store UI — production dashboard under /store/v2/* */}
          <Route
            element={
              <ProtectedRoute role="store" loginPath="/login">
                <StoreLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/store/v2/dashboard" element={<StoreDashboardNew />} />
            <Route path="/store/v2/orders" element={<StoreOrdersNew />} />
            <Route path="/store/v2/kitchen" element={<StoreKitchenNew />} />
            <Route path="/store/v2/menu" element={<StoreMenuNew />} />
            <Route path="/store/v2/settings" element={<StoreSettingsNew />} />
          </Route>

          <Route
            path="/history"
            element={
              <ProtectedRoute role="customer" loginPath="/login">
                <CustomerOrderHistory />
              </ProtectedRoute>
            }
          />

          {/* New customer UI (Tailwind redesign) — mock data only, not yet wired to Firestore */}
          <Route
            element={
              <ProtectedRoute role="customer" loginPath="/login">
                <CartProvider>
                  <CustomerLayout />
                </CartProvider>
              </ProtectedRoute>
            }
          >
            <Route path="/shop" element={<CustomerHome />} />
            <Route path="/shop/orders" element={<CustomerOrders />} />
            <Route path="/shop/orders/:orderId" element={<CustomerOrderDetail />} />
            <Route path="/shop/checkout" element={<CustomerCheckout />} />
            <Route path="/shop/profile" element={<CustomerProfile />} />
            <Route path="/shop/notifications" element={<CustomerNotifications />} />
          </Route>
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
