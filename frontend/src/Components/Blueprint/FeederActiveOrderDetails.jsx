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
import { useEffect, useState, useContext } from 'react';
import { Tabs, Tab, Box, Button } from '@mui/material';
import { FlexContainer, FlexItem } from './FlexContainer';
import axios from '../../API/axios';
import LoadingScreen from '../Common/LoadingScreen';
import ErrorScreen from '../Common/ErrorScreen';
import { toast } from 'react-toastify';
import { FeederOrdersContext } from './FeederOrdersContext';

const FeederActiveOrderDetails = ({ refreshTrigger }) => {
  const { orders } = useContext(FeederOrdersContext);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [currentOrderLoading, setCurrentOrderLoading] = useState(true);
  const [currentOrderError, setCurrentOrderError] = useState(null);
  const [sendCommandLoading, setSendCommandLoading] = useState(false);
  
  // Enhanced feeding state with status tracking
  const [feedingState, setFeedingState] = useState({
    enabled: false,
    loading: false,
    lastActionSuccess: null // 'success', 'error', or null
  });

  // PLC Monitor logs
  const [plcMonitor, setPlcMonitor] = useState(null);
  const [plcMonitorError, setPlcMonitorError] = useState('');
  const [plcLoading, setPlcLoading] = useState(false);

  const [activeTab, setActiveTab] = useState(0);
  console.log('[🧾 orders]', orders);
  const activeOrder = orders.find(o => o.status === 'active');

 const getFeederOrderDetails = async (jobTypeId) => {
  try {
    setCurrentOrderLoading(true);

    const response = await axios.get(`/orders/get-feeder-active-order?job_type_id=${jobTypeId}`);
    
    if (response.status === 200 && response.data) {
      setCurrentOrder(response.data);
      setCurrentOrderError(null);
    } else {
      setCurrentOrder(null);
      setCurrentOrderError('Error fetching active feeder order');
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      setCurrentOrderError('No active feeder order found for this job type.');
    } else {
      setCurrentOrderError('Error fetching feeder order: ' + (error.message || 'Unknown error'));
    }
    setCurrentOrder(null);
  } finally {
    setCurrentOrderLoading(false);
  }
};


  const fetchPlcMonitor = async () => {
    if (!currentOrder) return;
    try {
      setPlcLoading(true);
      setPlcMonitorError('');
      const resp = await axios.get(`/orders/plc-monitor?job_type_id=${currentOrder.job_type_id}`);
      
      if (resp.status === 200) {
        setPlcMonitor(resp.data);
        
        if (resp.data.FeedingEnabled !== undefined) {
          setFeedingState(prev => ({
            ...prev,
            enabled: resp.data.FeedingEnabled,
            lastActionSuccess: 'success'
          }));
        }
      } else {
        setPlcMonitor(null);
        setPlcMonitorError('Could not fetch PLC logs');
      }
    } catch (err) {
      setPlcMonitor(null);
      setPlcMonitorError('Error fetching PLC logs: ' + err.message);
    } finally {
      setPlcLoading(false);
    }
  };

  const sendCommandToPlc = async (commandName) => {
    if (!currentOrder) return;
    try {
      setSendCommandLoading(true);

      if (commandName === 'EnableFeeding') {
        setFeedingState(prev => ({
          ...prev,
          loading: true,
          lastActionSuccess: null
        }));

        const actualCommand = feedingState.enabled ? 'DisableFeeding' : 'EnableFeeding';
        const response = await axios.post('/orders/send-command', {
          command: actualCommand,
          job_type_id: currentOrder.job_type_id
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

      const response = await axios.post('/orders/send-command', {
        command: commandName,
        job_type_id: currentOrder.job_type_id
      });

      if (response.status === 200) {
        toast.success(`${commandName} command sent successfully`);
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

useEffect(() => {
     console.log('[🔍 activeOrder]', activeOrder);
  if (activeOrder) {
    console.log('[🚀 Calling getFeederOrderDetails with]', activeOrder.job_type_id);
    getFeederOrderDetails(activeOrder.job_type_id || activeOrder.jobTypeId);
  } else {
    setCurrentOrder(null);
    setCurrentOrderLoading(false); // ← critical
    setCurrentOrderError(null);
  }
}, [activeOrder, refreshTrigger]);

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

if (currentOrderLoading) return <LoadingScreen />;

if (currentOrderError) return (
  <ErrorScreen message={currentOrderError} />
);

// Friendly fallback if no order is active
if (!currentOrder) {
  return (
    <div className="w-full bg-zinc-100 dark:bg-zinc-800 text-center text-zinc-900 dark:text-zinc-100 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-2">No Active Feeder Order</h2>
      <p className="text-base">Please release a feeder order to begin.</p>
    </div>
  );
}

  return (
    <div className="w-full">
      {sendCommandLoading && <LoadingScreen />}

   <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 w-full mb-6 px-2">
  {controlButtonActions.map((button, idx) => (
    <div key={idx} className="flex justify-center">
      <BPControlButton
        name={button.name}
        icon={button.icon}
        action={button.action}
        className={`${button.className} w-full py-2 text-sm md:text-base`}
        disabled={button.disabled}
      />
    </div>
  ))}
</div>

      <div className="w-full border-2 border-green-300 dark:border-green-900 bg-zinc-100 dark:bg-zinc-800 px-6 py-2 rounded-lg mb-4">
        <h3 className="text-xl font-semibold mb-2 text-center">Active Feeder Order</h3>
        <div className="flex justify-evenly space-x-4">
          {details.map((detail, idx) => (
            <div key={idx} className="flex space-x-2">
              <b>{detail.label}:</b>
              <span>{detail.value}</span>
            </div>
          ))}
        </div>
      </div>

      <Box sx={{ width: '100%' }}>
        <Tabs
          value={activeTab}
          onChange={(e, val) => setActiveTab(val)}
          variant="fullWidth"
          className="bg-zinc-100 dark:bg-zinc-800 rounded-lg"
        >
          <Tab label="KPIs" />
          <Tab label="Feeders" />
          <Tab label="PLC Logs" />
        </Tabs>

        {activeTab === 0 && (
          <Box p={3}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
   {Object.values(currentOrder.kpis || {}).map((kpi, idx) => (
  <div
    key={idx}
    className="bg-white dark:bg-zinc-800 rounded-lg shadow-md border p-4 flex flex-col items-center justify-center h-full"
  >
    <h4 className="text-center font-bold mb-2">{kpi.kpi_name}</h4>
    <div className="text-2xl font-bold">{kpi.value ?? 0}</div>
    <div className="text-xs text-zinc-500 mt-1">{kpi.read_write === 'R' ? 'Real-time' : 'Static'}</div>
  </div>
))
}
            </div>
          </Box>
        )}

        {activeTab === 1 && (
          <Box p={3}>
            <FlexContainer>
  {(currentOrder.feeders || []).map((feeder, idx) => (
    <FlexItem key={idx} borderColor="border-blue-400 dark:border-blue-600">
      <h4 className="text-center font-bold mb-2">
        Feeder #{feeder.feeder_number}
      </h4>
      <p className="text-center">
        {feeder.material_name}
        <br />
        <span className="text-sm text-zinc-500">{feeder.bin_name}</span>
      </p>
    </FlexItem>
  ))}
</FlexContainer>
          </Box>
        )}

        {activeTab === 2 && (
          <Box p={3}>
            <Button
              startIcon={<FaSync />}
              onClick={fetchPlcMonitor}
              variant="contained"
              color="secondary"
              size="small"
              className="!min-w-[120px] mb-4"
            >
              Refresh Logs
            </Button>

            {plcLoading && <LoadingScreen />}
            {plcMonitorError && <ErrorScreen message={plcMonitorError} />}
            {plcMonitor && (
              <pre className="text-sm bg-zinc-100 dark:bg-zinc-800 p-3 rounded-lg overflow-auto">
                {JSON.stringify(plcMonitor, null, 2)}
              </pre>
            )}
          </Box>
        )}
      </Box>
    </div>
  );
};

export default FeederActiveOrderDetails;