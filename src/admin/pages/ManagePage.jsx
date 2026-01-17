import { FiFile, FiPlus, FiEdit2, FiTrash2, FiEye } from 'react-icons/fi';

const ManagePage = () => {
  const pages = [
    { id: 1, name: 'Home', slug: '/', status: 'Published', lastModified: '2024-01-15' },
    { id: 2, name: 'About Us', slug: '/about', status: 'Published', lastModified: '2024-01-14' },
    { id: 3, name: 'Terms & Conditions', slug: '/terms', status: 'Published', lastModified: '2024-01-10' },
    { id: 4, name: 'Privacy Policy', slug: '/privacy', status: 'Draft', lastModified: '2024-01-08' },
    { id: 5, name: 'FAQ', slug: '/faq', status: 'Published', lastModified: '2024-01-05' },
  ];

  return (
    <div className="content-inner">
      <div className="page-header">
        <h1><FiFile style={{ marginRight: '10px' }} /> Manage Pages</h1>
        <p>Create and manage website pages</p>
      </div>

      <div className="action-bar">
        <button className="btn btn-primary">
          <FiPlus /> Create New Page
        </button>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Page Name</th>
                <th>URL Slug</th>
                <th>Status</th>
                <th>Last Modified</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.map(page => (
                <tr key={page.id}>
                  <td><strong>{page.name}</strong></td>
                  <td><code>{page.slug}</code></td>
                  <td>
                    <span className={`badge ${page.status === 'Published' ? 'badge-success' : 'badge-warning'}`}>
                      {page.status}
                    </span>
                  </td>
                  <td>{page.lastModified}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button className="btn btn-secondary btn-sm" title="View"><FiEye /></button>
                      <button className="btn btn-primary btn-sm" title="Edit"><FiEdit2 /></button>
                      <button className="btn btn-danger btn-sm" title="Delete"><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .page-header { margin-bottom: 24px; }
        .page-header h1 { display: flex; align-items: center; font-size: 24px; margin-bottom: 8px; }
        .page-header p { color: #666; }
        .action-bar { margin-bottom: 16px; }
        code { background: #f1f1f1; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
      `}</style>
    </div>
  );
};

export default ManagePage;
