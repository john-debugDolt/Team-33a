import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { TranslationProvider } from './context/TranslationContext'
import ToastContainer from './components/Toast/Toast'
import Layout from './components/Layout'
import './App.css'

// Lazy load page components for better performance
const Home = lazy(() => import('./pages/Home'))
const Sports = lazy(() => import('./pages/Sports'))
const LiveCasino = lazy(() => import('./pages/LiveCasino'))
const Slot = lazy(() => import('./pages/Slot'))
const Promotions = lazy(() => import('./pages/Promotions'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const Wallet = lazy(() => import('./pages/Wallet'))
const History = lazy(() => import('./pages/History'))
const LiveChat = lazy(() => import('./pages/LiveChat'))
const Settings = lazy(() => import('./pages/Settings'))
const Terms = lazy(() => import('./pages/Terms'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ReferFriend = lazy(() => import('./pages/ReferFriend'))

// Loading spinner component
const PageLoader = () => (
  <div className="page-loader">
    <div className="loader-spinner"></div>
  </div>
)

// Layout wrapper for pages that need it
const WithLayout = ({ children }) => (
  <Layout>
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  </Layout>
)

function App() {
  return (
    <TranslationProvider>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <ToastContainer />
            <Suspense fallback={<PageLoader />}>
              <Routes>
              {/* Auth Routes - With Layout */}
              <Route path="/login" element={<WithLayout><Login /></WithLayout>} />
              <Route path="/signup" element={<WithLayout><Signup /></WithLayout>} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/terms" element={<Terms />} />

              {/* Main Routes - With Layout */}
              <Route path="/" element={<WithLayout><Home /></WithLayout>} />
              <Route path="/sports" element={<WithLayout><Sports /></WithLayout>} />
              <Route path="/live-casino" element={<WithLayout><LiveCasino /></WithLayout>} />
              <Route path="/slot" element={<WithLayout><Slot /></WithLayout>} />
              <Route path="/card-game" element={<WithLayout><Slot /></WithLayout>} />
              <Route path="/fishing" element={<WithLayout><Slot /></WithLayout>} />
              <Route path="/esport" element={<WithLayout><Sports /></WithLayout>} />
              <Route path="/instant-win" element={<WithLayout><Slot /></WithLayout>} />
              <Route path="/promotions" element={<WithLayout><Promotions /></WithLayout>} />
              <Route path="/livechat" element={<WithLayout><LiveChat /></WithLayout>} />

              {/* User Routes - No login required for dev */}
              <Route path="/wallet" element={<WithLayout><Wallet /></WithLayout>} />
              <Route path="/history" element={<WithLayout><History /></WithLayout>} />
              <Route path="/settings" element={<WithLayout><Settings /></WithLayout>} />
              <Route path="/refer" element={<WithLayout><ReferFriend /></WithLayout>} />
              </Routes>
            </Suspense>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </TranslationProvider>
  )
}

export default App
