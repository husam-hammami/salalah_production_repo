import { createContext, useState, useCallback, useEffect } from 'react';
import axios from '../../API/axios';
import endpoints from '../../API/endpoints';

// Create the context
export const OrdersContext = createContext();

// Provider component
export const OrdersProvider = ({ children }) => {
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);

  // 🔁 Used for soft refresh tracking across components
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 🔄 Fetch the latest orders from backend and return them
  const refreshOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const response = await axios.get(endpoints.orders.list);
      setOrders(response.data);
      setOrdersError(null);
      return response.data; // ✅ return fresh data
    } catch (error) {
      setOrdersError('Failed to load orders.');
      console.error('[❌ OrdersContext Error]', error);
      return []; // fail-safe return
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // 🔥 Trigger soft refresh (use in ActiveOrderDetail or Table)
  const triggerRefresh = () => {
    setRefreshTrigger(prev => {
      const next = prev + 1;
      console.log('[🟢 OrdersContext] Soft refresh triggered. New refreshTrigger =', next);
      return next;
    });
  };

  // 📦 Initial load when context mounts
  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  return (
    <OrdersContext.Provider
      value={{
        orders,
        setOrders,
        ordersLoading,
        setOrdersLoading,
        ordersError,
        refreshOrders,      // fetch and return latest orders
        refreshTrigger,     // trigger value to track UI sync
        triggerRefresh,     // call this to cause soft UI refresh
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
};
