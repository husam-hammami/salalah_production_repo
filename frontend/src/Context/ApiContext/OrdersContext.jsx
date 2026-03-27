import { createContext, useState, useEffect } from 'react';
import axios from '../../API/axios';
import endpoints from '../../API/endpoints';

// Create the Context
export const OrdersContext = createContext();

// Create the Provider component
export const OrdersProvider = ({ children }) => {
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(null);

  // Function to fetch orders
  const getOrders = async () => {
    try {
      setOrdersLoading(true);
      const response = await axios(`${endpoints.orders.list}`);
      if (response.data.length === 0) {
        setOrdersError('No Job Types found');
      } else {
        setOrdersError(null);
        setOrders(response.data); // Adjust based on the structure of your response
      }
    } catch (error) {
      setOrdersError('Error fetching orders: ' + error);
      console.error(error);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    getOrders(); // Fetch orders when the component mounts
  }, []);

  return (
    <OrdersContext.Provider
      value={{
        orders,
        ordersLoading,
        setOrders, // ✅ Add this line
        setOrdersLoading,
        ordersError,
        setOrdersError,
        refreshOrders: getOrders,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
};
