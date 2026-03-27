import React, { useState, useContext, useEffect } from "react";
import KpiCard from "../components/charts/KpiCard";
import CircularChart from "../Components/charts/CircularChart";
import { FaBolt, FaChargingStation, FaPlug, FaBatteryThreeQuarters, FaWifi, FaTimesCircle, FaChartLine, FaExclamationTriangle } from "react-icons/fa";
import MultiLineChart from "../Components/charts/MultiLineChart";
import StackedAreaChart from "../Components/charts/StackedAreaChart";
import GroupedBarChart from "../Components/charts/GroupedBarChart";
import GaugeChart from "../Components/charts/GaugeChart";
import CardLineData from "../Components/charts/CardLineData";
import PowerMonitorDiagram from "../Components/charts/PowerMonitorDiagram";
import PowerVoltageCircles from "../Components/charts/PowerVoltageCircles";
import usePowerMonitor from "../hooks/usePowerMonitor";
import { DarkModeContext } from "../Context/DarkModeProvider";

// Industrial Color Palette - Calm, operator-friendly
const COLORS = {
  // Primary: Deep navy / dark blue
  primary: {
    main: '#1e3a5f',      // Deep navy
    light: '#2d4a6b',     // Lighter navy
    dark: '#0f1f35',      // Darker navy
  },
  // Secondary: Muted blue / slate / charcoal
  secondary: {
    main: '#475569',      // Slate
    light: '#64748b',     // Light slate
    dark: '#334155',      // Dark slate
  },
  // Accents: Teal, Coral, Orange (used sparingly)
  accent: {
    red: '#4DD0C9',       // Teal for L1
    blue: '#F08080',      // Coral/Salmon Pink for L2
    green: '#FFA500',     // Orange/Amber for L3
    redLight: 'rgba(77, 208, 201, 0.15)',
    blueLight: 'rgba(240, 128, 128, 0.15)',
    greenLight: 'rgba(255, 165, 0, 0.15)',
  },
  // Chart colors - modern and vibrant
  chart: {
    l1: 'rgba(77, 208, 201, 0.6)',      // Teal for L1
    l2: 'rgba(240, 128, 128, 0.6)',       // Coral/Salmon Pink for L2
    l3: 'rgba(255, 165, 0, 0.6)',       // Orange/Amber for L3
    l1Border: 'rgba(77, 208, 201, 0.9)',
    l2Border: 'rgba(240, 128, 128, 0.9)',
    l3Border: 'rgba(255, 165, 0, 0.9)',
    voltage: 'rgba(71, 85, 105, 0.6)',  // Slate for voltage
    voltageBorder: 'rgba(71, 85, 105, 0.9)',
  },
  // Status colors
  status: {
    connected: '#166534',    // Muted green
    disconnected: '#c2410c', // Soft red
    saving: '#1e40af',       // Muted blue
    connectedBg: 'rgba(22, 101, 52, 0.1)',
    disconnectedBg: 'rgba(194, 65, 12, 0.1)',
    savingBg: 'rgba(30, 64, 175, 0.1)',
  },
  // Shadows - soft, minimal
  shadow: {
    soft: '0 2px 8px rgba(0, 0, 0, 0.1)',
    medium: '0 4px 12px rgba(0, 0, 0, 0.15)',
    hover: '0 0 20px rgba(30, 58, 95, 0.3)', // Deep navy glow
  },
};

