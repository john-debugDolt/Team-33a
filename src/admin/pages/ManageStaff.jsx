import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiShield, FiSave, FiCheck, FiAlertCircle, FiInbox } from 'react-icons/fi';

const STAFF_KEY = 'team33_admin_staff';

const defaultRoles = [
  { name: 'Super Admin', permissions: 'Full Access', color: 'purple' },
  { name: 'Manager', permissions: 'Members, Reports, Settings', color: 'blue' },
  { name: 'Finance', permissions: 'Deposits, Withdrawals, Reports', color: 'green' },
  { name: 'Support', permissions: 'Members (View), Chat Support', color: 'orange' },
];

const ManageStaff = () => {
  const [staff, setStaff] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({ username: '', name: '', email: '', role: 'Support', status: 'Active' });

  // Load staff from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STAFF_KEY);
      if (stored) {
        setStaff(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading staff:', e);
    }
  }, []);

  // Save staff to localStorage
  const saveStaff = (newStaff) => {
    setStaff(newStaff);
    localStorage.setItem(STAFF_KEY, JSON.stringify(newStaff));
  };

  // Add/Update staff
  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingStaff) {
      const updated = staff.map(s => s.id === editingStaff.id ? { ...s, ...formData } : s);
      saveStaff(updated);
    } else {
      const newMember = { ...formData, id: Date.now(), lastLogin: 'Never' };
      saveStaff([...staff, newMember]);
    }
    setShowModal(false);
    setEditingStaff(null);
    resetForm();
  };

  // Delete staff
  const handleDelete = (member) => {
    if (member.role === 'Super Admin') return;
    if (!confirm(`Delete staff member ${member.name}?`)) return;
    saveStaff(staff.filter(s => s.id !== member.id));
  };

  // Open edit modal
  const openEdit = (member) => {
    setEditingStaff(member);
    setFormData({ username: member.username, name: member.name, email: member.email, role: member.role, status: member.status });
    setShowModal(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({ username: '', name: '', email: '', role: 'Support', status: 'Active' });
  };

  return (
    <div className="manage-staff-page">
      <div className="page-header">
        <h1 className="page-title">Manage Staff</h1>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <FiPlus /> Add Staff
        </button>
      </div>

      {/* Notice Banner */}
      <div style={{
        padding: '12px 16px',
        background: '#fef3c7',
        border: '1px solid #fcd34d',
        borderRadius: '8px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        color: '#92400e',
        fontSize: '13px'
      }}>
        <FiAlertCircle />
        <span>Staff data is stored locally. Backend API integration required for production use.</span>
      </div>

      {/* Roles Overview */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        {defaultRoles.map((role, index) => (
          <div key={index} className="stat-card">
            <div className={`stat-icon ${role.color}`}><FiShield /></div>
            <div className="stat-info">
              <h4>{role.name}</h4>
              <p style={{ fontSize: '12px', color: '#6b7280' }}>{role.permissions}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Staff Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Staff Members ({staff.length})</h3>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Role</th>
                <th>Email</th>
                <th>Last Login</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    <FiInbox size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                    <p style={{ margin: 0 }}>No staff members. Click "Add Staff" to create one.</p>
                  </td>
                </tr>
              ) : (
                staff.map((member) => (
                  <tr key={member.id}>
                    <td style={{ fontWeight: 600 }}>{member.username}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a1a2e', fontWeight: 600, fontSize: '14px' }}>
                          {member.name?.charAt(0) || '?'}
                        </div>
                        {member.name}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${member.role === 'Super Admin' ? 'badge-info' : member.role === 'Manager' ? 'badge-warning' : member.role === 'Finance' ? 'badge-success' : 'badge-secondary'}`}>
                        {member.role}
                      </span>
                    </td>
                    <td>{member.email}</td>
                    <td style={{ color: '#6b7280' }}>{member.lastLogin || 'Never'}</td>
                    <td>
                      <span className={`badge ${member.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{member.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => openEdit(member)}><FiEdit2 /></button>
                        <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDelete(member)} disabled={member.role === 'Super Admin'}><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', width: '90%', maxWidth: '450px' }}>
            <h3 style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>{editingStaff ? 'Edit Staff' : 'Add Staff'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Username *</label>
                <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Full Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Email *</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }} />
              </div>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Role</label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                    {defaultRoles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingStaff(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary"><FiSave /> {editingStaff ? 'Update' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageStaff;
