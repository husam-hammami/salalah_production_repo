import { useState, useEffect } from 'react';
import axios from '../API/axios';
import { useSocket } from '../Context/SocketContext';

export default function usePlcMonitor({ orderType = 'FCL' } = {}) {
  const mockPlcData = {
    active_destination: {
      bin_id: 30,
      dest_no: 1,
      prd_code: 101
    },
    active_sources: [
      { bin_id: 21, prd_code: 201, is_active: true, produced_qty: 1500 },
      { bin_id: 23, prd_code: 202, is_active: false, produced_qty: 500 },
    ],
    flow_rate: 24.0,
    job_status: 4, // Running
    line_running: true,
    moisture_offset: -3.8,
    moisture_setpoint: 15.8,
    os_comment: "Line Running",
    produced_weight: 0.0,
    receiver: 30,
    water_consumed: 0.0
  };

  const [plcData, setPlcData] = useState(mockPlcData);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { socket } = useSocket ? useSocket() : { socket: null };

  useEffect(() => {
    let cleanupSocket = null;
    if (orderType === 'FCL') {
      setLoading(true);
      if (socket) {
        const onFclData = (msg) => {
          if (msg && typeof msg === 'object') {
            setPlcData({
              active_destination: msg.active_destination || mockPlcData.active_destination,
              active_sources: msg.active_sources || mockPlcData.active_sources,
              flow_rate: Number(msg.flow_rate) || 0,
              moisture_offset: Number(msg.moisture_offset) || 0,
              moisture_setpoint: Number(msg.moisture_setpoint) || 0,
              produced_weight: Number(msg.produced_weight) || 0,
              receiver: Number(msg.receiver) || 0,
              water_consumed: Number(msg.water_consumed) || 0,
              job_status: msg.job_status || 0,
              line_running: msg.line_running || false,
              os_comment: msg.line_running ? 'Line Running' : 'Line Stopped',
            });
            setError(null);
          } else {
            setError('Invalid socket data format');
          }
          setLoading(false);
        };
        socket.on('fcl_data', onFclData);
        cleanupSocket = () => socket.off('fcl_data', onFclData);
      } else {
        // Fallback to REST API
        axios.get('orders/plc/db199-monitor')
          .then(res => {
            if (res.data && res.data.status === 'success' && res.data.data) {
              const d = res.data.data;
              setPlcData({
                active_destination: d.active_destination || mockPlcData.active_destination,
                active_sources: d.active_sources || mockPlcData.active_sources,
                flow_rate: Number(d.flow_rate) || 0,
                moisture_offset: Number(d.moisture_offset) || 0,
                moisture_setpoint: Number(d.moisture_setpoint) || 0,
                produced_weight: Number(d.produced_weight) || 0,
                receiver: Number(d.receiver) || 0,
                water_consumed: Number(d.water_consumed) || 0,
                job_status: d.job_status || 0,
                line_running: d.line_running || false,
                os_comment: d.line_running ? 'Line Running' : 'Line Stopped',
              });
              setError(null);
            } else {
              setError('Invalid API response');
            }
          })
          .catch(() => setError('Failed to fetch FCL data'))
          .finally(() => setLoading(false));
      }
    } else if (orderType === 'SCL' || orderType === 'SDLA') {
      setLoading(true);
      if (socket) {
        const onSclData = (msg) => {
          if (msg && typeof msg === 'object') {
            setPlcData({
              active_destination: {
                bin_id: msg.DestBinId || 0,
                dest_no: msg.DestNo || 0,
                prd_code: msg.PrdCode || 0
              },
              active_sources: Array.isArray(msg.ActiveSources) ? msg.ActiveSources.map(src => ({
                bin_id: src.bin_id,
                prd_code: src.prd_code,
                is_active: src.is_active,
                produced_qty: src.flowrate_kgps || 0,
                qty_percent: src.qty_percent,
                source_index: src.source_index
              })) : [],
              flow_rate: Number(msg.Flowrate) || 0,
              job_status: msg.JobStatusCode || 0,
              line_running: msg.JobStatusCode === 4,
              moisture_offset: Number(msg.MoistureOffset) || 0,
              moisture_setpoint: Number(msg.MoistureSetpoint) || 0,
              os_comment: msg.OS_Comment || '',
              produced_weight: Number(msg.JobQty) || 0,
              receiver: msg.DestBinId || 0,
              water_consumed: 0
            });
            setError(null);
          } else {
            setError('Invalid socket data format');
          }
          setLoading(false);
        };
        socket.on('scl_data', onSclData);
        cleanupSocket = () => socket.off('scl_data', onSclData);
      } else {
        // Fallback to REST API
        axios.get('orders/plc/db299-monitor')
          .then(res => {
            if (res.data && res.data.status === 'success' && res.data.data) {
              const d = res.data.data;
              setPlcData({
                active_destination: {
                  bin_id: d.DestBinId,
                  dest_no: d.DestNo,
                  prd_code: d.PrdCode || 0
                },
                active_sources: Array.isArray(d.ActiveSources) ? d.ActiveSources.map(src => ({
                  bin_id: src.bin_id,
                  prd_code: src.prd_code,
                  is_active: src.is_active,
                  produced_qty: src.flowrate_kgps || 0,
                  qty_percent: src.qty_percent,
                  source_index: src.source_index
                })) : [],
                flow_rate: Number(d.Flowrate) || 0,
                job_status: d.JobStatusCode,
                line_running: d.JobStatusCode === 4,
                moisture_offset: Number(d.MoistureOffset) || 0,
                moisture_setpoint: Number(d.MoistureSetpoint) || 0,
                os_comment: d.OS_Comment || '',
                produced_weight: Number(d.JobQty) || 0,
                receiver: d.DestBinId,
                water_consumed: 0
              });
              setError(null);
            } else {
              setError('Invalid SDLA API response');
            }
          })
          .catch(() => setError('Failed to fetch SDLA data'))
          .finally(() => setLoading(false));
      }
    } else {
      setPlcData(mockPlcData);
      setError(null);
      setLoading(false);
    }
    return () => {
      if (cleanupSocket) cleanupSocket();
    };
  }, [orderType, socket]);

  return { plcData, error, loading };
} 