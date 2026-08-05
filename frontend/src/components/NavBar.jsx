import { NavLink } from 'react-router-dom';
import { useApp } from '../AppContext';

export default function NavBar() {
  const { userId } = useApp();
  const linkClass = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`;

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="brand">🎬 BookMyMovie</NavLink>
        <nav className="nav-links">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <NavLink to="/movies" className={linkClass}>Movies</NavLink>
          <NavLink to="/shows" className={linkClass}>Shows</NavLink>
          <NavLink to="/my-bookings" className={linkClass}>My Bookings</NavLink>
        </nav>
        <span className="user-badge">User #{userId}</span>
      </div>
    </header>
  );
}