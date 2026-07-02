/* eslint-disable react-refresh/only-export-components -- entry point ไม่ใช่ component module, ไม่ผ่าน Fast Refresh boundary อยู่แล้ว */
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import { AuthProvider } from './AuthContext.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'
import { CartProvider } from './context/CartContext.jsx'

// code splitting: โหลดทุกหน้าแบบ lazy ตาม route (ลด bundle หลักที่โหลดตอนเปิดเว็บครั้งแรก)
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

// Rider — production UI
const RiderProfile = lazy(() => import('./RiderProfile.jsx'))
const RiderOrdersDashboard = lazy(() => import('./rider/RiderOrdersDashboard.jsx'))

// Admin — production UI
const AdminControlCenter = lazy(() => import('./admin/AdminControlCenter.jsx'))

// Store — production UI
const StoreLayout = lazy(() => import('./layouts/StoreLayout.jsx').then((m) => ({ default: m.StoreLayout })))
const StoreDashboardNew = lazy(() => import('./pages/store/Dashboard.jsx').then((m) => ({ default: m.Dashboard })))
const StoreOrdersNew = lazy(() => import('./pages/store/Orders.jsx').then((m) => ({ default: m.Orders })))
const StoreKitchenNew = lazy(() => import('./pages/store/Kitchen.jsx').then((m) => ({ default: m.Kitchen })))
const StoreMenuNew = lazy(() => import('./pages/store/Menu.jsx').then((m) => ({ default: m.Menu })))
const StoreSettingsNew = lazy(() => import('./pages/store/Settings.jsx').then((m) => ({ default: m.Settings })))

// Customer — production UI
const CustomerLayout = lazy(() => import('./layouts/CustomerLayout.jsx').then((m) => ({ default: m.CustomerLayout })))
const CustomerHome = lazy(() => import('./pages/customer/Home.jsx').then((m) => ({ default: m.Home })))
const CustomerOrders = lazy(() => import('./pages/customer/Orders.jsx').then((m) => ({ default: m.Orders })))
const CustomerOrderDetail = lazy(() => import('./pages/customer/OrderDetail.jsx').then((m) => ({ default: m.OrderDetail })))
const CustomerCheckout = lazy(() => import('./pages/customer/Checkout.jsx').then((m) => ({ default: m.Checkout })))
const CustomerProfile = lazy(() => import('./pages/customer/Profile.jsx').then((m) => ({ default: m.Profile })))
const CustomerNotifications = lazy(() => import('./pages/customer/Notifications.jsx').then((m) => ({ default: m.Notifications })))
const CustomerReviews = lazy(() => import('./pages/customer/Reviews.jsx').then((m) => ({ default: m.Reviews })))
const CustomerSettings = lazy(() => import('./pages/customer/Settings.jsx').then((m) => ({ default: m.Settings })))

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

          {/* Admin — production UI (single active route per role) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin" loginPath="/login">
                <AdminControlCenter />
              </ProtectedRoute>
            }
          />

          {/* Rider — production UI */}
          <Route
            path="/rider"
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

          {/* Store — production UI (StoreLayout dashboard at /store) */}
          <Route
            element={
              <ProtectedRoute role="store" loginPath="/login">
                <StoreLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/store" element={<StoreDashboardNew />} />
            <Route path="/store/orders" element={<StoreOrdersNew />} />
            <Route path="/store/kitchen" element={<StoreKitchenNew />} />
            <Route path="/store/menu" element={<StoreMenuNew />} />
            <Route path="/store/settings" element={<StoreSettingsNew />} />
          </Route>

          {/* Customer — production UI (CustomerLayout at "/") */}
          <Route path="/shop" element={<Navigate to="/" replace />} />
          <Route
            element={
              <ProtectedRoute role="customer" loginPath="/login">
                <CartProvider>
                  <CustomerLayout />
                </CartProvider>
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<CustomerHome />} />
            <Route path="/shop/orders" element={<CustomerOrders />} />
            <Route path="/shop/orders/:orderId" element={<CustomerOrderDetail />} />
            <Route path="/shop/checkout" element={<CustomerCheckout />} />
            <Route path="/shop/profile" element={<CustomerProfile />} />
            <Route path="/shop/notifications" element={<CustomerNotifications />} />
            <Route path="/shop/reviews" element={<CustomerReviews />} />
            <Route path="/shop/settings" element={<CustomerSettings />} />
          </Route>
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
