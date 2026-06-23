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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/store" element={<Store />} />
        <Route path="/history" element={<CustomerOrderHistory />} />
        <Route path="/track" element={<TrackOrder />} />
        <Route path="/rider" element={<Rider />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)