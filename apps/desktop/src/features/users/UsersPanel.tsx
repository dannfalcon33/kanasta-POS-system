import React, { useState, useEffect } from 'react';
import { api, UserDto, UserSessionDto } from '../../lib/api';
import { useLanguage } from '../../lib/i18n/LanguageContext';

export const UsersPanel: React.FC = () => {
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New user form modal state
  const [showModal, setShowModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'Cashier' | 'Admin'>('Cashier');
  const [creating, setCreating] = useState(false);

  // Sessions modal
  const [selectedUserForSessions, setSelectedUserForSessions] = useState<UserDto | null>(null);
  const [sessions, setSessions] = useState<UserSessionDto[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar usuarios.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (user: UserDto) => {
    try {
      const updated = await api.updateUserStatus(user.id, !user.isActive);
      setUsers(users.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err: any) {
      alert(err.message || 'Error al actualizar estado.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      const created = await api.createUser({
        email: newEmail,
        password: newPassword,
        fullName: newFullName,
        role: newRole,
      });
      setUsers([...users, created]);
      setShowModal(false);
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
    } catch (err: any) {
      alert(err.message || 'Error al crear usuario.');
    } finally {
      setCreating(false);
    }
  };

  const handleViewSessions = async (user: UserDto) => {
    try {
      setSelectedUserForSessions(user);
      setLoadingSessions(true);
      const data = await api.getUserSessions(user.id);
      setSessions(data);
    } catch (err: any) {
      alert(err.message || 'Error al cargar sesiones.');
    } finally {
      setLoadingSessions(false);
    }
  };

  return (
    <div style={{ marginTop: '2rem', width: '100%', maxWidth: '850px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t.users.title}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {t.users.subtitle}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '0.6rem 1.25rem',
            backgroundColor: 'var(--brand-green)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-brand)',
          }}
        >
          {t.users.newUserBtn}
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>{t.users.loadingUsers}</p>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.9rem 1.2rem' }}>{t.users.colName}</th>
                <th style={{ padding: '0.9rem 1.2rem' }}>{t.users.colRole}</th>
                <th style={{ padding: '0.9rem 1.2rem' }}>{t.users.colStatus}</th>
                <th style={{ padding: '0.9rem 1.2rem' }}>{t.users.colLastLogin}</th>
                <th style={{ padding: '0.9rem 1.2rem', textAlign: 'right' }}>{t.users.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.9rem 1.2rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.fullName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '0.9rem 1.2rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: u.role === 'Admin' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                        color: u.role === 'Admin' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {u.role === 'Admin' ? t.users.admin.toUpperCase() : t.users.cashier.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '0.9rem 1.2rem' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.8rem',
                        color: u.isActive ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: u.isActive ? 'var(--success)' : 'var(--danger)' }} />
                      {u.isActive ? t.common.active : t.common.inactive}
                    </span>
                  </td>
                  <td style={{ padding: '0.9rem 1.2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : t.users.noLoginRecords}
                  </td>
                  <td style={{ padding: '0.9rem 1.2rem', textAlign: 'right' }}>
                    <button
                      onClick={() => handleViewSessions(u)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        marginRight: '0.5rem',
                      }}
                    >
                      {t.users.btnSessions}
                    </button>
                    <button
                      onClick={() => handleToggleStatus(u)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border-color)',
                        color: u.isActive ? 'var(--danger)' : 'var(--success)',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      {u.isActive ? t.common.deactivate : t.common.activate}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nuevo Usuario */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '2rem', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: '400px' }}>
            <h4 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>{t.users.modalNewUserTitle}</h4>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{t.users.fieldFullName}</label>
                <input
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{t.users.fieldEmail}</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{t.users.fieldPassword}</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{t.users.fieldRole}</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  style={{ width: '100%', padding: '0.6rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: '#fff' }}
                >
                  <option value="Cashier">{t.users.roleCashier}</option>
                  <option value="Admin">{t.users.roleAdmin}</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '0.6rem 1.1rem', background: '#ffffff', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600 }}
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{ padding: '0.6rem 1.25rem', backgroundColor: 'var(--brand-green)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--shadow-brand)' }}
                >
                  {creating ? t.users.savingUser : t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sesiones */}
      {selectedUserForSessions && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '2rem', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: '550px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                {t.users.sessionsModalTitle}: {selectedUserForSessions.fullName}
              </h4>
              <button onClick={() => setSelectedUserForSessions(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
            </div>
            {loadingSessions ? (
              <p style={{ color: 'var(--text-muted)' }}>{t.users.loadingSessions}</p>
            ) : sessions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>{t.users.noSessionsFound}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {sessions.map((s) => (
                  <div key={s.id} style={{ padding: '0.75rem', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, color: s.loginSuccess ? 'var(--success)' : 'var(--danger)' }}>
                        {s.loginSuccess ? t.users.accessSuccess : `${t.users.accessFailed}: ${s.failureReasonCode || 'Desconocido'}`}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>{s.terminalName || t.users.terminalWeb}</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)' }}>{t.users.sessionStart}: {new Date(s.startedAt).toLocaleString()}</div>
                    {s.endedAt && <div style={{ color: 'var(--text-muted)' }}>{t.users.sessionEnd}: {new Date(s.endedAt).toLocaleString()}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
