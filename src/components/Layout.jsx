import Navbar from "./Navbar";
import Footer from "./Footer";
import "../css/App.css";

const Layout = ({ children }) => {
  return (
    <>
      <Navbar />
      <main className="page-wrapper">
        {children}
      </main>
      {/* <Footer /> */}
    </>
  );
};

export default Layout;