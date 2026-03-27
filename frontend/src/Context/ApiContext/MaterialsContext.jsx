import { createContext, useState, useEffect } from 'react';
import axios from '../../API/axios';
import endpoints from '../../API/endpoints';

// Create the Context
export const MaterialsContext = createContext();

// Create the Provider component
export const MaterialsProvider = ({ children }) => {
  const [materials, setMaterials] = useState([]);
  const [materialLoading, setMaterialLoading] = useState(true);
  const [materialError, setMaterialError] = useState(null);

  // Function to fetch materials
  const getMaterials = async () => {
    try {
      setMaterialLoading(true);
      const response = await axios(`${endpoints.materials.list}`);
      if (response.data.length === 0) {
        setMaterialError('No Materials found');
      } else {
        setMaterialError(null);
        setMaterials(response.data); // Adjust based on the structure of your response
      }
    } catch (error) {
      setMaterialError('Error fetching materials: ' + error);
      console.error(error);
    } finally {
      setMaterialLoading(false);
    }
  };

  useEffect(() => {
    getMaterials(); // Fetch materials when the component mounts
  }, []);

  return (
    <MaterialsContext.Provider
      value={{
        materials,
        materialLoading,
        setMaterialLoading,
        materialError,
        setMaterialError,
        refreshMaterials: getMaterials,
      }}
    >
      {children}
    </MaterialsContext.Provider>
  );
};
