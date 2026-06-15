import Home from "./pages/Home.jsx";
import Admin from "./pages/Admin.jsx";

export default function App() {
  const isAdmin = window.location.pathname.startsWith("/admin");

  return isAdmin ? <Admin /> : <Home />;
}
