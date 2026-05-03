import { useNavigate } from 'react-router-dom'
import './ProviderTabs.css'

const PROVIDERS = [
  { id: 'all', name: 'All Games', path: '/', logo: null },
  { id: 'advantplay', name: 'AdvantPlay', path: '/advantplay', logo: 'https://xt30sf.b-cdn.net/media/eb0212cc08386317e6000.gif' },
  { id: 'uuslot', name: 'UUSlot', path: '/uuslot', logo: 'https://uuslotsofficial.com/images/logo.png' },
  { id: 'evo888h5', name: 'EVO888H5', path: '/evo888h5', logo: 'https://evo888h5.com/media/logos/logo.png' },
  { id: 'clotplay', name: 'ClotPlay', path: '/clotplay', logo: 'https://scontent.fmel11-1.fna.fbcdn.net/v/t39.30808-6/488247950_556208077493821_605589263697651606_n.jpg?_nc_cat=107&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=rFbxz2u02nYQ7kNvwHFD1cc&_nc_oc=Ado413tSIFepcnwcfcU8n8ndTt4pGKp0d4MmHuxLMKEAq2DEeopu1U6Vgn6WzTugeHA&_nc_zt=23&_nc_ht=scontent.fmel11-1.fna&_nc_gid=EDnohr6MTEuYtB8jwBNLkw&_nc_ss=7a389&oh=00_Af3T5bhLOwzkV_DlEZaLXzdgi6koIOEhPELHfc9paNi14Q&oe=69D4E906' },
  { id: 'metagaming', name: 'MetaGaming', path: '/metagaming', logo: 'https://mg.btech4896.com/static/media/loading-logo.8501962f8392b4a44ed7.png' },
  { id: 'wfgaming', name: 'WFGaming', path: '/wfgaming', logo: 'https://imgs.search.brave.com/Ip5Thj11mYAp02XCwDMhX_92_e1zD5kJHiZCAY3duWU/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5saW5rLm1lL2Nk/bi1jZ2kvaW1hZ2Uv/d2lkdGg9MTA5Mixo/ZWlnaHQ9MTA5Mixx/dWFsaXR5PTc1LGZv/cm1hdD13ZWJwL2lt/YWdlcy93ZWJwLWlt/YWdlcy91c2VyLXBy/b2ZpbGUvMTQ2NDIz/OS90bXAtMjQ2Ny0x/NzQ3ODgyNTI3NjA2/LndlYnA' },
  { id: 'megah5', name: 'MegaH5', path: '/megah5', logo: 'https://syarikatcuci.com/wp-content/uploads/2024/11/download.jpeg' },
  { id: 'epicwin', name: 'EpicWin', path: '/epicwin', logo: 'https://scontent.fmel11-1.fna.fbcdn.net/v/t39.30808-1/480884666_122095498124793659_7272921045034156473_n.jpg?stp=dst-jpg_s480x480_tt6&_nc_cat=100&ccb=1-7&_nc_sid=2d3e12&_nc_ohc=Bj2Mbbl7hzoQ7kNvwFeW_R3&_nc_oc=AdqJllcIq9KKJ1twdJXzNIxC3DimQNVEjh4u1ArnUTmpCVXJz8Yx5AgDw5OSfOPqq1A&_nc_zt=24&_nc_ht=scontent.fmel11-1.fna&_nc_ss=7a389&oh=00_Af1NVoIqbPqTAp8X6yeObWrkmp8acPXn7pZMhW6rhjIWHA&oe=69EA35C6' },
  { id: 'richgaming', name: 'RichGaming', path: '/richgaming', logo: 'https://www.richgaming.com/wp-content/uploads/2023/12/rg_logo-2x.png' },
  { id: 'scr888h5', name: 'SCR888H5', path: '/scr888h5', logo: 'https://scr-888.com/logo.webp' },
  { id: 'jdb', name: 'JDB', path: '/jdb', logo: 'https://imgs.search.brave.com/YduaC2JMbt9I_sC0tnmPzrYxRj4IT9J-OQvBmWd_wlc/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9hc3Nl/dHMuc2xvdHNsYXVu/Y2guY29tLzMwNzI4/L0lzWGYzcWZFYjM4/VkcwYjVwb0JpWXpy/VFIyZmpjNS1tZXRh/U2tSQ1gweHZaMjlm/TXpBd2VETXdNQzVx/Y0djPS0uanBn' },
]

export default function ProviderTabs({ active }) {
  const navigate = useNavigate()

  return (
    <div className="provider-sponsor-strip">
      {PROVIDERS.map((p) => {
        const isActive = active === p.id
        return (
          <button
            key={p.id}
            className={`provider-sponsor-card ${isActive ? 'active' : ''}`}
            onClick={() => navigate(p.path)}
            aria-label={p.name}
            title={p.name}
          >
            {p.logo ? (
              <img
                src={p.logo}
                alt={p.name}
                className="provider-sponsor-logo"
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              <div className="provider-sponsor-all">
                <span className="provider-sponsor-all-icon">🎮</span>
                <span className="provider-sponsor-all-text">All Games</span>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
