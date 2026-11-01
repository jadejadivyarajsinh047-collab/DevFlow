
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("devflow_token")) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then((response) => setUser(response.data.user))
      .catch(() => {
        localStorage.removeItem("devflow_token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (data) => {
    const response = await api.post("/auth/login", data);
    localStorage.setItem("devflow_token", response.data.token);
    setUser(response.data.user);
  };

  const register = async (data) => {
    const response = await api.post("/auth/register", data);
    localStorage.setItem("devflow_token", response.data.token);
    setUser(response.data.user);
  };

  const updateUser = (updatedUser) => {
    setUser((currentUser) => ({
      ...currentUser,
      ...updatedUser,
    }));
  };

  const logout = () => {
    localStorage.removeItem("devflow_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
