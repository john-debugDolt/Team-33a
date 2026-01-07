import './LoadingSpinner.css';

export default function LoadingSpinner({
  size = 'medium', // small, medium, large
  text = '',
  fullScreen = false,
  overlay = false
}) {
  const spinner = (
    <div className={`spinner spinner-${size}`}>
      <div className="spinner-ring"></div>
      <div className="spinner-ring"></div>
      <div className="spinner-ring"></div>
    </div>
  );

  if (fullScreen || overlay) {
    return (
      <div className={`loading-container ${fullScreen ? 'full-screen' : ''} ${overlay ? 'overlay' : ''}`}>
        {spinner}
        {text && <p className="loading-text">{text}</p>}
      </div>
    );
  }

  return (
    <div className="loading-inline">
      {spinner}
      {text && <span className="loading-text">{text}</span>}
    </div>
  );
}

// Simple inline spinner for buttons
export function ButtonSpinner() {
  return (
    <span className="button-spinner">
      <span className="button-spinner-dot"></span>
      <span className="button-spinner-dot"></span>
      <span className="button-spinner-dot"></span>
    </span>
  );
}
