import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from '../context/TranslationContext';
import { authService } from '../services/authService';
import { ButtonSpinner } from '../components/LoadingSpinner/LoadingSpinner';
import AuthPrompt from '../components/AuthPrompt/AuthPrompt';
import './Settings.css';

export default function Settings() {
  const navigate = useNavigate();
  const { user, isAuthenticated, updateProfile, logout } = useAuth();
  const { showToast } = useToast();
  const { t, currentLanguage, changeLanguage, languages } = useTranslation();

  // All hooks must be called before any conditional returns
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);

  // Profile form - use external API fields (firstName, lastName, email, phone)
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || user?.phoneNumber || '',
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Preferences
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    smsNotifications: false,
    promotionalEmails: true,
  });

  // Show auth prompt if not logged in (after all hooks)
  if (!isAuthenticated) {
    return (
      <AuthPrompt
        title={t('accountSettings')}
        message={t('pleaseLoginToContinue')}
        icon="settings"
      />
    )
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await updateProfile(profileForm);
    if (result.success) {
      showToast(t('profileUpdated'), 'success');
    } else {
      showToast(result.message || t('error'), 'error');
    }

    setLoading(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast(t('error'), 'error');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      showToast(t('error'), 'error');
      return;
    }

    setLoading(true);

    const result = await authService.changePassword(
      passwordForm.currentPassword,
      passwordForm.newPassword
    );

    if (result.success) {
      showToast(t('passwordChanged'), 'success');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } else {
      showToast(result.message || t('error'), 'error');
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    showToast(t('logoutSuccess'), 'success');
    navigate('/');
  };

  return (
    <div className="settings-page">
      <div className="settings-hero">
        <h1>{t('settings')}</h1>
        <p>{t('accountSettings')}</p>
      </div>

      <div className="settings-container">
        {/* Tabs */}
        <div className="settings-tabs">
          <button
            className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            {t('profileInfo')}
          </button>
          <button
            className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            {t('security')}
          </button>
          <button
            className={`tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            {t('notifications')}
          </button>
        </div>

        {/* Content */}
        <div className="settings-content">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="settings-section">
              <h2>{t('profileInfo')}</h2>
              <p className="section-desc">{t('accountSettings')}</p>

              <form onSubmit={handleProfileUpdate}>
                <div className="form-row-inline">
                  <div className="form-group">
                    <label>{t('firstName') || 'First Name'}</label>
                    <input
                      type="text"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                      placeholder="Enter first name"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('lastName') || 'Last Name'}</label>
                    <input
                      type="text"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                      placeholder="Enter last name"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    placeholder="Enter email"
                    disabled
                    className="input-disabled"
                  />
                  <span className="input-hint">Email cannot be changed</span>
                </div>

                <div className="form-group">
                  <label>{t('mobileNo')}</label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder={t('enterPhone')}
                    disabled
                    className="input-disabled"
                  />
                  <span className="input-hint">Phone number is verified and cannot be changed</span>
                </div>

                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? <ButtonSpinner /> : t('saveChanges')}
                </button>
              </form>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="settings-section">
              <h2>{t('changePassword')}</h2>
              <p className="section-desc">{t('security')}</p>

              <form onSubmit={handlePasswordChange}>
                <div className="form-group">
                  <label>{t('currentPassword')}</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    placeholder={t('currentPassword')}
                  />
                </div>

                <div className="form-group">
                  <label>{t('newPassword')}</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder={t('newPassword')}
                    minLength={6}
                  />
                </div>

                <div className="form-group">
                  <label>{t('confirmPassword')}</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder={t('confirmPassword')}
                    minLength={6}
                  />
                </div>

                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? <ButtonSpinner /> : t('updatePassword')}
                </button>
              </form>

              <div className="danger-zone">
                <h3>{t('logout')}</h3>
                <p>{t('deleteAccountWarning')}</p>
                <button className="logout-btn" onClick={handleLogout}>
                  {t('logout')}
                </button>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="settings-section">
              <h2>{t('notifications')}</h2>
              <p className="section-desc">{t('accountSettings')}</p>

              <div className="preference-group">
                <div className="preference-item">
                  <div className="preference-info">
                    <span className="preference-label">{t('emailNotifications')}</span>
                    <span className="preference-desc">{t('notifications')}</span>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={preferences.emailNotifications}
                      onChange={(e) => setPreferences({ ...preferences, emailNotifications: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="preference-item">
                  <div className="preference-info">
                    <span className="preference-label">{t('smsNotifications')}</span>
                    <span className="preference-desc">{t('notifications')}</span>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={preferences.smsNotifications}
                      onChange={(e) => setPreferences({ ...preferences, smsNotifications: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="preference-item">
                  <div className="preference-info">
                    <span className="preference-label">{t('pushNotifications')}</span>
                    <span className="preference-desc">{t('promotions')}</span>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={preferences.promotionalEmails}
                      onChange={(e) => setPreferences({ ...preferences, promotionalEmails: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <h2 style={{ marginTop: '32px' }}>{t('language')}</h2>
              <p className="section-desc">{t('translate')}</p>

              <div className="form-group">
                <select
                  value={currentLanguage}
                  onChange={(e) => changeLanguage(e.target.value)}
                >
                  {languages.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="save-btn"
                onClick={() => showToast(t('success'), 'success')}
              >
                {t('saveChanges')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
