import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';

export default function NavBar() {
  const { user, logout } = useApp();
  const navigate = useNavigate();
  const linkClass = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="brand">🎬 BookMyMovie</NavLink>
        <nav className="nav-links">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/movies" className={linkClass}>Movies</NavLink>
          <NavLink to="/shows" className={linkClass}>Shows</NavLink>
          {user && <NavLink to="/my-bookings" className={linkClass}>My Bookings</NavLink>}
          {user?.is_admin && <NavLink to="/admin" className={linkClass}>Admin</NavLink>}
        </nav>
        {user ? (
          <div className="user-menu">
            <span className="user-badge">{user.name}</span>
            <button className="logout-btn" onClick={handleLogout}>Log Out</button>
          </div>
        ) : (
          <NavLink to="/login" className="btn-login">Log In</NavLink>
        )}
      </div>
    </header>
  );
}