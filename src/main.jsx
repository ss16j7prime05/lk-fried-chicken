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
import AdminLogin from './login/AdminLogin.jsx'
import StoreLogin from './login/StoreLogin.jsx'
import CustomerLogin from './login/CustomerLogin.jsx'
import RiderLogin from './login/RiderLogin.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />

          {/* Login pages */}
          <Route path="/login/admin" element={<AdminLogin />} />
          <Route path="/login/store" element={<StoreLogin />} />
          <Route path="/login/customer" element={<CustomerLogin />} />
          <Route path="/login/rider" element={<RiderLogin />} />

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
            path="/store"
            element={
              <ProtectedRoute role="store" loginPath="/login/store">
                <Store />
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

          <Route path="/history" element={<CustomerOrderHistory />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
