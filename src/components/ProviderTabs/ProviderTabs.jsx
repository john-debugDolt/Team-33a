import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import acewinLogo from '../../images/acewinlogo.jpg'
import m8betLogo from '../../images/m8betlogo.jpg'
import funtaLogo from '../../images/funtagaminglogo.jpg'
import dragoonLogo from '../../images/dragoonsoftlogo.jpg'
import vpowerLogo from '../../images/vpowerlogo.jpg'
import allbetLogo from '../../images/allbetlogo.jpg'
import win8Logo from '../../images/win8logo.jpg'
import sexyLogo from '../../images/sexybaccaratlogo.jpg'
import sv388Logo from '../../images/sv388logo.jpg'
import pegasusLogo from '../../images/pegasuslogo.jpg'
import lucky365Logo from '../../images/lucky365logo.jpg'
import jokerLogo from '../../images/jokerlogo.jpg'
import './ProviderTabs.css'

const PROVIDERS = [
  { id: 'all', name: 'All Games', path: '/', logo: null },
  { id: 'advantplay', name: 'AdvantPlay', path: '/advantplay', logo: 'https://xt30sf.b-cdn.net/media/eb0212cc08386317e6000.gif' },
  { id: 'uuslot', name: 'UUSlot', path: '/uuslot', logo: 'https://uuslotsofficial.com/images/logo.png' },
  { id: 'evo888h5', name: 'EVO888H5', path: '/evo888h5', logo: '/providers/evo888h5.jpg' },
  { id: 'clotplay', name: 'ClotPlay', path: '/clotplay', logo: '/providers/clotplay.jpg' },
  { id: 'metagaming', name: 'MetaGaming', path: '/metagaming', logo: 'https://mg.btech4896.com/static/media/loading-logo.8501962f8392b4a44ed7.png' },
  { id: 'wfgaming', name: 'WFGaming', path: '/wfgaming', logo: 'https://imgs.search.brave.com/Ip5Thj11mYAp02XCwDMhX_92_e1zD5kJHiZCAY3duWU/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5saW5rLm1lL2Nk/bi1jZ2kvaW1hZ2Uv/d2lkdGg9MTA5Mixo/ZWlnaHQ9MTA5Mixx/dWFsaXR5PTc1LGZv/cm1hdD13ZWJwL2lt/YWdlcy93ZWJwLWlt/YWdlcy91c2VyLXBy/b2ZpbGUvMTQ2NDIz/OS90bXAtMjQ2Ny0x/NzQ3ODgyNTI3NjA2/LndlYnA' },
  { id: 'megah5', name: 'MegaH5', path: '/megah5', logo: 'https://syarikatcuci.com/wp-content/uploads/2024/11/download.jpeg' },
  { id: 'epicwin', name: 'EpicWin', path: '/epicwin', logo: '/providers/epicwin.jpg' },
  { id: 'richgaming', name: 'RichGaming', path: '/richgaming', logo: 'https://www.richgaming.com/wp-content/uploads/2023/12/rg_logo-2x.png' },
  { id: 'scr888h5', name: 'SCR888H5', path: '/scr888h5', logo: 'https://scr-888.com/logo.webp' },
  { id: 'jdb', name: 'JDB', path: '/jdb', logo: 'https://imgs.search.brave.com/YduaC2JMbt9I_sC0tnmPzrYxRj4IT9J-OQvBmWd_wlc/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9hc3Nl/dHMuc2xvdHNsYXVu/Y2guY29tLzMwNzI4/L0lzWGYzcWZFYjM4/VkcwYjVwb0JpWXpy/VFIyZmpjNS1tZXRh/U2tSQ1gweHZaMjlm/TXpBd2VETXdNQzVx/Y0djPS0uanBn' },
  { id: 'acewin', name: 'AceWin', path: '/acewin', logo: acewinLogo },
  { id: 'funta', name: 'FunTa', path: '/funta', logo: funtaLogo },
  { id: 'dragoon', name: 'Dragoon Soft', path: '/dragoon', logo: dragoonLogo },
  { id: 'vpower', name: 'VPower', path: '/vpower', logo: vpowerLogo },
  { id: 'allbet', name: 'AllBet', path: '/live-casino', logo: allbetLogo },
  { id: 'win8', name: '3win8', path: '/3win8', logo: win8Logo },
  { id: 'pegasus', name: 'Pegasus', path: '/pegasus', logo: pegasusLogo },
  { id: 'lucky365', name: 'Lucky365', path: '/lucky365', logo: lucky365Logo },
  { id: 'joker', name: 'Joker', path: '/joker', logo: jokerLogo },
  { id: 'sexy', name: 'Sexy Baccarat', path: '/live-casino', logo: sexyLogo },
  { id: 'sv388', name: 'SV388', path: '/sports', logo: sv388Logo },
  { id: 'm8bet', name: 'M8BET', path: '/sports', logo: m8betLogo },
]

function ProviderCard({ provider, isActive, onClick }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showLogo = provider.logo && !imgFailed

  return (
    <button
      className={`provider-sponsor-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
      aria-label={provider.name}
      title={provider.name}
    >
      {provider.id === 'all' ? (
        <div className="provider-sponsor-all">
          <span className="provider-sponsor-all-icon">🎮</span>
          <span className="provider-sponsor-all-text">All Games</span>
        </div>
      ) : showLogo ? (
        <img
          src={provider.logo}
          alt={provider.name}
          className="provider-sponsor-logo"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="provider-sponsor-name-fallback">{provider.name}</span>
      )}
    </button>
  )
}

export default function ProviderTabs({ active }) {
  const navigate = useNavigate()
  return (
    <div className="provider-sponsor-strip">
      {PROVIDERS.map((p) => (
        <ProviderCard
          key={p.id}
          provider={p}
          isActive={active === p.id}
          onClick={() => navigate(p.path)}
        />
      ))}
    </div>
  )
}
