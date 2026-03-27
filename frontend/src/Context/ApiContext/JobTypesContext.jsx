import { createContext, useState, useEffect } from 'react';
import axios from '../../API/axios';
import endpoints from '../../API/endpoints';

// Create the Context
export const JobTypesContext = createContext();

// Create the Provider component
export const JobTypesProvider = ({ children }) => {
  const [jobTypes, setJobTypes] = useState([]);
  const [jobTypesLoading, setJobTypesLoading] = useState(true);
  const [jobTypesError, setJobTypesError] = useState(null);

  // Function to fetch jobTypes
  const getJobTypes = async () => {
    try {
      setJobTypesLoading(true);
      const response = await axios(`${endpoints.jobTypes.list}`);
      if (response.data.length === 0) {
        setJobTypesError('No Job Types found');
      } else {
        setJobTypesError(null);
        setJobTypes(response.data); // Adjust based on the structure of your response
      }
    } catch (error) {
      setJobTypesError('Error fetching jobTypes: ' + error);
      console.error(error);
    } finally {
      setJobTypesLoading(false);
    }
  };

  useEffect(() => {
    getJobTypes(); // Fetch jobTypes when the component mounts
  }, []);

  return (
    <JobTypesContext.Provider
      value={{
        jobTypes,
        jobTypesLoading,
        setJobTypesLoading,
        jobTypesError,
        setJobTypesError,
        refreshJobTypes: getJobTypes,
      }}
    >
      {children}
    </JobTypesContext.Provider>
  );
};
