import { useState, useEffect } from 'react';
import { DashboardHeader } from '../Components/dashboard/DashboardHeader';
import ReportsContent from '../Components/dashboard/ReportsContent';
import MaterialDistributionDoughnut from '../Components/dashboard/charts/MaterialDistributionDoughnut';
import { SetpointChart } from '../Components/dashboard/charts/setpoint-chart';
import { SenderWeightTable } from '../Components/dashboard/charts/sender-weight-table';
import { ReceiverStatus } from '../Components/dashboard/charts/receiver-status';
import { SDLAMetrics } from '../Components/dashboard/charts/sdla-metrics';
import { FCLKPIChart } from '../Components/dashboard/charts/fcl-kpi-chart';
import { Card } from '../Components/ui/card';
import { Badge } from '../Components/ui/badge';
import { Factory, Database, ListTodo, CheckCircle, Activity, Droplet, Settings } from 'lucide-react';
import usePlcMonitor from '../Hooks/usePlcMonitor';
import axios from '../API/axios';
import io from 'socket.io-client';
import { useLenisScroll } from '../Hooks/useLenisScroll.js'; // ✅ Add this

const themeColors = {
  blue: { primary: '#4B92FF', secondary: '#6BA5FF', accent: '#EDF4FF' },
  skyblue: { primary: '#4BB5FF', secondary: '#6BC2FF', accent: '#EDF8FF' },
  green: { primary: '#4CAF50', secondary: '#66BB6A', accent: '#E8F5E9' },
  grey: { primary: '#607D8B', secondary: '#78909C', accent: '#ECEFF1' }
};

