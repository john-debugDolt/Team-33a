import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ToastContainer from './components/Toast/Toast'
import Layout from './components/Layout'
import Home from './pages/Home'
import Sports from './pages/Sports'
import LiveCasino from './pages/LiveCasino'
import Slot from './pages/Slot'
import Promotions from './pages/Promotions'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Wallet from './pages/Wallet'
import History from './pages/History'
import LiveChat from './pages/LiveChat'
import Settings from './pages/Settings'
import Terms from './pages/Terms'
import ForgotPassword from './pages/ForgotPassword'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <ToastContainer />
          <Routes>
            {/* Auth Routes - No Layout */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/terms" element={<Terms />} />

            {/* Main Routes - With Layout */}
            <Route path="/*" element={
              <Layout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/sports" element={<Sports />} />
                  <Route path="/live-casino" element={<LiveCasino />} />
                  <Route path="/slot" element={<Slot />} />
                  <Route path="/card-game" element={<Slot />} />
                  <Route path="/fishing" element={<Slot />} />
                  <Route path="/esport" element={<Sports />} />
                  <Route path="/instant-win" element={<Slot />} />
                  <Route path="/promotions" element={<Promotions />} />
                  <Route path="/livechat" element={<LiveChat />} />

                  {/* User Routes - No login required for dev */}
                  <Route path="/wallet" element={<Wallet />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Layout>
            } />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
