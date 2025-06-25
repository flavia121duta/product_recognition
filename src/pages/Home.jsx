import Button from "../components/Button";
import { Link } from "react-router-dom";
import "../css/Home.css";
import business_woman from "../assets/business_woman_with_target.jpg";
import curved_arrow from "../assets/curved_arrow.jpg";
import { useAuth } from "../context/AuthContext";

function Home() {
  const { user } = useAuth();

  return (
    <div className="home-container d-flex align-items-center justify-content-between gap-5">
      {/* Left Column */}
      <div className="home-left">
        <h1 className="mb-3">
          Unlock Market Insights <br /> That Drive Growth
        </h1>
        <p className="mb-4">
          Discover the power of informed decision-making with our comprehensive <br />
          market studies. We provide in-depth analysis to help your business thrive in <br />
          today's competitive landscape.
        </p>

        <div className="position-relative d-inline-block">
          {user ? (
            <Link to="/product-recognition">
              <Button label="Product Recognition" />
            </Link>
          ) : (
            <Link to="/login">
              <Button label="Product Recognition" />
            </Link>
          )}
          <img src={curved_arrow} alt="Arrow" className="curved-arrow" />
        </div>
      </div>

      {/* Right Column */}
      <div className="home-right">
        <img src={business_woman} alt="Business Woman" className="img-fluid rounded" />
      </div>
    </div>
  );
}

export default Home;