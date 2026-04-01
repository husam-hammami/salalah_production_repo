import React, { useState, useEffect } from "react";
import { useLenisScroll } from "../Hooks/useLenisScroll.js";
import herculesLogo from "../Assets/herculeslogo.png";
import asmLogo from "../Assets/Asm_Logo.png";
import salalahLogo from "../Assets/salalah_logo.png";
import { FaBolt, FaChargingStation, FaPlug, FaBatteryThreeQuarters } from "react-icons/fa";
import MultiLineChart from "../Components/charts/MultiLineChart";
import axios from 'axios';

const MACHINES = ["All", "C2", "M20", "M21", "M22", "M23", "M24"];
const SHIFTS = ["All Shifts", "Shift A (06:00-14:00)", "Shift B (14:00-22:00)", "Shift C (22:00-06:00)"];

const StatCard = ({ title, value, unit, icon, color }) => {
  const colorClasses = {
    blue: "text-blue-600 bg-blue-100",
    indigo: "text-indigo-600 bg-indigo-100",
    green: "text-green-600 bg-green-100",
    orange: "text-orange-600 bg-orange-100",
    red: "text-red-600 bg-red-100",
  };

  const iconColorClass = colorClasses[color] || "text-gray-600 bg-gray-100";

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-4">
      <div className={`p-4 rounded-full ${iconColorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className="text-2xl font-bold text-gray-800">
          {value} <span className="text-sm font-medium text-gray-400">{unit}</span>
        </h3>
      </div>
    </div>
  );
};

const EnergyReport = () => {
  useLenisScroll();

  const [selectedMachine, setSelectedMachine] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedShift, setSelectedShift] = useState("All Shifts");
  
  const [historicalData, setHistoricalData] = useState({
    active_energy: 0,
    reactive_energy: 0,
    avg_voltage: 0,
    avg_power: 0
  });
  
  const [hourlyData, setHourlyData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [powerTrend, setPowerTrend] = useState([]);
  const [peakDemand, setPeakDemand] = useState(0);
  const [todayEnergy, setTodayEnergy] = useState(0);
  
  const [activeTab, setActiveTab] = useState("charts"); // 'charts' or 'table'
  const [tableView, setTableView] = useState("hourly"); // 'hourly', 'daily', 'monthly'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Set default dates
  useEffect(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const toLocalISO = (date) => {
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date - offset).toISOString().slice(0, 16);
    };

    setStartDate(toLocalISO(start));
    setEndDate(toLocalISO(end));
  }, []);

  // Compute effective date range (applies shift override when a specific shift is selected)
  const getEffectiveDateRange = () => {
    if (!startDate || !endDate) return { start: '', end: '' };

    let effectiveStart = startDate.replace('T', ' ') + ':00';
    let effectiveEnd = endDate.replace('T', ' ') + ':59';

    if (selectedShift !== 'All Shifts') {
      const dateStr = startDate.split('T')[0];
      if (selectedShift.includes('Shift A')) {
        effectiveStart = `${dateStr} 06:00:00`;
        effectiveEnd = `${dateStr} 13:59:59`;
      } else if (selectedShift.includes('Shift B')) {
        effectiveStart = `${dateStr} 14:00:00`;
        effectiveEnd = `${dateStr} 21:59:59`;
      } else if (selectedShift.includes('Shift C')) {
        effectiveStart = `${dateStr} 22:00:00`;
        const nextDay = new Date(dateStr);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextStr = nextDay.toISOString().split('T')[0];
        effectiveEnd = `${nextStr} 05:59:59`;
      }
    }
    return { start: effectiveStart, end: effectiveEnd };
  };

  // Fetch all data in parallel
  useEffect(() => {
    if (!startDate || !endDate) return;

    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { start: effStart, end: effEnd } = getEffectiveDateRange();
        const machineParam = selectedMachine; // 'All' is handled by backend

        const today = new Date();
        const selectedDate = new Date(startDate);
        const isToday = selectedDate.toDateString() === today.toDateString();

        // Daily table: expand to full month containing selected date
        const dailyRangeStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
          .toISOString().split('T')[0];
        const dailyRangeEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
          .toISOString().split('T')[0];

        // Monthly table/chart: go back 12 months from selected date
        const monthlyRangeStart = new Date(selectedDate.getFullYear() - 1, selectedDate.getMonth(), 1)
          .toISOString().split('T')[0];
        const monthlyRangeEnd = endDate.split('T')[0];

        // Fire all requests in parallel
        const [kpiRes, todayRes, hourlyRes, monthlyRes, dailyRes, trendRes, peakRes] = await Promise.allSettled([
          axios.get('/api/energy/historical', {
            params: { block_name: machineParam, start_datetime: effStart, end_datetime: effEnd }
          }),
          isToday
            ? axios.get('/api/energy/today', { params: { block_name: machineParam } })
            : Promise.resolve(null),
          axios.get('/api/energy/hourly', {
            params: { block_name: machineParam, start_datetime: effStart, end_datetime: effEnd }
          }),
          axios.get('/api/energy/monthly', {
            params: { block_name: machineParam, start_month: monthlyRangeStart, end_month: monthlyRangeEnd }
          }),
          axios.get('/api/energy/daily', {
            params: { block_name: machineParam, start_date: dailyRangeStart, end_date: dailyRangeEnd }
          }),
          axios.get('/get-energy-history', {
            params: { block_name: machineParam, start_date: effStart, end_date: effEnd, limit: 200 }
          }),
          axios.get('/api/energy/peak-demand', {
            params: { block_name: machineParam, start_date: effStart, end_date: effEnd }
          }),
        ]);

        // Process KPI
        if (kpiRes.status === 'fulfilled' && kpiRes.value?.data?.status === 'success') {
          setHistoricalData(kpiRes.value.data.data);
        }

        // Process Today's energy
        if (isToday && todayRes.status === 'fulfilled' && todayRes.value?.data?.status === 'success') {
          setTodayEnergy(todayRes.value.data.data.today_energy || 0);
        } else {
          setTodayEnergy(0);
        }

        // Process Hourly
        if (hourlyRes.status === 'fulfilled' && hourlyRes.value?.data?.status === 'success') {
          setHourlyData(hourlyRes.value.data.data);
        }

        // Process Monthly
        if (monthlyRes.status === 'fulfilled' && monthlyRes.value?.data?.status === 'success') {
          setMonthlyData(monthlyRes.value.data.data);
        }

        // Process Daily
        if (dailyRes.status === 'fulfilled' && dailyRes.value?.data?.status === 'success') {
          setDailyData(dailyRes.value.data.data);
        }

        // Process Power Trend
        if (trendRes.status === 'fulfilled' && trendRes.value?.data?.status === 'success') {
          const trendData = trendRes.value.data.data.reverse().map(item => ({
            time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            power: item.effective_power
          }));
          setPowerTrend(trendData);
        }

        // Process Peak Demand
        if (peakRes.status === 'fulfilled' && peakRes.value?.data?.status === 'success') {
          setPeakDemand(peakRes.value.data.data.peak_demand || 0);
        }

      } catch (err) {
        console.error("Error fetching energy data:", err);
        setError("Failed to fetch data. Please check connection.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [selectedMachine, startDate, endDate, selectedShift]);


  // Chart Data Preparation — dual-line (Energy + Voltage) for hourly & monthly
  const hourlyChartData = {
    labels: hourlyData.map(d =>
      new Date(d.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    ),
    datasets: [
      {
        label: 'Energy (kWh)',
        data: hourlyData.map(d => d.energy),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: false,
        yAxisID: 'y',
      },
      {
        label: 'Avg Voltage (V)',
        data: hourlyData.map(d => d.avg_voltage),
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        fill: false,
        yAxisID: 'y1',
      }
    ]
  };

  const powerTrendChartData = {
    labels: powerTrend.map(d => d.time),
    datasets: [
      {
        label: 'Power (kW)',
        data: powerTrend.map(d => d.power),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  const monthlyChartData = {
    labels: monthlyData.map(d =>
      new Date(d.month).toLocaleDateString([], { month: 'short', year: 'numeric' })
    ),
    datasets: [
      {
        label: 'Energy (kWh)',
        data: monthlyData.map(d => d.energy),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: false,
        yAxisID: 'y',
      },
      {
        label: 'Avg Voltage (V)',
        data: monthlyData.map(d => d.avg_voltage),
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        fill: false,
        yAxisID: 'y1',
      }
    ]
  };

  // Print Header Component
  const PrintHeader = () => (
    <>
      <style>{`
        @media print {
          .print-header {
            display: flex !important;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #d1d5db;
            page-break-inside: avoid;
          }
          .print-header-left {
            flex: 0 0 auto;
          }
          .print-header-right {
            display: flex;
            align-items: center;
            gap: 2rem;
            flex: 0 0 auto;
          }
          .print-logo {
            height: 4rem;
            max-width: 200px;
            object-fit: contain;
          }
          .print-logo-right {
            height: 3.5rem;
            max-width: 150px;
            object-fit: contain;
          }
          .no-print {
            display: none !important;
          }
        }
        @media screen {
          .print-header {
            display: none !important;
            justify-content: space-between;
            display: none !important;
          }
        }
      `}</style>
      <div className="print-header">
        <div className="print-header-left">
          <img src={herculesLogo} alt="Hercules Logo" className="print-logo" />
        </div>
        <div className="print-header-right">
          <img src={asmLogo} alt="ASM Logo" className="print-logo-right" />
          <img src={salalahLogo} alt="Salalah Logo" className="print-logo-right" />
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 px-4 md:px-8 pt-2 pb-8">
      {/* Filter Bar */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-4 mb-6 no-print">
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          
          {/* Machine Selector */}
          <div className="flex flex-col w-full md:w-48">
            <label className="text-xs font-semibold text-gray-600 mb-1">Machine</label>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {MACHINES.map((machine) => (
                <option key={machine} value={machine}>{machine}</option>
              ))}
            </select>
          </div>

          {/* Shift Selector */}
          <div className="flex flex-col w-full md:w-64">
            <label className="text-xs font-semibold text-gray-600 mb-1">Shift</label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {SHIFTS.map((shift) => (
                <option key={shift} value={shift}>{shift}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="flex flex-col flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-600 mb-1">Start Date & Time</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>

          {/* End Date */}
          <div className="flex flex-col flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-gray-600 mb-1">End Date & Time</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 font-semibold text-sm h-[38px]"
          >
            Print Report
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div id="report-print-section" className="bg-white rounded-2xl shadow-lg p-6 md:p-8 min-h-[calc(100vh-200px)]">
        <PrintHeader />

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800">Historical Energy Report</h1>
          <p className="text-gray-600 mt-1">
            Machine: <span className="font-semibold text-blue-600">{selectedMachine === 'All' ? 'All Machines' : selectedMachine}</span> | 
            Period: <span className="font-semibold">{new Date(startDate).toLocaleString()}</span> to <span className="font-semibold">{new Date(endDate).toLocaleString()}</span>
          </p>
          {loading && <p className="text-blue-500 text-sm mt-2">Loading data...</p>}
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6 no-print">
          <button
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'charts' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('charts')}
          >
            KPIs & Charts
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'table' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('table')}
          >
            Report Table
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'charts' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <StatCard 
                title="Today's Energy Consumption" 
                value={todayEnergy.toFixed(2)} 
                unit="kWh" 
                icon={<FaBolt className="text-2xl" />} 
                color="blue"
              />
              <StatCard 
                title="Reactive Energy" 
                value={historicalData.reactive_energy || 0} 
                unit="kVArh" 
                icon={<FaChargingStation className="text-2xl" />} 
                color="indigo"
              />
              <StatCard 
                title="Avg Voltage" 
                value={historicalData.avg_voltage || 0} 
                unit="V" 
                icon={<FaBatteryThreeQuarters className="text-2xl" />} 
                color="green"
              />
              <StatCard 
                title="Avg Power" 
                value={historicalData.avg_power || 0} 
                unit="kW" 
                icon={<FaPlug className="text-2xl" />} 
                color="orange"
              />
              <StatCard 
                title="Peak Demand" 
                value={peakDemand.toFixed(2)} 
                unit="kW" 
                icon={<FaBolt className="text-2xl" />} 
                color="red"
              />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Hourly Energy & Voltage Chart */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm w-full">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Hourly Energy & Voltage Trend</h3>
                <div className="h-80 w-full">
                  <MultiLineChart data={hourlyChartData} title="Energy vs Voltage (Hourly)" dualAxis />
                </div>
              </div>

              {/* Power Trend Chart */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm w-full">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Power Consumption Trend</h3>
                <div className="h-80 w-full">
                  <MultiLineChart data={powerTrendChartData} title="Power (kW)" />
                </div>
              </div>
            </div>

            {/* Monthly Trend Section */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm w-full">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Monthly Energy & Voltage Trend</h3>
              <div className="h-80 w-full">
                <MultiLineChart data={monthlyChartData} title="Energy vs Voltage (Monthly)" dualAxis />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'table' && (
          <div className="mt-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <h3 className="text-lg font-semibold text-gray-700">Detailed Consumption Data</h3>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                {['Hourly', 'Daily', 'Monthly'].map((view) => (
                  <button
                    key={view}
                    onClick={() => setTableView(view.toLowerCase())}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                      tableView === view.toLowerCase()
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              {(() => {
                const rows = tableView === 'hourly' ? hourlyData :
                             tableView === 'daily'  ? dailyData  : monthlyData;
                const totalEnergy = rows.reduce((acc, r) => acc + parseFloat(r.energy || 0), 0);
                return (
                  <table className="w-full text-sm text-left text-gray-500 border border-gray-200 rounded-lg">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 border-b">
                          {tableView === 'hourly' ? 'Time' : tableView === 'daily' ? 'Date' : 'Month'}
                        </th>
                        <th className="px-6 py-3 border-b text-right">Energy (kWh)</th>
                        {tableView === 'hourly' && <th className="px-6 py-3 border-b text-right">Avg Power (kW)</th>}
                        <th className="px-6 py-3 border-b text-right">Avg Voltage (V)</th>
                        <th className="px-6 py-3 border-b text-right">Cost (OMR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={index} className="bg-white border-b hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">
                            {tableView === 'hourly' ? new Date(row.hour).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) :
                             tableView === 'daily'  ? row.date :
                             new Date(row.month).toLocaleDateString([], {month: 'short', year: 'numeric'})}
                          </td>
                          <td className="px-6 py-3 text-right">{parseFloat(row.energy || 0).toFixed(2)}</td>
                          {tableView === 'hourly' && <td className="px-6 py-3 text-right">{parseFloat(row.avg_power || 0).toFixed(2)}</td>}
                          <td className="px-6 py-3 text-right">{parseFloat(row.avg_voltage || 0).toFixed(2)}</td>
                          <td className="px-6 py-3 text-right">{(parseFloat(row.energy || 0) * 0.35).toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 font-semibold text-gray-900">
                      <tr>
                        <td className="px-6 py-3">Total</td>
                        <td className="px-6 py-3 text-right">{totalEnergy.toFixed(2)}</td>
                        {tableView === 'hourly' && <td className="px-6 py-3 text-right">-</td>}
                        <td className="px-6 py-3 text-right">-</td>
                        <td className="px-6 py-3 text-right">{(totalEnergy * 0.35).toFixed(3)}</td>
                      </tr>
                    </tfoot>
                  </table>
                );
              })()}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default EnergyReport;
