import { createContext, useEffect, useState } from 'react';
import axios from '../API/axios';
import endpoints from '../API/endpoints';
import { toast } from 'react-toastify';
// Create the Auth Context
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const validateUser = async () => {
    try {
      setAuthLoading(true);
      const response = await axios.get(endpoints.auth.checkAuth);
      if (response.data?.authenticated) {
        setAuth(response.data.user_data);
      } else {
        setAuth(null);
      }
    } catch (err) {
      console.error(err);
      setAuth(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    try {
      setAuthLoading(true);
      await axios.post(endpoints.auth.logout);
      setAuth(null);
      toast.success('Logged out!');
    } catch (err) {
      toast.error('Something went wrong, Please try again: ' + err);
      console.error(err);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    validateUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        auth,
        setAuth,
        authLoading,
        setAuthLoading,
        validateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
