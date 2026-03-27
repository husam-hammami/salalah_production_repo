import { createContext, useState, useCallback, useEffect } from 'react';
import axios from '../../API/axios';

// ✅ Feeder Orders Context
export const FeederOrdersContext = createContext();

// ✅ Provider Component
export const FeederOrdersProvider = ({ children }) => {
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

const refreshOrders = useCallback(async ({ signal } = {}) => {
  setOrdersLoading(true);
  try {
    const response = await axios.get('/orders/feeder-orders', { signal });
    console.log('[✅ API Response]', response.data);
    setOrders(response.data || []);
    setOrdersError(null);
    return response.data;
  } catch (error) {
    if (error?.code === 'ERR_CANCELED') {
      console.warn('[⚠️ Request Cancelled]', error.message);
    } else {
      console.error('[❌ FeederOrdersContext Error]', error);
      setOrdersError('Failed to load feeder orders.');
    }
    return [];
  } finally {
    setOrdersLoading(false);
  }
}, []);

  // 🔁 Soft refresh trigger
  const triggerRefresh = () => {
    setRefreshTrigger(prev => {
      const next = prev + 1;
      console.log('[🟢 FeederOrdersContext] Soft refresh triggered. New refreshTrigger =', next);
      return next;
    });
  };

  // 📦 Initial load on mount
  useEffect(() => {
    const controller = new AbortController();
    refreshOrders({ signal: controller.signal });
    return () => controller.abort();
  }, [refreshOrders]);

  return (
    <FeederOrdersContext.Provider
      value={{
        orders,
        setOrders,
        ordersLoading,
        setOrdersLoading,
        ordersError,
        refreshOrders,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </FeederOrdersContext.Provider>
  );
};
