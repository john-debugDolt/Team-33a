import { useNavigate } from 'react-router-dom'
import { getCachedIp } from '../services/geoIpService'
import './VpnRequired.css'

export default function VpnRequired() {
  const navigate = useNavigate()
  const ip = getCachedIp()

  return (
    <div className="vpn-required-page">
      <div className="vpn-required-card">
        <div className="vpn-required-icon">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </div>

        <h1 className="vpn-required-title">VPN Required</h1>

        <p className="vpn-required-lead">
          JDB games are not available in Australia.
        </p>

        <p className="vpn-required-detail">
          Your IP appears to be from <strong>Australia</strong>
          {ip && <span className="vpn-required-ip"> ({ip})</span>}.
          To play JDB games, please connect to a VPN with a non-Australian IP
          and refresh the page.
        </p>

        <ol className="vpn-required-steps">
          <li>Open your VPN app and connect to a non-Australian server.</li>
          <li>Refresh this page.</li>
          <li>Open the JDB lobby again — the warning will be gone.</li>
        </ol>

        <div className="vpn-required-actions">
          <button
            className="vpn-required-home-btn"
            onClick={() => navigate('/')}
          >
            ← Return to Homepage
          </button>
        </div>
      </div>
    </div>
  )
}