export default function Dashboard() {
  useLenisScroll(); // ✅ Add this
  const [selectedTheme, setSelectedTheme] = useState('blue');
  const [selectedOrder, setSelectedOrder] = useState('FCL');
  const { plcData, error, loading } = usePlcMonitor({ orderType: selectedOrder });
  const [summaryData, setSummaryData] = useState({ materials: 0, bins: 0, jobTypes: 0, completedBatches: 0 });
  const [liveWeights, setLiveWeights] = useState({});
  const [fclArchive, setFclArchive] = useState(null);
  const [sclArchive, setSclArchive] = useState(null);
  const [materialsData, setMaterialsData] = useState([]);

  const theme = themeColors[selectedTheme];

  const handleThemeChange = (themeName) => {
    setSelectedTheme(themeName);
    document.documentElement.setAttribute('data-theme', themeName);
    const colors = themeColors[themeName];
    document.documentElement.style.setProperty('--primary-color', colors.primary);
    document.documentElement.style.setProperty('--secondary-color', colors.secondary);
    document.documentElement.style.setProperty('--accent-color', colors.accent);
  };

  const handleOrderChange = (order) => {
    setSelectedOrder(order);
  };

  useEffect(() => {
    handleThemeChange(selectedTheme);
    const fetchSummaryData = async () => {
      try {
        const [materialsRes, binsRes, jobTypesRes] = await Promise.all([
          axios.get('materials'),
          axios.get('bins'),
          axios.get('job-types')
        ]);
        setSummaryData({
          materials: materialsRes.data.length,
          bins: binsRes.data.length,
          jobTypes: jobTypesRes.data.length,
          completedBatches: 1
        });
        
        // Count IN and OUT from category field
        const materials = materialsRes.data;
        let inCount = 0;
        let outCount = 0;
        materials.forEach(material => {
          if (typeof material.category === 'string') {
            const cats = material.category.split(',').map(c => c.trim().toUpperCase());
            if (cats.includes('IN')) inCount++;
            if (cats.includes('OUT')) outCount++;
          }
        });
        
        setMaterialsData([
          { label: 'IN', value: inCount },
          { label: 'OUT', value: outCount }
        ]);
      } catch (err) {
        console.error('Error fetching summary data:', err);
      }
    };
    fetchSummaryData();
  }, []);

  // Fetch live sender weights for FCL
  useEffect(() => {
    if (selectedOrder === 'FCL') {
      axios.get('orders/reporting/db2099')
        .then(res => {
          let weights = {};
          if (res.data && typeof res.data === 'object') {
            if (res.data.data && typeof res.data.data === 'object') {
              weights = res.data.data;
            } else {
              weights = res.data;
            }
            setLiveWeights(weights);
          }
        })
        .catch(() => setLiveWeights({}));
    }
  }, [selectedOrder]);

  // Fetch FCL archive latest (REST API)
  useEffect(() => {
    if (selectedOrder === 'FCL') {
      axios.get('orders/archive/fcl/latest')
        .then(res => {
          if (res.data && res.data.status === 'success' && res.data.data) {
            setFclArchive(res.data.data);
          }
        })
        .catch(() => setFclArchive(null));
    }
  }, [selectedOrder]);

  // Fetch SCL archive latest (REST API)
  useEffect(() => {
    if (selectedOrder === 'SCL') {
      axios.get('orders/archive/scl/latest')
        .then(res => {
          if (res.data && res.data.status === 'success' && res.data.data) {
            setSclArchive(res.data.data);
          }
        })
        .catch(() => setSclArchive(null));
    }
  }, [selectedOrder]);

  // (Disabled) Socket for real-time FCL archive updates: do not update fclArchive after initial load

  // Socket for real-time SCL archive updates
  useEffect(() => {
    if (selectedOrder !== 'SCL') return;
    const socket = io();
    const handleSclData = (msg) => {
      if (msg && typeof msg === 'object') {
        // Update SCL archive with live data
        setSclArchive({
          ...msg,
          produced_weight: msg.JobQty || 0,
          per_bin_weights: msg.ActiveSources ? msg.ActiveSources.map(src => ({
            total_weight: src.flowrate_kgps || 0
          })) : []
        });
      }
    };
    socket.on('scl_data', handleSclData);
    return () => {
      socket.off('scl_data', handleSclData);
      socket.disconnect();
    };
  }, [selectedOrder]);

  const summaryCards = [
    { title: 'Materials', count: summaryData.materials.toString(), icon: Factory },
    { title: 'Bins', count: summaryData.bins.toString(), icon: Database },
    { title: 'Completed Batches', count: summaryData.completedBatches.toString(), icon: CheckCircle },
  ];

  const processMetrics = [
    { label: 'Flow Rate', value: plcData.flow_rate.toFixed(1), unit: 'Current Rate', icon: Activity, unitLabel: 'L/hr' },
    { label: 'Moisture Setpoint', value: plcData.moisture_setpoint.toFixed(1), unit: 'Target Level', icon: Droplet, unitLabel: '%' },
    { label: 'Moisture Offset', value: plcData.moisture_offset.toFixed(1), unit: 'Adjustment', icon: Settings, unitLabel: '%' },
  ];

  const setpointData = [
    { parameter: 'Flow Rate', setpoint: plcData.flow_rate, actual: plcData.flow_rate },
    { parameter: 'Moisture', setpoint: plcData.moisture_setpoint, actual: plcData.moisture_setpoint + plcData.moisture_offset },
    { parameter: 'Temperature', setpoint: 85, actual: 83 }
  ];

  // Merge live weights into senderWeightData
  const senderWeightData = plcData.active_sources.length > 0
    ? plcData.active_sources.map(source => {
        let weight = source.produced_qty;
        // Try to get live weight from reporting API
        if (liveWeights && typeof liveWeights === 'object') {
          // Find by bin_id
          const live = Object.values(liveWeights).find(w => w.bin_id === source.bin_id);
          if (live && typeof live.value === 'number') {
            weight = live.value;
          }
        }
        return {
          bin_id: source.bin_id.toString().padStart(4, '0'),
          product: source.prd_code.toString(),
          weight: weight,
          status: source.is_active ? 'Active' : 'Warning'
        };
      })
    : [{ bin_id: 'EMPTY', product: 'No Active Sources', weight: 0, status: 'Warning' }];

  const receiverData = {
    binId: plcData.active_destination.bin_id.toString().padStart(4, '0'),
    product: 'Output Product',
    location: 'Output Bin',
    weight: plcData.receiver
  };

  const fclData = {
    flow_rate: plcData.flow_rate,
    moisture_setpoint: plcData.moisture_setpoint,
    moisture_offset: plcData.moisture_offset
  };

  // Use sclArchive for produced/consumed weight if available (SCL/SDLA)
  const isScl = selectedOrder === 'SCL' || selectedOrder === 'SDLA';
  const sclProducedWeight = isScl && sclArchive && Array.isArray(sclArchive.per_bin_weights)
    ? sclArchive.per_bin_weights.reduce((sum, bin) => sum + (parseFloat(bin.total_weight) || 0), 0)
    : 0;
  const sclConsumedWeight = isScl && sclArchive && sclArchive.receiver !== undefined
    ? parseFloat(sclArchive.receiver)
    : 0;

  // For FCL, source weight is sum of per_bin_weights, destination is receiver
  const producedWeight = selectedOrder === 'FCL' && fclArchive && Array.isArray(fclArchive.per_bin_weights)
    ? fclArchive.per_bin_weights.reduce((sum, bin) => sum + (parseFloat(bin.total_weight) || 0), 0)
    : 0;
  const consumedWeight = selectedOrder === 'FCL' && fclArchive && fclArchive.receiver !== undefined
    ? parseFloat(fclArchive.receiver)
    : 0;

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-[#0c111b] flex items-center justify-center">
      <div className="text-xl text-gray-600 dark:text-gray-300">Loading dashboard data...</div>
    </div>;
  }

  if (error) {
    return <div className="min-h-screen bg-gray-50 dark:bg-[#0c111b] flex items-center justify-center">
      <div className="text-xl text-red-600">Error loading dashboard: {error}</div>
    </div>;
  }

  return (
   <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-r dark:from-[#0B1F3A] dark:to-[#1F3D63] dark:text-white">

      <DashboardHeader selectedOrder={selectedOrder} onThemeChange={handleThemeChange} onFclChange={handleOrderChange} />

      <div className="container mx-auto p-6">
        {selectedOrder === 'MIL-A' ? (
          <ReportsContent />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {summaryCards.map((card, index) => (
                <Card key={index} className="bg-white dark:bg-[#121e2c] border border-black dark:border-cyan-900">
                  <div className="flex justify-between items-center p-6">
                    <div>
                      <h3 className="text-4xl font-bold" style={{ color: theme.primary }}>{card.count}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{card.title}</p>
                    </div>
                    <div className="p-3 rounded-xl" style={{ backgroundColor: theme.accent }}>
                      <card.icon className="w-6 h-6" style={{ color: theme.primary }} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {processMetrics.map((metric, index) => (
                <Card key={index} className="bg-white dark:bg-[#121e2c] border border-black-300 dark:border-cyan-900">
                  <div className="flex justify-between items-center p-6">
                    <div>
                      <p className="text-gray-600 dark:text-gray-300">{metric.label}</p>
                      <h3 className="text-3xl font-bold" style={{ color: theme.primary }}>{metric.value} <span className="text-base font-medium text-gray-500 dark:text-gray-400">{metric.unitLabel}</span></h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{metric.unit}</p>
                    </div>
                    <div className="p-3 rounded-xl" style={{ backgroundColor: theme.accent }}>
                      <metric.icon className="w-6 h-6" style={{ color: theme.primary }} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="mb-6 bg-white dark:bg-[#121e2c] border border-black-300 dark:border-cyan-900">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-black dark:text-white">Production Status</h2>
                  <Badge variant={plcData.line_running ? "success" : "warning"} className="flex items-center">
                    <span className={`w-2 h-2 ${plcData.line_running ? 'bg-green-500' : 'bg-yellow-500'} rounded-full mr-2`} />
                    {plcData.line_running ? 'Line Running' : 'Line Stopped'}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <h3 className="text-3xl font-bold" style={{ color: theme.primary }}>{selectedOrder === 'FCL' ? producedWeight.toFixed(3) : isScl ? sclProducedWeight.toFixed(3) : plcData.produced_weight.toFixed(1)}</h3>
                    <p className="text-gray-600 dark:text-gray-300">Source kg/hr</p>
                  </div>
                  <div className="text-center">
                    <h3 className="text-3xl font-bold" style={{ color: theme.primary }}>{selectedOrder === 'FCL' ? consumedWeight.toFixed(3) : isScl ? sclConsumedWeight.toFixed(3) : plcData.water_consumed.toFixed(1)}</h3>
                    <p className="text-gray-600 dark:text-gray-300">Destination kg/hr</p>
                  </div>
                  <div className="text-center">
                    <h3 className="text-3xl font-bold" style={{ color: theme.primary }}>94.9</h3>
                    <p className="text-gray-600 dark:text-gray-300">% Efficiency</p>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white dark:bg-[#121e2c] border border-black-300 dark:border-cyan-900">
                <div className="p-6">
                  <MaterialDistributionDoughnut data={materialsData} />
                </div>
              </Card>

              {selectedOrder === 'FCL' ? (
                <Card className="bg-white dark:bg-[#121e2c] border border-black-300 dark:border-cyan-900">
                  <div className="p-6">
                    <FCLKPIChart data={fclData} />
                  </div>
                </Card>
              ) : null}

              <Card className="bg-white dark:bg-[#121e2c] border border-black-300 dark:border-cyan-900">
                <div className="p-6">
                  <SenderWeightTable data={senderWeightData} />
                </div>
              </Card>

              <Card className="bg-white dark:bg-[#121e2c] border border-black-300 dark:border-cyan-900">
                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-4 text-black dark:text-white">Receiver Status</h2>
                  <ReceiverStatus {...receiverData} />
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
