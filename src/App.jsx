import { lazy, Suspense, Component } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { TranslationProvider } from './context/TranslationContext'
import ToastContainer from './components/Toast/Toast'
import Layout from './components/Layout'
import './App.css'

// Retry logic for lazy imports - helps with network issues
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    const pageAlreadyRefreshed = JSON.parse(
      sessionStorage.getItem('page_already_refreshed') || 'false'
    )

    try {
      const component = await componentImport()
      sessionStorage.setItem('page_already_refreshed', 'false')
      return component
    } catch (error) {
      if (!pageAlreadyRefreshed) {
        sessionStorage.setItem('page_already_refreshed', 'true')
        window.location.reload()
      }
      throw error
    }
  })

// Lazy load page components with retry logic for better reliability
const Home = lazyWithRetry(() => import('./pages/Home'))
const Sports = lazyWithRetry(() => import('./pages/Sports'))
const LiveCasino = lazyWithRetry(() => import('./pages/LiveCasino'))
const Slot = lazyWithRetry(() => import('./pages/Slot'))
const Promotions = lazyWithRetry(() => import('./pages/Promotions'))
const Login = lazyWithRetry(() => import('./pages/Login'))
const Signup = lazyWithRetry(() => import('./pages/Signup'))
const Wallet = lazyWithRetry(() => import('./pages/Wallet'))
const History = lazyWithRetry(() => import('./pages/History'))
const LiveChat = lazyWithRetry(() => import('./pages/LiveChat'))
const Settings = lazyWithRetry(() => import('./pages/Settings'))
const Terms = lazyWithRetry(() => import('./pages/Terms'))
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'))
const ReferFriend = lazyWithRetry(() => import('./pages/ReferFriend'))

// Error boundary for catching lazy load failures
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Page load error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-error">
          <div className="error-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
          </div>
          <h2>Something went wrong</h2>
          <p>Failed to load this page. Please try again.</p>
          <button onClick={() => window.location.reload()}>
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Loading spinner component
const PageLoader = () => (
  <div className="page-loader">
    <div className="loader-spinner"></div>
  </div>
)

// Layout wrapper for pages that need it
const WithLayout = ({ children }) => (
  <Layout>
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
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
