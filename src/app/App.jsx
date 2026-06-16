import { useEffect, useState } from "react";
import Home from "./pages/Home.jsx";
import Admin from "./pages/Admin.jsx";

export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    function handleLocationChange() {
      setPath(window.location.pathname);
    }

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("cloudnav:navigate", handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("cloudnav:navigate", handleLocationChange);
    };
  }, []);

  function navigate(nextPath) {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new Event("cloudnav:navigate"));
  }

  const isAdmin = path.startsWith("/admin");

  return isAdmin ? <Admin /> : <Home onNavigate={navigate} />;
}
