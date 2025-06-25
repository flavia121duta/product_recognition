import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ProductRecognition from "./pages/ProductRecognition";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout> <Home /> </Layout> }/>
      <Route path="/login" element={<Layout> <Login /> </Layout> }/>
      <Route path="/product-recognition" element={<Layout> <ProductRecognition /></Layout>}/>
    </Routes>
  );
};

export default App;