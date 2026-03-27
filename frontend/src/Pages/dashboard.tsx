import { useState } from 'react';
import { Box } from '@mui/material';
import { DashboardHeader } from '../Components/dashboard/DashboardHeader';
import { MaterialChart } from '../Components/dashboard/charts/material-chart';
import { SetpointChart } from '../Components/dashboard/charts/setpoint-chart';
import { SenderWeightTable } from '../Components/dashboard/charts/sender-weight-table';
import { ReceiverStatus } from '../Components/dashboard/charts/receiver-status';
import { SdlaMetrics } from '../Components/dashboard/charts/sdla-metrics';
import { FclKpiChart } from '../Components/dashboard/charts/fcl-kpi-chart';

export default function Dashboard() {
  const [theme, setTheme] = useState('blue');
  const [selectedFcl, setSelectedFcl] = useState('fcl');

  const summaryCards = [
    { title: 'Materials', count: '4', icon: 'factory', link: 'View All' },
    { title: 'Recipes', count: '1', icon: 'clipboard', link: 'View All' },
    { title: 'Feeder Recipes', count: '3', icon: 'trending-up', link: 'View All' },
    { title: 'Completed Batches', count: '1', icon: 'check-circle', link: 'View All' },
  ];

  const processMetrics = [
    { label: 'Flow Rate', value: '24', unit: 'Current Rate', icon: 'activity' },
    { label: 'Moisture Setpoint', value: '16', unit: 'Target Level', icon: 'droplet' },
    { label: 'Moisture Offset', value: '-3.5', unit: 'Adjustment', icon: 'settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader 
        theme={theme}
        onThemeChange={setTheme}
        selectedFcl={selectedFcl}
        onFclChange={setSelectedFcl}
      />

      <div className="container mx-auto p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {summaryCards.map((card, index) => (
            <Box key={index} className="bg-blue-100 p-6 rounded-lg shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-4xl font-bold text-blue-600">{card.count}</h3>
                  <p className="text-gray-600">{card.title}</p>
                  <a href="#" className="text-blue-500 text-sm">{card.link}</a>
                </div>
                <div className="bg-white p-3 rounded-full">
                  <i className={`lucide-${card.icon} text-blue-500`}></i>
              </div>
              </div>
            </Box>
          ))}
            </div>
            
        {/* Process Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {processMetrics.map((metric, index) => (
            <Box key={index} className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-gray-600">{metric.label}</p>
                  <h3 className="text-3xl font-bold">{metric.value}</h3>
                  <p className="text-sm text-gray-500">{metric.unit}</p>
            </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <i className={`lucide-${metric.icon} text-blue-500`}></i>
          </div>
        </div>
            </Box>
          ))}
        </div>

        {/* Production Status */}
        <Box className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Production Status</h2>
            <span className="text-green-500 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Line Running
                </span>
              </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
              <h3 className="text-3xl font-bold text-blue-500">4257.9</h3>
              <p className="text-gray-600">kg Produced</p>
              </div>
              <div className="text-center">
              <h3 className="text-3xl font-bold text-blue-500">230.0</h3>
              <p className="text-gray-600">kg Consumed</p>
              </div>
              <div className="text-center">
              <h3 className="text-3xl font-bold text-blue-500">94.9</h3>
              <p className="text-gray-600">% Efficiency</p>
            </div>
          </div>
        </Box>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Box className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Material Distribution</h2>
            <MaterialChart />
          </Box>
          
          <Box className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">FCL Performance Metrics</h2>
            <FclKpiChart />
          </Box>

          <Box className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Process Parameters</h2>
            <SetpointChart />
          </Box>

          <Box className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">SDLA Metrics</h2>
            <SdlaMetrics />
          </Box>

          <Box className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Sender Weights</h2>
            <SenderWeightTable />
          </Box>

          <Box className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Receiver Status</h2>
            <ReceiverStatus />
          </Box>
        </div>
      </div>
    </div>
  );
}
