import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from '@supabase/supabase-js';
import "./index.css";
import App from "./App.jsx";
import AuthPages from "./AuthPages.jsx";

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const Main = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for OAuth session on mount
    const checkSession = async () => {
      try {
        // Get session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session) {
          // Store session data
          const token = sessionStorage.getItem("supabase_token");
          const storedUser = sessionStorage.getItem("supabase_user");
          
          if (!token || !storedUser) {
            sessionStorage.setItem("supabase_token", session.access_token);
            sessionStorage.setItem("supabase_user", JSON.stringify(session.user));
          }
          
          setUserEmail(session.user.email);
          setIsAuthenticated(true);
        } else {
          // Check sessionStorage as fallback
          const token = sessionStorage.getItem("supabase_token");
          const storedUser = sessionStorage.getItem("supabase_user");

          if (token && storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              const email = parsedUser?.email || parsedUser;
              setUserEmail(email);
              setIsAuthenticated(true);
            } catch (err) {
              console.error("Error parsing user:", err);
            }
          }
        }
      } catch (error) {
        console.error("Session check error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event);
        
        if (event === 'SIGNED_IN' && session) {
          sessionStorage.setItem("supabase_token", session.access_token);
          sessionStorage.setItem("supabase_user", JSON.stringify(session.user));
          setUserEmail(session.user.email);
          setIsAuthenticated(true);
        } else if (event === 'SIGNED_OUT') {
          handleLogout();
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
    
    sessionStorage.removeItem("supabase_token");
    sessionStorage.removeItem("supabase_user");
    setIsAuthenticated(false);
    setUserEmail(null);
  };

  const handleLoginSuccess = async () => {
    // Get the latest session after login
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      sessionStorage.setItem("supabase_token", session.access_token);
      sessionStorage.setItem("supabase_user", JSON.stringify(session.user));
      setUserEmail(session.user.email);
    }
    setIsAuthenticated(true);
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
        <AuthPages onLoginSuccess={handleLoginSuccess} />
      )}
    </StrictMode>
  );
};

createRoot(document.getElementById("root")).render(<Main />);