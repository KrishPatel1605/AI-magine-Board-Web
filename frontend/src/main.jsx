import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import AuthPages from "./AuthPages.jsx";

const Main = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = sessionStorage.getItem("supabase_token");
    const storedUser = sessionStorage.getItem("supabase_user");

    if (token && storedUser) {
      try {
        // Try to parse JSON if stored as object
        const parsedUser = JSON.parse(storedUser);
        const email = parsedUser?.email || parsedUser; // fallback if it's just a string
        setUserEmail(email);
        setIsAuthenticated(true);
      } catch (err) {
        console.error("Error parsing user:", err);
      }
    }
    setIsLoading(false);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("supabase_token");
    sessionStorage.removeItem("supabase_user");
    setIsAuthenticated(false);
    setUserEmail(null);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <StrictMode>
      {isAuthenticated ? (
        <App onLogout={handleLogout} userEmail={userEmail} />
      ) : (
        <AuthPages onLoginSuccess={() => setIsAuthenticated(true)} />
      )}
    </StrictMode>
  );
};

createRoot(document.getElementById("root")).render(<Main />);
