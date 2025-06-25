import mkv_logo from "../assets/mkv_logo.png";
import Button from "./Button";
import { Link } from "react-router-dom";
import "../css/Navbar.css";

function Navbar() {
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

        {/* Actions */}
        <div className="d-flex align-items-center gap-3">
          <Link to="/login" className="text-decoration-none">
            <Button label="Intră în cont" type="secondary" />
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;