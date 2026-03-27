import { createContext, useState, useEffect, useContext } from 'react';
import axios from '../../API/axios';
import endpoints from '../../API/endpoints';
// Create the Context
export const BinsContext = createContext();

// Create the Provider component
export const BinsProvider = ({ children }) => {  
  const [bins, setBins] = useState([]);
  const [binsLoading, setBinsLoading] = useState(true);
  const [binsError, setBinsError] = useState(null);

  // Function to fetch bins
  const getBins = async () => {
    try {
      setBinsLoading(true);
      const response = await axios(`${endpoints.bins.list}`);      
      if (response.data.length === 0) {
        setBinsError('No Bins found');
      } else {
        setBinsError(null);
        setBins(response.data);
      }
    } catch (error) {
      setBinsError('Error fetching bins: ' + error);
      console.error(error);
    } finally {
      setBinsLoading(false);
    }
  };

  useEffect(() => {
    getBins(); // Fetch bins when the component mounts
  }, []);

  return (
    <BinsContext.Provider
      value={{
        bins,
        binsLoading,
        setBinsLoading,
        binsError,
        setBinsError,
        refreshBins: getBins,
      }}
    >
      {children}
    </BinsContext.Provider>
  );
};