function DashboardCard({ title, children }) {
  return (
    <div className="bg-white dark:bg-[#1a2332] rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm p-2 flex flex-col min-h-[200px] transition duration-300 hover:shadow-md">
      <h3 className="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-1 truncate">{title}</h3>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

// Constants
const TOGGLE_OPTIONS = ["C2", "M20", "M21", "M22", "M23", "M24"];

// Monitor-specific reference values for percentage calculations
const MONITOR_REFERENCE_VALUES = {
  "C2": { current: 100.0, voltage: 240.0 },
  "M20": { current: 100.0, voltage: 240.0 },
  "M21": { current: 100.0, voltage: 240.0 },
  "M22": { current: 100.0, voltage: 240.0 },
  "M23": { current: 200.0, voltage: 240.0 },  // Higher capacity - handles up to 200A
  "M24": { current: 150.0, voltage: 240.0 }     // Medium capacity - handles up to 150A
};

// Helper function to get reference values for a monitor
const getReferenceValues = (block) => {
  return MONITOR_REFERENCE_VALUES[block] || { current: 100.0, voltage: 240.0 };
};

export default function Dashboard() {
  const { data: powerData, status, error, isConnected } = usePowerMonitor();
  const [selectedBlock, setSelectedBlock] = useState("C2");
  const toggleOptions = TOGGLE_OPTIONS;
  const { mode } = useContext(DarkModeContext) || {};
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // History state for charts
  const [history, setHistory] = useState([]);

  // Calculate Average Voltage
  const calculateAverageVoltage = (block) => {
    const v1 = powerData[`${block}.L1_Voltage`] || 0;
    const v2 = powerData[`${block}.L2_Voltage`] || 0;
    const v3 = powerData[`${block}.L3_Voltage`] || 0;
    
    if (v1 === 0 && v2 === 0 && v3 === 0) return 0;
    
    // Average Voltage = (VL1 + VL2 + VL3) ÷ 3
    return (v1 + v2 + v3) / 3;
  };

  // Calculate Voltage Imbalance
  const calculateVoltageImbalance = (block) => {
    const v1 = powerData[`${block}.L1_Voltage`] || 0;
    const v2 = powerData[`${block}.L2_Voltage`] || 0;
    const v3 = powerData[`${block}.L3_Voltage`] || 0;
    
    if (v1 === 0 && v2 === 0 && v3 === 0) return 0;
    
    const avgVoltage = (v1 + v2 + v3) / 3;
    if (avgVoltage === 0) return 0;
    
    // Voltage Imbalance = (Max deviation from average / Average) × 100
    const deviations = [
      Math.abs(v1 - avgVoltage),
      Math.abs(v2 - avgVoltage),
      Math.abs(v3 - avgVoltage)
    ];
    const maxDeviation = Math.max(...deviations);
    
    return (maxDeviation / avgVoltage) * 100;
  };

  // Clear history when block changes
  useEffect(() => {
    setHistory([]);
  }, [selectedBlock]);

  // Update history with new data points
  useEffect(() => {
    if (powerData && powerData[`${selectedBlock}.L1_Current`] !== undefined) {
      const now = new Date();
      const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      const newPoint = {
        label: timeLabel,
        l1c: powerData[`${selectedBlock}.L1_Current`] || 0,
        l2c: powerData[`${selectedBlock}.L2_Current`] || 0,
        l3c: powerData[`${selectedBlock}.L3_Current`] || 0,
        l1v: powerData[`${selectedBlock}.L1_Voltage`] || 0,
        l2v: powerData[`${selectedBlock}.L2_Voltage`] || 0,
        l3v: powerData[`${selectedBlock}.L3_Voltage`] || 0,
      };

      setHistory(prev => {
        // Keep last 30 points (approx 2.5 minutes if 5s update)
        const newHistory = [...prev, newPoint];
        if (newHistory.length > 30) return newHistory.slice(newHistory.length - 30);
        return newHistory;
      });
    }
  }, [powerData, selectedBlock]);

  // Auto-save energy readings for ALL blocks every 1 minute
  useEffect(() => {
    if (!powerData || Object.keys(powerData).length === 0) {
      console.log('⏳ Waiting for power data...');
      return;
    }

    const saveAllEnergyReadings = async () => {
      setIsSaving(true);
      let successCount = 0;
      let errorCount = 0;

      // Save for all blocks
      for (const block of TOGGLE_OPTIONS) {
        try {
          // Get all KPI values for this block including all three voltages
          const totalActiveEnergy = powerData[`${block}.LGEN_Total_Active_Energy`];
          const totalReactiveEnergy = powerData[`${block}.LGEN_Total_Reactive_Energy`];
          const totalApparentEnergy = powerData[`${block}.LGEN_Total_Apparent_Energy`];
          const voltageL1 = powerData[`${block}.L1_Voltage`];
          const voltageL2 = powerData[`${block}.L2_Voltage`];
          const voltageL3 = powerData[`${block}.L3_Voltage`];
          const effectivePower = powerData[`${block}.LGEN_EffectivePower`];

          // Skip if any critical value is missing or invalid
          if (
            totalActiveEnergy === undefined || 
            totalReactiveEnergy === undefined || 
            totalApparentEnergy === undefined || 
            voltageL1 === undefined || 
            voltageL2 === undefined ||
            voltageL3 === undefined ||
            effectivePower === undefined
          ) {
            console.warn(`⚠️ Skipping ${block}: Missing data values`);
            continue;
          }

          const response = await fetch('/orders/store-energy-reading', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              block_name: block,
              total_active_energy: totalActiveEnergy || 0,
              total_reactive_energy: totalReactiveEnergy || 0,
              total_apparent_energy: totalApparentEnergy || 0,
              voltage_l1: voltageL1 || 0,
              voltage_l2: voltageL2 || 0,
              voltage_l3: voltageL3 || 0,
              effective_power: effectivePower || 0
            })
          });

          if (response.ok) {
            successCount++;
            console.log(`✅ Energy reading saved for ${block}`);
          } else {
            const errorData = await response.json().catch(() => ({}));
            errorCount++;
            console.error(`❌ Failed to save energy reading for ${block}:`, errorData);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Error saving energy reading for ${block}:`, error);
        }
      }

      setIsSaving(false);
      setLastSaveTime(new Date());
      console.log(`📊 Save complete: ${successCount} successful, ${errorCount} errors`);
    };

    // Save immediately when component mounts and data is available
    saveAllEnergyReadings();
    
    // Then save every 1 minute (60000 ms)
    const interval = setInterval(saveAllEnergyReadings, 60000);
    
    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [powerData]); // Only depend on powerData, not selectedBlock

  if (status === "loading") return <div>Loading power data...</div>;
  if (status === "error") return <div>Error loading power data: {error.message}</div>;

  // Prepare chart data with industrial color palette
  const stackedData = {
    labels: history.map(h => h.label),
    datasets: [
      { label: 'L1 Current', data: history.map(h => h.l1c), backgroundColor: COLORS.chart.l1, fill: true, borderColor: COLORS.chart.l1Border },
      { label: 'L2 Current', data: history.map(h => h.l2c), backgroundColor: COLORS.chart.l2, fill: true, borderColor: COLORS.chart.l2Border },
      { label: 'L3 Current', data: history.map(h => h.l3c), backgroundColor: COLORS.chart.l3, fill: true, borderColor: COLORS.chart.l3Border },
    ]
  };

  const multiLineData = {
    labels: history.map(h => h.label),
    datasets: [
      { label: 'L1 Current', data: history.map(h => h.l1c), borderColor: COLORS.chart.l1Border, backgroundColor: COLORS.chart.l1, tension: 0.4 },
      { label: 'L2 Current', data: history.map(h => h.l2c), borderColor: COLORS.chart.l2Border, backgroundColor: COLORS.chart.l2, tension: 0.4 },
      { label: 'L3 Current', data: history.map(h => h.l3c), borderColor: COLORS.chart.l3Border, backgroundColor: COLORS.chart.l3, tension: 0.4 },
      { label: 'L1 Voltage', data: history.map(h => h.l1v), borderColor: COLORS.chart.voltageBorder, backgroundColor: COLORS.chart.voltage, borderDash: [5, 5], tension: 0.4 },
      { label: 'L2 Voltage', data: history.map(h => h.l2v), borderColor: COLORS.chart.voltageBorder, backgroundColor: COLORS.chart.voltage, borderDash: [5, 5], tension: 0.4 },
      { label: 'L3 Voltage', data: history.map(h => h.l3v), borderColor: COLORS.chart.voltageBorder, backgroundColor: COLORS.chart.voltage, borderDash: [5, 5], tension: 0.4 },
    ]
  };
  
  const groupedBarData = {
    labels: ['Line 1', 'Line 2', 'Line 3'],
    datasets: [
       { label: 'Current (A)', data: [powerData[`${selectedBlock}.L1_Current`] || 0, powerData[`${selectedBlock}.L2_Current`] || 0, powerData[`${selectedBlock}.L3_Current`] || 0], backgroundColor: [COLORS.chart.l1, COLORS.chart.l2, COLORS.chart.l3] },
       { label: 'Voltage (V)', data: [powerData[`${selectedBlock}.L1_Voltage`] || 0, powerData[`${selectedBlock}.L2_Voltage`] || 0, powerData[`${selectedBlock}.L3_Voltage`] || 0], backgroundColor: [COLORS.chart.l1, COLORS.chart.l2, COLORS.chart.l3] }
    ]
  };

  return (
    <div className="w-full bg-gray-50 dark:bg-[#0c111b] dark:text-white">
      <main className="w-full h-screen overflow-y-auto px-2 py-2">
        {/* Connection Status and Toggle Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4 justify-between items-center">
          {/* Connection Status and Save Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${isConnected ? 'border-[#166534] text-[#166534]' : 'border-[#c2410c] text-[#c2410c]'}`} style={{ backgroundColor: isConnected ? COLORS.status.connectedBg : COLORS.status.disconnectedBg }}>
              {isConnected ? <FaWifi className="text-[#166534]" /> : <FaTimesCircle className="text-[#c2410c]" />}
              <span className="text-sm font-medium">
                {isConnected ? 'Real-time Connected' : 'Polling Mode'}
              </span>
            </div>
            {isSaving && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1e40af] text-[#1e40af]" style={{ backgroundColor: COLORS.status.savingBg }}>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1e40af]"></div>
                <span className="text-sm font-medium">Saving...</span>
              </div>
            )}
            {lastSaveTime && !isSaving && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-400 dark:border-gray-600 bg-gray-50 dark:bg-[#1a2332] text-gray-700 dark:text-gray-300">
                <span className="text-sm font-medium">
                  Last saved: {lastSaveTime.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>


        {/* Toggle Buttons */}
          <div className="flex flex-wrap gap-2 justify-center">
          {toggleOptions.map((block) => (
            <button
              key={block}
              onClick={() => setSelectedBlock(block)}
                className={`px-3 py-2 rounded font-semibold border transition-colors duration-200 text-sm ${
                  selectedBlock === block 
                    ? "bg-blue-600 text-white border-blue-700" 
                    : "bg-gray-200 text-gray-800 border-gray-400 hover:bg-blue-100"
                }`}
            >
              {block}
            </button>
          ))}
        </div>
        </div>


        <div className="mb-4 text-lg font-bold text-center">
          Selected Power Monitor: {selectedBlock}
        </div>


        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
          <KpiCard title="Total Active Energy" value={powerData[`${selectedBlock}.LGEN_Total_Active_Energy`]?.toFixed(2) || 0} unit="kWh" icon={<FaBolt />} />
          <KpiCard title="Total Reactive Energy" value={powerData[`${selectedBlock}.LGEN_Total_Reactive_Energy`]?.toFixed(2) || 0} unit="kvarh" icon={<FaChargingStation />} />
          <KpiCard title="Total Apparent Energy" value={powerData[`${selectedBlock}.LGEN_Total_Apparent_Energy`]?.toFixed(2) || 0} unit="kVAh" icon={<FaPlug />} />
          
          {/* Average Voltage KPI - Shows average of all three phases */}
          <KpiCard 
            title="Average Voltage" 
            value={calculateAverageVoltage(selectedBlock).toFixed(2)} 
            unit="V" 
            icon={<FaBatteryThreeQuarters />} 
          />
          
          <KpiCard title="Effective Power" value={powerData[`${selectedBlock}.LGEN_EffectivePower`]?.toFixed(2) || 0} unit="kW" icon={<FaBolt />} />
          
          {/* Power Factor KPI */}
          <KpiCard 
            title="Power Factor" 
            value={
              powerData[`${selectedBlock}.LGEN_Total_Apparent_Energy`] && 
              powerData[`${selectedBlock}.LGEN_Total_Apparent_Energy`] !== 0
                ? (powerData[`${selectedBlock}.LGEN_Total_Active_Energy`] / powerData[`${selectedBlock}.LGEN_Total_Apparent_Energy`]).toFixed(3)
                : "0.000"
            } 
            unit="" 
            icon={<FaChartLine />} 
          />
          
          {/* Voltage Imbalance KPI */}
          <KpiCard 
            title="Voltage Imbalance" 
            value={calculateVoltageImbalance(selectedBlock).toFixed(2)} 
            unit="%" 
            icon={<FaExclamationTriangle />} 
          />
        </div>


        <div className="rounded-xl bg-white dark:bg-[#1a2332] p-6 mt-4 border border-gray-300 dark:border-gray-600 shadow-sm transition duration-300 hover:shadow-md">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch w-full ">
            {/* Left Side: Gauge Charts */}
            <div className="grid grid-cols-3 gap-3 w-full lg:w-[30%]">
              <GaugeChart value={((powerData[`${selectedBlock}.L1_Current`] / getReferenceValues(selectedBlock).current) * 100) / 10 || 0} label="L1 Current %" color="red" />
              <GaugeChart value={((powerData[`${selectedBlock}.L2_Current`] / getReferenceValues(selectedBlock).current) * 100) / 10 || 0} label="L2 Current %" color="blue" />
              <GaugeChart value={((powerData[`${selectedBlock}.L3_Current`] / getReferenceValues(selectedBlock).current) * 100) / 10 || 0} label="L3 Current %" color="green" />
              <GaugeChart value={((powerData[`${selectedBlock}.L1_Voltage`] / getReferenceValues(selectedBlock).voltage) * 100) / 10 || 0} label="L1 Voltage %" color="red" />
              <GaugeChart value={((powerData[`${selectedBlock}.L2_Voltage`] / getReferenceValues(selectedBlock).voltage) * 100) / 10 || 0} label="L2 Voltage %" color="blue" />
              <GaugeChart value={((powerData[`${selectedBlock}.L3_Voltage`] / getReferenceValues(selectedBlock).voltage) * 100) / 10 || 0} label="L3 Voltage %" color="green" />
            </div>


            {/* Center: Power Monitor Card */}
            <div className="w-full lg:w-[40%] flex justify-center items-center">
              <PowerMonitorDiagram
                l1={{ voltage: powerData[`${selectedBlock}.L1_Voltage`], current: powerData[`${selectedBlock}.L1_Current`] }}
                l2={{ voltage: powerData[`${selectedBlock}.L2_Voltage`], current: powerData[`${selectedBlock}.L2_Current`] }}
                l3={{ voltage: powerData[`${selectedBlock}.L3_Voltage`], current: powerData[`${selectedBlock}.L3_Current`] }}
              />
            </div>


            {/* Right Side: Circular Charts */}
            <div className="grid grid-cols-3 gap-3 w-full lg:w-[30%]">
              <CircularChart
                title="Power Utilization"
                value={(powerData[`${selectedBlock}.LGEN_EffectivePower`] / powerData[`${selectedBlock}.LGEN_ApparentPower`] || 0) * 100}
                total={100}
                label="Used"
                color={COLORS.primary.main}
              />
              <CircularChart
                title="Line 1 Load"
                value={((powerData[`${selectedBlock}.L1_Current`] / getReferenceValues(selectedBlock).current) * 100) / 10 || 0}
                total={100}
                label="Load"
                color="#4DD0C9"
              />
              <CircularChart
                title="Line 2 Load"
                value={((powerData[`${selectedBlock}.L2_Current`] / getReferenceValues(selectedBlock).current) * 100) / 10 || 0}
                total={100}
                label="Eff."
                color="#F08080"
              />
              <CircularChart
                title="Line 3 Load"
                value={((powerData[`${selectedBlock}.L3_Current`] / getReferenceValues(selectedBlock).current) * 100) / 10 || 0}
                total={100}
                label="Reserve"
                color="#FFA500"
              />
              <CircularChart
                title="Voltage"
                value={(((powerData[`${selectedBlock}.L1_Voltage`] + powerData[`${selectedBlock}.L2_Voltage`] + powerData[`${selectedBlock}.L3_Voltage`]) / (3 * getReferenceValues(selectedBlock).voltage)) * 100) / 10 || 0}
                total={100}
                label="V"
                color={COLORS.secondary.main}
              />
              <CircularChart
                title="Current"
                value={(((powerData[`${selectedBlock}.L1_Current`] + powerData[`${selectedBlock}.L2_Current`] + powerData[`${selectedBlock}.L3_Current`]) / (3 * getReferenceValues(selectedBlock).current)) * 100) / 10 || 0}
                total={100}
                label="A"
                color={COLORS.secondary.dark}
              />
            </div>
          </div>
        </div>


        <div className="p-2">
          <div className="rounded-xl bg-white dark:bg-[#1a2332] p-4 mt-2 border border-gray-300 dark:border-gray-600 shadow-sm transition duration-300 hover:shadow-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 ">
              <CardLineData label="Line 1" value={powerData[`${selectedBlock}.L1_Current`] || 0} unit="A" type="Current" color="red" />
              <CardLineData label="Line 2" value={powerData[`${selectedBlock}.L2_Current`] || 0} unit="A" type="Current" color="blue" />
              <CardLineData label="Line 3" value={powerData[`${selectedBlock}.L3_Current`] || 0} unit="A" type="Current" color="green" />
              <CardLineData label="Line 1" value={powerData[`${selectedBlock}.L1_Voltage`] || 0} unit="V" type="Voltage" color="red" />
              <CardLineData label="Line 2" value={powerData[`${selectedBlock}.L2_Voltage`] || 0} unit="V" type="Voltage" color="blue" />
              <CardLineData label="Line 3" value={powerData[`${selectedBlock}.L3_Voltage`] || 0} unit="V" type="Voltage" color="green" />
            </div>
          </div>
        </div>


        <PowerVoltageCircles
          currentData={[
            ((powerData[`${selectedBlock}.L1_Current`] / getReferenceValues(selectedBlock).current) * 100) / 10 || 0,
            ((powerData[`${selectedBlock}.L2_Current`] / getReferenceValues(selectedBlock).current) * 100) / 10 || 0,
            ((powerData[`${selectedBlock}.L3_Current`] / getReferenceValues(selectedBlock).current) * 100) / 10 || 0,
          ]}
          voltageData={[
            ((powerData[`${selectedBlock}.L1_Voltage`] / getReferenceValues(selectedBlock).voltage) * 100) / 10 || 0,
            ((powerData[`${selectedBlock}.L2_Voltage`] / getReferenceValues(selectedBlock).voltage) * 100) / 10 || 0,
            ((powerData[`${selectedBlock}.L3_Voltage`] / getReferenceValues(selectedBlock).voltage) * 100) / 10 || 0,
          ]}
        />


        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mt-2">
          <DashboardCard title="">
            <StackedAreaChart data={stackedData} />
          </DashboardCard>
          <DashboardCard title="">
            <GroupedBarChart data={groupedBarData} />
          </DashboardCard>
          <DashboardCard title="">
            <MultiLineChart data={multiLineData} />
          </DashboardCard>
        </div>
      </main>
    </div>
  );
}
