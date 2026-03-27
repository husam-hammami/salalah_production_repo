// src/hooks/usePowerMonitor.js
import { useEffect, useState, useRef } from "react";
import { useSocket } from "../Context/SocketContext";

export default function usePowerMonitor(refreshInterval = 5000) {
  const [data, setData] = useState({});
  const [status, setStatus] = useState("idle"); // 'idle' | 'loading' | 'success' | 'error'
  const [error, setError] = useState(null);
  const { socket, isConnected } = useSocket();
  const intervalRef = useRef(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/orders/read-power-monitor");
      const json = await res.json();

      if (json.status === "success") {
        setData(json.data);
        setStatus("success");
        setError(null);
      } else {
        throw new Error(json.message || "Unknown error");
      }
    } catch (err) {
      setError(err);
      setStatus("error");
    }
  };

  // Initial data fetch
  useEffect(() => {
    setStatus("loading");
    fetchData();
  }, []);

  // WebSocket real-time updates
  useEffect(() => {
    if (socket && isConnected) {
      // Listen for power monitor data updates
      const handlePowerData = (powerData) => {
        if (powerData && powerData.data) {
          setData(powerData.data);
          setStatus("success");
          setError(null);
        }
      };

      socket.on('power_monitor_data', handlePowerData);

      // Request initial data via WebSocket
      socket.emit('request_power_monitor_data');

      return () => {
        socket.off('power_monitor_data', handlePowerData);
      };
    }
  }, [socket, isConnected]);

  // Polling fallback when WebSocket is not available
  useEffect(() => {
    if (!isConnected) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Set up polling interval
      intervalRef.current = setInterval(() => {
        fetchData();
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else {
      // Clear polling when WebSocket is connected
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isConnected, refreshInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { data, status, error, isConnected };
}
