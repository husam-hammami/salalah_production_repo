import BPControlButton from './BPControlButton';
import {
  FaPlay,
  FaStop,
  FaPause,
  FaRedo,
  FaExclamationTriangle,
  FaSync,
  FaInfoCircle
} from 'react-icons/fa';
import { TbPlayerTrackNextFilled } from 'react-icons/tb';
import { HiMiniInboxArrowDown } from 'react-icons/hi2';
import { useEffect, useState } from 'react';
import { Tabs, Tab, Box, Button } from '@mui/material';
import { FlexContainer, FlexItem } from './FlexContainer';
import endpoints from '../../API/endpoints';
import axios from '../../API/axios';
import LoadingScreen from '../Common/LoadingScreen';
import ErrorScreen from '../Common/ErrorScreen';
import { toast } from 'react-toastify';
import { OrdersContext } from './OrdersContext';
import { useContext } from 'react';

const BPActiveOrderDetails = ({ currentJobType, refreshTrigger }) => {
  console.log('[👁 BPActiveOrderDetails] jobType:', currentJobType, 'refreshTrigger:', refreshTrigger);

  // Existing states for order
  const [currentOrder, setCurrentOrder] = useState(null);
  const [currentOrderLoading, setCurrentOrderLoading] = useState(true);
  const [currentOrderError, setCurrentOrderError] = useState(null);
  const [sendCommandLoading, setSendCommandLoading] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
 

  
  // Enhanced feeding state with status tracking
  const [feedingState, setFeedingState] = useState({
    enabled: false,
    loading: false,
    lastActionSuccess: null // 'success', 'error', or null
  });

  // For real-time R KPIs
  const [rKpis, setRKpis] = useState([]);
  const [rKpisError, setRKpisError] = useState('');

  // PLC Monitor logs
  const [plcMonitor, setPlcMonitor] = useState(null);
  const [plcMonitorError, setPlcMonitorError] = useState('');
  const [plcLoading, setPlcLoading] = useState(false);

  const getOrderDetails = async (parsedJobType) => {
    try {
      setCurrentOrderLoading(true);
      const response = await axios(endpoints.orders.details(parsedJobType));
      if (response.status === 200) {
        setCurrentOrder(response.data);
        setCurrentOrderError(null);
      } else {
        setCurrentOrder(null);
        setCurrentOrderError('Error fetching order details');
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        setCurrentOrderError('No active order found for the selected job type.');
      } else {
        setCurrentOrderError('Error fetching order: ' + (error.message || 'Unknown error'));
      }
      setCurrentOrder(null);
    } finally {
      setCurrentOrderLoading(false);
    }
  };

  const fetchRKpis = async (parsedJobType) => {
    try {
      setRKpisError('');
      const endpoint = `/orders/read-active-kpis?job_type_id=${parsedJobType}`;
      const resp = await axios.get(endpoint);
      if (resp.status === 200) {
        setRKpis(resp.data.kpis || []);
      } else {
        setRKpis([]);
        setRKpisError('Could not fetch R-type KPIs');
      }
    } catch (err) {
      console.error('Error fetching R-KPIs:', err);
      setRKpis([]);
      setRKpisError('Error fetching R-KPIs: ' + err.message);
    }
  };

  const fetchPlcMonitor = async () => {
  try {
    console.log('[📡 fetchPlcMonitor] Called with currentJobType:', currentJobType);
    setPlcLoading(true);
    setPlcMonitorError('');

    // Validate job type before proceeding
    if (!currentJobType || currentJobType === 'all-job-types') {
      console.warn('[⚠️ PLC Monitor] Invalid currentJobType:', currentJobType);
      setPlcMonitorError('No valid job type selected for PLC Monitor.');
      setPlcMonitor(null);
      return;
    }

    const parsedJobType = parseInt(currentJobType, 10);
    if (Number.isNaN(parsedJobType) || parsedJobType <= 0) {
      console.warn('[❌ PLC Monitor] Parsed job type is invalid:', parsedJobType);
      setPlcMonitorError('Invalid job type ID for PLC Monitor.');
      setPlcMonitor(null);
      return;
    }

    console.log('[📤 PLC Monitor] Fetching data for job type ID:', parsedJobType);
    const resp = await axios.get(`/orders/plc-monitor?job_type_id=${parsedJobType}`);

    if (resp.status === 200) {
      console.log('[✅ PLC Monitor] Data received:', resp.data);
      setPlcMonitor(resp.data);

      if (resp.data.FeedingEnabled !== undefined) {
        setFeedingState(prev => ({
          ...prev,
          enabled: resp.data.FeedingEnabled,
          lastActionSuccess: 'success'
        }));
      }
    } else {
      console.error('[❌ PLC Monitor] Failed with status:', resp.status);
      setPlcMonitor(null);
      setPlcMonitorError('Could not fetch PLC logs');
    }
  } catch (err) {
    console.error('[❌ PLC Monitor] Exception:', err);
    setPlcMonitor(null);
    setPlcMonitorError('Error fetching PLC logs: ' + err.message);
  } finally {
    setPlcLoading(false);
  }
};

useEffect(() => {
  console.log('[🔁 useEffect triggered] refreshTrigger:', refreshTrigger);
  console.log('[ℹ️] currentJobType =', currentJobType);

  if (!currentJobType || currentJobType === 'all-job-types') {
    console.log('[⚠️] No valid job type selected.');
    setCurrentOrder(null);
    setCurrentOrderError('Please select a job type');
    setCurrentOrderLoading(false);
    return;
  }

  const parsedJobType = parseInt(currentJobType, 10);
  if (Number.isNaN(parsedJobType)) {
    console.log('[❌] Invalid parsed job type:', currentJobType);
    setCurrentOrder(null);
    setCurrentOrderError('Invalid job type ID');
    setCurrentOrderLoading(false);
    return;
  }

  getOrderDetails(parsedJobType);
  fetchRKpis(parsedJobType);
  fetchPlcMonitor();
}, [currentJobType, refreshTrigger]);

  const handleRefreshKpis = () => {
    if (!currentJobType) return;
    const parsedJobType = parseInt(currentJobType, 10);
    if (!Number.isNaN(parsedJobType) && parsedJobType > 0) {
      fetchRKpis(parsedJobType);
    }
  };

  const handleRefreshPlcLogs = () => {
    fetchPlcMonitor();
  };

 const sendCommandToPlc = async (commandName) => {
  try {
    setSendCommandLoading(true);

    const parsedJobType = parseInt(currentJobType, 10);
    if (!parsedJobType || Number.isNaN(parsedJobType)) {
      toast.error('Missing or invalid job type ID');
      return;
    }

    if (commandName === 'EnableFeeding') {
      setFeedingState(prev => ({
        ...prev,
        loading: true,
        lastActionSuccess: null
      }));

      const actualCommand = feedingState.enabled ? 'DisableFeeding' : 'EnableFeeding';
      const response = await axios.post(endpoints.controlPanel.send, {
        command: actualCommand,
        job_type_id: parsedJobType  // ✅ Include this
      });

      if (response.status === 200) {
        setFeedingState(prev => ({
          enabled: !prev.enabled,
          loading: false,
          lastActionSuccess: 'success'
        }));
        toast.success(`Feeding ${feedingState.enabled ? 'disabled' : 'enabled'} successfully`);
      } else {
        setFeedingState(prev => ({
          ...prev,
          loading: false,
          lastActionSuccess: 'error'
        }));
        toast.error('Failed to toggle feeding');
      }
      return;
    }

    const response = await axios.post(endpoints.controlPanel.send, {
      command: commandName,
      job_type_id: parsedJobType  // ✅ Include this
    });

    if (response.status === 200) {
      toast.success('Command sent successfully');
    }
  } catch (error) {
    console.error(error.response);
    if (commandName === 'EnableFeeding') {
      setFeedingState(prev => ({
        ...prev,
        loading: false,
        lastActionSuccess: 'error'
      }));
    }
    toast.error(
      'Failed to send command: ' + (error?.response?.data?.error ?? error.message)
    );
  } finally {
    setSendCommandLoading(false);
  }
};

  const getFeedingButtonClass = () => {
    if (feedingState.loading) {
      return 'bg-gray-500 dark:bg-gray-600 hover:bg-gray-500 animate-pulse';
    }
    if (feedingState.lastActionSuccess === 'error') {
      return 'bg-red-600 dark:bg-red-800 hover:bg-red-600';
    }
    return feedingState.enabled 
      ? 'bg-green-600 dark:bg-green-800 hover:bg-green-600'
      : 'bg-teal-600 dark:bg-teal-800 hover:bg-teal-600';
  };

  const controlButtonActions = [
    {
      name: 'Start',
      icon: FaPlay,
      action: () => sendCommandToPlc('Start'),
      className: 'bg-green-700 dark:bg-green-900 hover:bg-green-700',
    },
    {
      name: 'Stop',
      icon: FaStop,
      action: () => sendCommandToPlc('Stop'),
      className: 'bg-red-700 dark:bg-red-900 hover:bg-red-700',
    },
    {
      name: 'Abort',
      icon: FaInfoCircle,
      action: () => sendCommandToPlc('Abort'),
      className: 'bg-purple-700 dark:bg-purple-900 hover:bg-purple-700',
    },
    {
      name: 'Hold',
      icon: FaPause,
      action: () => sendCommandToPlc('Hold'),
      className: 'bg-yellow-700 dark:bg-yellow-900 hover:bg-yellow-700',
    },
    {
      name: 'Resume',
      icon: FaPlay,
      action: () => sendCommandToPlc('Resume'),
      className: 'bg-blue-700 dark:bg-blue-900 hover:bg-blue-700',
    },
    {
      name: 'Reset',
      icon: FaRedo,
      action: () => sendCommandToPlc('Reset'),
      className: 'bg-gray-700 dark:bg-gray-800 hover:bg-gray-700',
    },
    {
      name: feedingState.enabled ? 'Disable Feeding' : 'Enable Feeding',
      icon: HiMiniInboxArrowDown,
      action: () => sendCommandToPlc('EnableFeeding'),
      className: getFeedingButtonClass(),
      disabled: feedingState.loading
    },
    {
      name: 'Next Receiver',
      icon: TbPlayerTrackNextFilled,
      action: () => sendCommandToPlc('NextReceiver'),
      className: 'bg-indigo-700 dark:bg-indigo-900 hover:bg-indigo-700',
    },
    {
      name: 'Emergency',
      icon: FaExclamationTriangle,
      action: () => sendCommandToPlc('E-Stop'),
      className: 'bg-orange-700 dark:bg-orange-900 hover:bg-orange-700',
    },
  ];

  const details = [
    { label: 'Order ID', value: currentOrder?.id },
    { label: 'Job Type', value: currentOrder?.job_type },
    { label: 'Recipe', value: currentOrder?.recipe_name },
    {
      label: 'Created At',
      value: currentOrder?.created_at
        ? new Date(currentOrder.created_at).toLocaleString()
        : '',
    },
  ];

  const [activeTab, setActiveTab] = useState(0);
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <div className="w-full">
      {/* Command Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2 w-full mb-4">
        {controlButtonActions.map((button, idx) => (
          <div key={idx}>
            <BPControlButton
              name={button.name}
              icon={button.icon}
              action={button.action}
              className={button.className}
              disabled={button.disabled}
            />
          </div>
        ))}
      </div>

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">About This System</h2>
            <div className="space-y-3 mb-6">
              <p>This is the production control panel that allows you to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Monitor current production orders</li>
                <li>Control the production process</li>
                <li>View real-time KPIs and metrics</li>
                <li>Access PLC status and logs</li>
              </ul>
            </div>
            <div className="flex justify-end">
              <button 
                onClick={() => setShowAboutModal(false)}
                className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {currentOrderLoading ? (
        <LoadingScreen />
      ) : currentOrderError ? (
        <ErrorScreen message={currentOrderError} />
      ) : !currentOrder ? (
        <ErrorScreen message="No active order for this job type" />
      ) : (
        <>
          {sendCommandLoading && <LoadingScreen />}

          {/* Active Order Header */}
          <div className="active-order-header w-full mb-3">
            <div className="w-full border-2 border-green-300 dark:border-green-900 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-6 py-2 rounded-lg shadow-md shadow-green-900">
              <h3 className="text-xl font-semibold mb-4 text-center">
                Active Order Details
              </h3>
              <div className="flex justify-evenly space-x-4">
                {details.map((detail, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap justify-center items-center space-x-2"
                  >
                    <b>{detail.label}:</b>
                    <span>{detail.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Inputs and Outputs */}
          <div className="inputs-outputs-section w-full mb-3">
            <h3 className="text-xl font-semibold mb-4 text-center text-zinc-900 dark:text-zinc-100">
              Inputs and Outputs
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Inputs */}
           <FlexContainer>
  {currentOrder?.sources.map((source, idx) => (
    <FlexItem
      key={idx}
      borderColor="border-blue-300 dark:border-blue-500"
    >
      <h4 className="text-center font-bold mb-2">
        Input
      </h4>
      <hr className="border-zinc-400 dark:border-zinc-600 mb-2" />
      <p className="text-center">
        <span className="font-semibold"></span> {source.prd_name || 'Unknown'}<br />
        <span className="font-semibold"></span> {source.bin_name || 'Unknown'}
      </p>
    </FlexItem>
  ))}
</FlexContainer>


              {/* Outputs */}
              <FlexContainer>
  {currentOrder?.destinations.map((destination, idx) => (
    <FlexItem
      key={idx}
      borderColor="border-green-300 dark:border-green-500"
    >
      <h4 className="text-center font-bold mb-2">
        Output {destination.destination_number}
      </h4>
      <hr className="border-zinc-400 dark:border-zinc-600 mb-2" />
      <p className="text-center">
        <span className="font-semibold"></span> {destination.prd_name}<br />
        <span className="font-semibold"></span> {destination.bin_name}
      </p>
    </FlexItem>
  ))}
</FlexContainer>
            </div>
          </div>

          {/* Tabs */}
          <div className="border border-t-0 border-zinc-700 rounded-lg shadow-md shadow-zinc-500">
            <Box sx={{ width: '100%' }}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                variant="fullWidth"
                scrollButtons="auto"
                allowScrollButtonsMobile
                className="bg-zinc-100 dark:bg-zinc-800 rounded-lg"
              >
                <Tab
                  className="2xl:!text-lg dark:hover:bg-zinc-700 hover:bg-zinc-200 transition-all ease-in-out duration-300"
                  label="KPIs"
                />
                <Tab
                  className="2xl:!text-lg dark:hover:bg-zinc-700 hover:bg-zinc-200 transition-all ease-in-out duration-300"
                  label="Stop Options"
                />
                <Tab
                  className="2xl:!text-lg dark:hover:bg-zinc-700 hover:bg-zinc-200 transition-all ease-in-out duration-300"
                  label="PLC Logs"
                />
              </Tabs>

              {/* --- Tab #0: KPIs --- */}
              {activeTab === 0 && (
                <Box p={3}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold">
                      Key Performance Indicators (KPIs)
                    </h3>
                    <Button
                      startIcon={<FaSync />}
                      onClick={handleRefreshKpis}
                      variant="contained"
                      color="info"
                      size="small"
                      className="!min-w-[120px]"
                    >
                      Refresh KPIs
                    </Button>
                  </div>

                  {rKpisError && (
                    <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 p-3 rounded-lg mb-4">
                      {rKpisError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {currentOrder?.kpi_definitions.map((kdef, idx) => {
                      const orderKpiObj = currentOrder.kpis?.[kdef.kpi_name];
                      let displayedValue = orderKpiObj?.value ?? kdef.default_value;

                      if (kdef.read_write === 'R') {
                        const realKpi = rKpis.find(rk => rk.kpi_name === kdef.kpi_name);
                        if (realKpi) {
                          displayedValue = realKpi.value;
                        }
                      }

                      return (
                        <div 
                          key={idx}
                          className="bg-white dark:bg-zinc-800 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 p-4 flex flex-col items-center justify-center h-full"
                        >
                          <h4 className="text-center font-bold mb-2 text-sm md:text-base">
                            {kdef.kpi_name}
                          </h4>
                          <hr className="border-zinc-300 dark:border-zinc-600 w-full mb-3" />
                          <div className="text-2xl font-bold text-center py-2 w-full">
                            {displayedValue}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {kdef.read_write === 'R' ? 'Real-time' : 'Static'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Box>
              )}

              {/* --- Tab #1: Stop Options --- */}
              {activeTab === 1 && (
                <Box p={3}>
                  <h3 className="text-xl font-semibold mb-4 text-center">
                    Stop Options
                  </h3>
                  <div className="flex flex-wrap justify-center gap-4 capitalize">
                    {Object.entries(currentOrder?.stop_options || {}).map(
                      ([key, value], idx) => (
                        <div
                          key={idx}
                          className="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 p-2 rounded-lg shadow-md border border-zinc-300 dark:border-zinc-600"
                        >
                          <b>{key.replace(/_/g, ' ')}:</b>
                          <span>
                            {typeof value === 'boolean'
                              ? value
                                ? 'Yes'
                                : 'No'
                              : `${value} S`}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </Box>
              )}

              {/* --- Tab #2: PLC Logs --- */}
              {activeTab === 2 && (
                <Box p={3}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold">
                      PLC Logs
                    </h3>
                    <Button
                      startIcon={<FaSync />}
                      onClick={handleRefreshPlcLogs}
                      variant="contained"
                      color="secondary"
                      size="small"
                      className="!min-w-[120px]"
                    >
                      Refresh Logs
                    </Button>
                  </div>

                  {/* Show PLC loading or error */}
                  {plcLoading && <LoadingScreen />}
                  {plcMonitorError && (
                    <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 p-3 rounded-lg mb-4">
                      {plcMonitorError}
                    </div>
                  )}

                  {plcMonitor ? (
                    <div className="space-y-4">
                      {/* Example: we show the 'OS_Comment' */}
                      <div className="border p-2 rounded">
                        <b>OS_Comment:</b> {plcMonitor.OS_Comment}
                      </div>
                      {/* Show run/idle bits */}
                      <div className="border p-2 rounded">
                        <b>Run:</b> {plcMonitor.Run ? 'Yes' : 'No'}
                        {' / '}
                        <b>Idle:</b> {plcMonitor.Idle ? 'Yes' : 'No'}
                      </div>
                      {/* ActiveDest info */}
                      <div className="border p-2 rounded">
                        <h4 className="font-bold">ActiveDest:</h4>
                        <ul>
                          <li>dest_no: {plcMonitor.ActiveDest?.dest_no}</li>
                          <li>dest_bin_id: {plcMonitor.ActiveDest?.dest_bin_id}</li>
                          <li>prd_code: {plcMonitor.ActiveDest?.prd_code}</li>
                        </ul>
                      </div>
                      {/* WaterConsumed */}
                      <div className="border p-2 rounded">
                        <b>WaterConsumed:</b> {plcMonitor.WaterConsumed}
                      </div>
                      {/* ProducedWeight */}
                      <div className="border p-2 rounded">
                        <b>ProducedWeight:</b> {plcMonitor.ProducedWeight}
                      </div>
                      {/* ActiveSources array */}
                      <div className="border p-2 rounded">
                        <h4 className="font-bold mb-2">Active Sources:</h4>
                        <ul className="ml-4 list-disc">
                          {plcMonitor.ActiveSources?.map((src) => (
                            <li key={src.source_index}>
                              Source #{src.source_index} = bin_id: {src.bin_id},{' '}
                              qty_percent: {src.qty_percent}%, produced_qty: {src.produced_qty}, code: {src.prd_code},{' '}
                              active? {src.active ? 'Yes' : 'No'}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {/* JobStatusCode */}
                      <div className="border p-2 rounded">
                        <b>JobStatusCode:</b> {plcMonitor.JobStatusCode}
                      </div>
                    </div>
                  ) : (
                    <div>[No PLC logs loaded]</div>
                  )}
                </Box>
              )}
            </Box>
          </div>
        </>
      )}
    </div>
  );
};

export default BPActiveOrderDetails;