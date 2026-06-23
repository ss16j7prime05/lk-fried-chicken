import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

import App from './App.jsx'
import Orders from './orders.jsx'
import CustomerOrderHistory from './CustomerOrderHistory.jsx'
import TrackOrder from './TrackOrder.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/history" element={<CustomerOrderHistory />} />
        <Route path="/track" element={<TrackOrder />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)