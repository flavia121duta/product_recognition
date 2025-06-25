import Button from "../components/Button";
import Navbar from "../components/Navbar";
import { Link } from "react-router-dom";
import "../css/Home.css";

function Home() {
    return (
        <div>
            <h1>Welcome</h1>
            <p>This is the home page.</p>
                <Link to="/product-recognition">
                    <Button label="Product Recognition" />
                </Link>
        </div>
    );
}

export default Home;