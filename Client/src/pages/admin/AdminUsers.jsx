import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteAdminUser, getAdminUsers } from "../../services/authService.js";
import useAccessibleDialog from "../../components/common/useAccessibleDialog.js";
import "../../styles/AdminUsers.css";

const ROLES = [
  ["", "All"],
  ["candidate", "Candidates"],
  ["employer", "Employers"],
  ["admin", "Admins"],
];

const formatDate = (date) => new Date(date).toLocaleDateString(undefined, {
  day: "numeric", month: "short", year: "numeric",
});

const formatRole = (role) => role.charAt(0).toUpperCase() + role.slice(1);

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const { closeButtonRef, closeDialog, dialogRef, openDialog } = useAccessibleDialog(Boolean(selectedUser), () => setSelectedUser(null));

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((current) => ({ ...current, page: 1 }));
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      setLoading(true);
      setError("");
      setUsers([]);

      try {
        const response = await getAdminUsers({
          page: pagination.page,
          limit: pagination.limit,
          ...(role && { role }),
          ...(search && { search }),
        });

        if (!cancelled) {
          setUsers(response.data.users || []);
          setPagination((current) => ({ ...current, ...response.data.pagination }));
        }
      } catch {
        if (!cancelled) setError("Unable to load users.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadUsers();
    return () => { cancelled = true; };
  }, [pagination.page, pagination.limit, role, search, retryKey]);

  const updateRole = (nextRole) => {
    setRole(nextRole);
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setRole("");
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const filtersActive = Boolean(search || searchInput || role);

  const requestDelete = (user, event) => {
    setDeleteError("");
    setSelectedUser(user);
    openDialog(event.currentTarget);
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAdminUser(selectedUser._id);
      const deletedName = selectedUser.fullName;
      closeDialog();
      setSuccessMessage(`${deletedName}'s account was deleted.`);
      setPagination((current) => ({ ...current, page: current.page > 1 && users.length === 1 ? current.page - 1 : current.page }));
      setRetryKey((key) => key + 1);
    } catch (requestError) {
      setDeleteError(requestError.response?.data?.message || "Unable to delete this account.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="admin-users-page">
        <header className="admin-users-header">
          <div>
            <p className="eyebrow">Administration</p>
            <h1>User Directory</h1>
            <p>Search and review registered platform users.</p>
          </div>
          <Link to="/admin/dashboard">Back to dashboard</Link>
        </header>

        <section className="admin-users-controls" aria-label="User filters">
          <label className="admin-search-field">
            <span>Search users</span>
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by name or email" />
          </label>
          <label className="admin-role-filter">
            <span>Role</span>
            <select value={role} onChange={(event) => updateRole(event.target.value)}>
              {ROLES.map(([value, label]) => <option value={value} key={label}>{label}</option>)}
            </select>
          </label>
          {filtersActive && <button type="button" className="admin-reset-filters" onClick={resetFilters}>Reset filters</button>}
        </section>

        {loading && <section className="admin-users-state" aria-live="polite">Loading users...</section>}

        {!loading && error && (
          <section className="admin-users-state admin-users-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRetryKey((key) => key + 1)}>Retry</button>
          </section>
        )}

        {!loading && !error && (
          <>
            {successMessage && <p className="admin-users-success" role="status">{successMessage}</p>}
            <div className="admin-users-results"><p>Showing {users.length} of {pagination.total} users</p></div>
            {users.length === 0 ? (
              <section className="admin-users-state">
                <p>No users found.</p>
                {filtersActive && <button type="button" onClick={resetFilters}>Reset filters</button>}
              </section>
            ) : (
              <section className="admin-users-table-wrap">
                <table className="admin-users-table">
                  <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Location</th><th>Created Date</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user._id}>
                        <td data-label="Name">{user.fullName}</td>
                        <td data-label="Email">{user.email}</td>
                        <td data-label="Role"><span className={`admin-role-badge role-${user.role}`}>{formatRole(user.role)}</span></td>
                        <td data-label="Location">{user.company?.location || "Not provided"}</td>
                        <td data-label="Created Date">{formatDate(user.createdAt)}</td>
                        <td data-label="Actions">
                          {user.role === "admin" ? <span className="admin-delete-unavailable">Protected</span> : (
                            <button type="button" className="admin-delete-user" onClick={(event) => requestDelete(user, event)}>Delete account</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {pagination.totalPages > 0 && (
              <nav className="admin-users-pagination" aria-label="User pages">
                <button type="button" disabled={pagination.page === 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
                <span>Page {pagination.page} of {pagination.totalPages}</span>
                <button type="button" disabled={pagination.page === pagination.totalPages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
              </nav>
            )}
          </>
        )}
        {selectedUser && (
          <div className="admin-dialog-backdrop" role="presentation">
            <section className="admin-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-account-title" aria-describedby="delete-account-description" ref={dialogRef}>
              <h2 id="delete-account-title">Delete account?</h2>
              <p id="delete-account-description">This permanently deletes <strong>{selectedUser.fullName}</strong> ({selectedUser.email}) and related records.</p>
              {deleteError && <p className="admin-delete-error" role="alert">{deleteError}</p>}
              <div className="admin-delete-actions">
                <button type="button" ref={closeButtonRef} onClick={closeDialog} disabled={deleting}>Cancel</button>
                <button type="button" className="admin-delete-user" onClick={confirmDelete} disabled={deleting}>{deleting ? "Deleting..." : "Delete account"}</button>
              </div>
            </section>
          </div>
        )}
    </main>
  );
}

export default AdminUsers;
