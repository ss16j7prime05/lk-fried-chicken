import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

import App from './App.jsx'
import Admin from './Admin.jsx'
import Store from './Store.jsx'
import CustomerOrderHistory from './CustomerOrderHistory.jsx'
import TrackOrder from './TrackOrder.jsx'
import Rider from './Rider.jsx'

import { AuthProvider } from './AuthContext.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'
import Login from './login/Login.jsx'
import Register from './login/Register.jsx'
import ForgotPassword from './login/ForgotPassword.jsx'
import AdminLogin from './login/AdminLogin.jsx'
import StoreLogin from './login/StoreLogin.jsx'
import CustomerLogin from './login/CustomerLogin.jsx'
import RiderLogin from './login/RiderLogin.jsx'
import SignupStore from './signup/SignupStore.jsx'
import SignupRider from './signup/SignupRider.jsx'
import StoreDashboard from './StoreDashboard.jsx'
import StoreOrdersDashboard from './store/StoreOrdersDashboard.jsx'
import StoreMenu from './StoreMenu.jsx'
import RiderProfile from './RiderProfile.jsx'
import RiderOrdersDashboard from './rider/RiderOrdersDashboard.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import AdminControlCenter from './admin/AdminControlCenter.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
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
              <ProtectedRoute role="admin" loginPath="/login/admin">
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute role="admin" loginPath="/login/admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/center"
            element={
              <ProtectedRoute role="admin" loginPath="/login/admin">
                <AdminControlCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/store"
            element={
              <ProtectedRoute role="store" loginPath="/login/store">
                <Store />
              </ProtectedRoute>
            }
          />
          <Route
            path="/store/dashboard"
            element={
              <ProtectedRoute role="store" loginPath="/login/store">
                <StoreDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/store/orders"
            element={
              <ProtectedRoute role="store" loginPath="/login/store">
                <StoreOrdersDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/store/menu"
            element={
              <ProtectedRoute role="store" loginPath="/login/store">
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
              <ProtectedRoute role="customer" loginPath="/login/customer">
                <TrackOrder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rider"
            element={
              <ProtectedRoute role="rider" loginPath="/login/rider">
                <Rider />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rider/dashboard"
            element={
              <ProtectedRoute role="rider" loginPath="/login/rider">
                <RiderOrdersDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rider/profile"
            element={
              <ProtectedRoute role="rider" loginPath="/login/rider">
                <RiderProfile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute role="customer" loginPath="/login/customer">
                <CustomerOrderHistory />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
