import { useState, useEffect } from 'react'
import logo from '../images/team33newlogo.png'
import step1 from '../images/step1.png'
import step2 from '../images/step2.png'
import step3 from '../images/step3.png'
import step4 from '../images/step4.png'
import step5 from '../images/step5.png'
import './DownloadApp.css'

const detectPlatform = () => {
  if (typeof navigator === 'undefined') return 'ios'
  const ua = navigator.userAgent || navigator.vendor || ''
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'ios'
}

const iosSteps = [
  { img: step1, title: 'Open browser menu', desc: 'Tap the menu button at the bottom right of your Safari browser.' },
  { img: step2, title: 'Tap Share', desc: 'In the menu that appears, tap the Share button.' },
  { img: step3, title: 'Add to Home Screen', desc: 'Scroll down and select "Add to Home Screen".' },
  { img: step4, title: 'Confirm and Save', desc: 'Tap the Add (Save) button in the top-right corner to confirm.' },
  { img: step5, title: 'Open the App', desc: 'The Team33 app icon now appears on your home screen — tap to launch.' },
]

const androidSteps = [
  { img: step1, title: 'Open browser menu', desc: 'Tap the three-dot menu in your Chrome browser.' },
  { img: step2, title: 'Tap Install App', desc: 'Select "Install app" or "Add to Home screen" from the menu.' },
  { img: step3, title: 'Confirm Install', desc: 'Tap "Install" in the prompt that appears.' },
  { img: step4, title: 'Wait for setup', desc: 'Android will add the Team33 app to your home screen.' },
  { img: step5, title: 'Open the App', desc: 'Tap the Team33 icon on your home screen to launch.' },
]

export default function DownloadApp() {
  const [platform, setPlatform] = useState('ios')

  useEffect(() => {
    setPlatform(detectPlatform())
  }, [])

  const steps = platform === 'android' ? androidSteps : iosSteps

  return (
    <div className="download-app-page">
      <div className="download-hero">
        <img src={logo} alt="Team33" className="download-logo" />
        <h1 className="download-title">Download the Team33 App</h1>
        <p className="download-subtitle">
          Install Team33 on your phone for the fastest, smoothest play experience —
          no app store required.
        </p>

        <div className="platform-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={platform === 'ios'}
            className={`platform-tab ${platform === 'ios' ? 'active' : ''}`}
            onClick={() => setPlatform('ios')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            iPhone / iPad
          </button>
          <button
            role="tab"
            aria-selected={platform === 'android'}
            className={`platform-tab ${platform === 'android' ? 'active' : ''}`}
            onClick={() => setPlatform('android')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.523 15.341a1.04 1.04 0 1 1-.001-2.08 1.04 1.04 0 0 1 .001 2.08m-11.046 0a1.04 1.04 0 1 1-.001-2.08 1.04 1.04 0 0 1 .001 2.08m11.419-6.02 2.075-3.594a.42.42 0 0 0-.728-.42L17.142 8.95a13 13 0 0 0-5.142-1.05 13 13 0 0 0-5.142 1.05L4.757 5.307a.42.42 0 1 0-.728.42l2.075 3.594C2.541 11.298.5 14.4.5 17.9h23c0-3.5-2.041-6.602-5.604-8.579"/>
            </svg>
            Android
          </button>
        </div>
      </div>

      <ol className="steps-list">
        {steps.map((step, i) => (
          <li className="step-card" key={i}>
            <div className="step-image-wrap">
              <img src={step.img} alt={`Step ${i + 1}: ${step.title}`} className="step-image" />
            </div>
            <div className="step-body">
              <div className="step-number">Step {i + 1}</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="download-footer-note">
        <strong>Tip:</strong> once installed, Team33 opens in fullscreen like a native app.
        No updates needed — you always get the latest version.
      </div>
    </div>
  )
}
