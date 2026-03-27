import React, { useEffect, useState } from 'react';
import { Card } from '../ui/card';
import {
  BarChart2,
  TrendingUp,
  CheckCircle,
  ActivitySquare,
  PauseCircle,
  Gauge,
  Truck,
  Warehouse,
  PackageCheck,
  PackagePlus,
  PackageSearch
} from 'lucide-react';
import FclSdlaCharts from './charts/FclSdlaCharts';
import FlowrateBarChart from './charts/FlowrateBarChart';
import FeedTimeLineChart from './charts/FeedTimeLineChart';
import SenderReceiverLineChart from './charts/SenderReceiverLineChart';
import MillAYieldChart from './charts/MillAYieldChart';
import { useSocket } from '../../Context/SocketContext';
import axios from '../../API/axios';

const ReportsContent = () => {
  const [fclOutQty, setFclOutQty] = useState(0);
  const [milaProduced, setMilaProduced] = useState(0);
  const [sdpaProduced, setSdpaProduced] = useState(0);
  const { socket } = useSocket ? useSocket() : { socket: null };

  useEffect(() => {
    let cleanupSocket = null;
    // Socket for real-time updates
    if (socket) {
      const onFclData = (msg) => {
        if (msg && typeof msg === 'object' && Array.isArray(msg.per_bin_weights)) {
          const sum = msg.per_bin_weights.reduce((acc, b) => acc + (b.total_weight || 0), 0);
          setFclOutQty(sum);
        }
      };
      socket.on('fcl_data', onFclData);
      cleanupSocket = () => socket.off('fcl_data', onFclData);
    } else {
      // Fallback: fetch from REST API
      axios.get('orders/archive/fcl/latest').then(res => {
        if (res.data && res.data.status === 'success' && res.data.data && Array.isArray(res.data.data.per_bin_weights)) {
          const sum = res.data.data.per_bin_weights.reduce((acc, b) => acc + (b.total_weight || 0), 0);
          setFclOutQty(sum);
        }
      });
    }
    return () => {
      if (cleanupSocket) cleanupSocket();
    };
  }, [socket]);

  useEffect(() => {
    axios.get('/orders/mila/archive/latest').then(res => {
      if (res.data && res.data.status === 'success' && res.data.data && res.data.data.produced_weight) {
        setMilaProduced(parseFloat(res.data.data.produced_weight));
      }
    });
  }, []);

  useEffect(() => {
    axios.get('/orders/archive/scl/latest').then(res => {
      if (res.data && res.data.status === 'success' && res.data.data && res.data.data.produced_weight) {
        setSdpaProduced(parseFloat(res.data.data.produced_weight));
      }
    });
  }, []);

  return (
   <div className="space-y-6 bg-gray-50 dark:bg-gradient-to-r dark:from-[#0B1F3A] dark:to-[#1F3D63] dark:text-white  rounded-xl">

      <h1 className="text-2xl font-bold text-black dark:text-white">MIL-A</h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-[#121e2c] p-4 min-h-[110px] border dark:border-cyan-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-black dark:text-white">Flowrate Target</h3>
              <p className="text-xl font-bold text-blue-500 dark:text-cyan-400">24,000 kg/h</p>
            </div>
            <TrendingUp className="w-6 h-6 text-blue-500" />
          </div>
        </Card>

        <Card className="bg-white dark:bg-[#121e2c] p-4 min-h-[110px] border dark:border-cyan-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-black dark:text-white">MIL-A produced kg/h</h3>
              <p className="text-xl font-bold text-blue-600 dark:text-cyan-400">{milaProduced.toFixed(3)}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-[#121e2c] p-4 min-h-[110px] border dark:border-cyan-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-black dark:text-white">SDPA Produced weight kg/h</h3>
              <p className="text-xl font-bold text-blue-600 dark:text-cyan-400">{sdpaProduced.toFixed(3)}</p>
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-[#121e2c] p-4 min-h-[110px] border dark:border-cyan-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-black dark:text-white">FCL out material qty per hour</h3>
              <p className="text-xl font-bold text-blue-600 dark:text-cyan-400">{fclOutQty.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</p>
            </div>
            <PackagePlus className="w-6 h-6 text-blue-600" />
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="space-y-6">
        <Card className="bg-white dark:bg-[#121e2c] p-6 border dark:border-cyan-900">
          <h2 className="text-xl font-semibold text-black dark:text-white mb-4">Mill A Yield Chart</h2>
          <MillAYieldChart />
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-white dark:bg-[#121e2c] p-6 border dark:border-cyan-900">
            <h2 className="text-xl font-semibold text-black dark:text-white mb-4">Sender vs Receiver Trend</h2>
            <SenderReceiverLineChart />
          </Card>
          <Card className="bg-white dark:bg-[#121e2c] p-6 border dark:border-cyan-900">
            <h2 className="text-xl font-semibold text-black dark:text-white mb-4">Actual vs Target Feed Time</h2>
            <FeedTimeLineChart />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ReportsContent;
