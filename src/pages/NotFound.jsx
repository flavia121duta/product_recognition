import { Link } from "react-router-dom";
import Button from "../components/Button";

function NotFound() {
  return (
    <div className="text-center py-5">
      <h1 className="display-4">404</h1>
      <p className="lead">Oops! Page not found.</p>
      <Link to="/" className="text-decoration-none">
        <Button label="Go Home" />
      </Link>
    </div>
  );
}

export default NotFound;