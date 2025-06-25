import mkv_logo from "../assets/mkv_logo.png";
import { NavLink, Link, useNavigate  } from "react-router-dom";
import "../css/Navbar.css";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import Button from "../components/Button";

function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <nav className="navbar-wrapper bg-light shadow-sm py-3">
      <div className="navbar-inner d-flex justify-content-between align-items-center px-4">
        {/* Logo */}
        <div className="navbar__logo d-flex align-items-center">
          <Link to="/" className="text-decoration-none">
            <img
              src={mkv_logo}
              alt="Market Vector logo"
              style={{ height: "100px", objectFit: "contain" }}
            />
          </Link>
        </div>

        {/* Nav Links */}
        <ul className="d-flex gap-5 list-unstyled mb-0 align-items-center">
          <li>
            <NavLink to="/" className={({ isActive }) => `nav-link text-dark ${isActive ? "active" : ""}`}>Home</NavLink>
          </li>

          {user && (
            <>
              <li>
                <NavLink to="/product-recognition" className={({ isActive }) => `nav-link text-dark ${isActive ? "active" : ""}`}>Product Recognition</NavLink>
              </li>
            </>
          )}

          <li>
            <NavLink to="/company" className={({ isActive }) => `nav-link text-dark ${isActive ? "active" : ""}`}>Company</NavLink>
          </li>

          <li>
            <NavLink to="/other-projects" className={({ isActive }) => `nav-link text-dark ${isActive ? "active" : ""}`}>Other Projects</NavLink>
          </li>

          <li>
            <NavLink to="/about-app" className={({ isActive }) => `nav-link text-dark ${isActive ? "active" : ""}`}>About App</NavLink>
          </li>

          {/* Auth Buttons */}
          <li>
            {user ? (
              <Button label = "Logout" type = "secondary" onClick={handleLogout} />
            ) : (
              <NavLink to="/login" className="text-decoration-none">
                <Button label = "Login" type = "secondary" />
              </NavLink>
            )}
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;