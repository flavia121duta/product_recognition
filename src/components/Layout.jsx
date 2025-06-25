import Navbar from "./Navbar";
import "../css/App.css";

const Layout = ({ children }) => {
  return (
    <>
      <Navbar />
      <main className="page-wrapper">
        {children}
      </main>
    </>
  );
};

export default Layout;