import { createContext, useState, useEffect } from 'react';
import axios from '../../API/axios';
import endpoints from '../../API/endpoints';

// Create the Context
export const UsersContext = createContext();

// Create the Provider component
export const UsersProvider = ({ children }) => {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);

  // Function to fetch users
  const getUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await axios(`${endpoints.users.list}`);
      if (response.data.length === 0) {
        setUsersError('No Users found');
      } else {
        setUsersError(null);
        setUsers(response.data); // Adjust based on the structure of your response
      }
    } catch (error) {
      setUsersError('Error fetching users: ' + error);
      console.error(error);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    getUsers(); // Fetch users when the component mounts
  }, []);

  return (
    <UsersContext.Provider
      value={{
        users,
        usersLoading,
        setUsersLoading,
        usersError,
        setUsersError,
        refreshUsers: getUsers,
      }}
    >
      {children}
    </UsersContext.Provider>
  );
};
