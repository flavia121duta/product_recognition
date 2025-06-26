import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ProductRecognition from "./pages/ProductRecognition";
import NotFound from "./pages/NotFound";
import PrivateRoute from "./pages/PrivateRoute";
import AboutApp from "./pages/AboutApp";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout> <Home /> </Layout> }/>
      <Route path="/login" element={<Layout> <Login /> </Layout> }/>
      <Route path="/product-recognition" element={<PrivateRoute><Layout><ProductRecognition /></Layout></PrivateRoute>}/>
      <Route path="/about-app" element={<Layout> <AboutApp /> </Layout> }/>
      <Route path="*" element={<Layout><NotFound /></Layout>} />
    </Routes>
  );
};

export default App;