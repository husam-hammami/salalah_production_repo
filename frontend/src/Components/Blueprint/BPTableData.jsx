import { useContext, useState, useEffect, useCallback } from 'react';
import {
  FaEdit,
  FaTrash,
  FaCopy,
  FaPaperPlane,
  FaPlusCircle,
} from 'react-icons/fa';
import BPActionButton from './BPActionButton';
import FlashButton from './FlashButton';
import BPPopupModal from './BPPopupModal';
import LoadingScreen from '../Common/LoadingScreen';
import ConfirmationModal from '../Common/ConfirmationModal';
import ErrorScreen from '../Common/ErrorScreen';
import { BPTableConfig } from '../../Data/Blueprint';
import { JobTypesContext } from '../../Context/ApiContext/JobTypesContext';
import { OrdersContext } from '../../Context/ApiContext/OrdersContext';
import axios from '../../API/axios';
import endpoints from '../../API/endpoints';
import { toast } from 'react-toastify';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import useLoading from '../../Hooks/useLoading';


function BPTableData({ setCurrentJobType , onOrderAction }) {
  const loading = useLoading();
  const { jobTypes } = useContext(JobTypesContext);
  const {
    orders,
    setOrders,
    ordersLoading,
    setOrdersLoading,
    ordersError,
    refreshOrders
  } = useContext(OrdersContext);
  

  const useFilter = {
    filterName: 'Job Type',
    options: [
      { label: 'All job types', value: 'all-job-types' },
      ...jobTypes.map(job => ({
        value: job.name,
        label: job.name,
      })),
    ],
  };

  const [filter, setFilter] = useState(useFilter?.options[0].value || '');
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [preDelete, setPreDelete] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
 




  // Memoized filter function
  const applyFilter = useCallback(() => {
    if (filter === 'all-job-types') {
      setFilteredOrders(orders);
      setCurrentJobType('all-job-types');
    } else {
      const filtered = orders.filter(order => order.job_type === filter);
      setFilteredOrders(filtered);

      const matchingJobType = jobTypes.find(jobType => jobType.name === filter);
      if (matchingJobType) {
        setCurrentJobType(matchingJobType.id);
      }
    }
  }, [filter, orders, jobTypes, setCurrentJobType]);

  useEffect(() => {
    applyFilter();
  }, [filter, orders, applyFilter]);

  const handleFilterChange = event => {
    setFilter(event.target.value);
  };

  const editData = () => {
    return null;
  };

  
const releaseOrder = async id => {
  try {
    console.log('[🚀 Release Order] Initiating release for order ID:', id);
    setOrdersLoading(true);

    const response = await axios.post(endpoints.orders.release(id));

    if (response.status === 200) {
      toast.success(`Order is now ${response.data.status}`);

      // 🔧 FIXED: fallback to empty array
      const updatedOrders = await refreshOrders() || [];

      const releasedOrder = updatedOrders.find(o => o.id === id);
      if (releasedOrder) {
        console.log('[🎯 Setting currentJobType to]', releasedOrder.job_type_id);
        setCurrentJobType(releasedOrder.job_type_id);
      } else {
        console.warn('[⚠️] Released order not found in updated order list.');
      }

      if (onOrderAction) {
        console.log('[🔥 onOrderAction] Bumping refreshTrigger...');
        onOrderAction();
      }
    } else {
      toast.error('Release failed');
      console.warn('[❌ Release Failed] Non-200 response:', response);
    }
  } catch (error) {
    const errMsg = error?.response?.data?.error || 'Release failed';
    toast.error(errMsg);
    console.error('[❌ Release Error]', errMsg);
    console.error('[🐞 Raw Error]', error);
  } finally {
    setOrdersLoading(false);
  }
};









  const duplicateOrder = async id => {
    try {
      setOrdersLoading(true);
      const response = await axios.post(endpoints.orders.duplicate(id));
      if (response.status === 200) {
        await refreshOrders();
        toast.success('The order has been duplicated.');
      } else {
        toast.error('Failed to duplicate order');
      }
    } catch (error) {
      console.error('Duplicate error:', error);
      const errorMsg = error.response?.data?.error || 'Failed to duplicate order';
      toast.error(errorMsg);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleDeleteConfirmation = id => {
    setPreDelete(id);
    setIsDeleteModalOpen(true);
  };

  const cancelDelete = () => {
    setIsDeleteModalOpen(false);
    setPreDelete(null);
  };

  const deleteOrder = async id => {
    try {
      setOrdersLoading(true);
      setIsDeleteModalOpen(false);
      const response = await axios.delete(endpoints.orders.delete(id));
      if (response.status === 200) {
        await refreshOrders();
        toast.success('The order has been deleted.');
      } else {
        toast.error('Failed to delete order');
      }
    } catch (error) {
      console.error('Delete error:', error);
      const errorMsg = error.response?.data?.error || 'Failed to delete order';
      toast.error(errorMsg);
    } finally {
      setOrdersLoading(false);
      setPreDelete(null);
    }
  };

  const actions = [
    {
      name: 'Release',
      icon: FaPaperPlane,
      className: '!bg-green-700 !text-zinc-50 hover:!bg-green-500',
      action: releaseOrder,
    },
    {
      name: 'Edit',
      icon: FaEdit,
      className: '!bg-gray-500 !text-zinc-50 hover:!bg-gray-400',
      action: editData,
    },
    {
      name: 'Duplicate',
      icon: FaCopy,
      className: '!bg-blue-500 !text-zinc-50 hover:!bg-blue-400',
      action: duplicateOrder,
    },
    {
      name: 'Remove',
      icon: FaTrash,
      className: '!bg-red-500 !text-zinc-50 hover:!bg-red-400',
      action: handleDeleteConfirmation,
    },
  ];

  const handleOpenModal = () => setModalOpen(true);
  const handleCloseModal = () => setModalOpen(false);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <div className="control relative w-full flex justify-between items-center">
        <FlashButton
          className="!bg-green-900 !text-zinc-50 hover:!text-zinc-950 hover:!bg-zinc-50 hover:shadow-zinc-200"
          title="Create order"
          icon={FaPlusCircle}
          action={handleOpenModal}
        />
        <div className="flex items-center justify-end space-x-4">
          <div className="flex items-center">
            <span className="w-4 h-4 bg-blue-500 inline-block rounded-full"></span>
            <span className="ml-2 text-zinc-900 dark:text-zinc-100">Idle</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 bg-yellow-500 inline-block rounded-full"></span>
            <span className="ml-2 text-zinc-900 dark:text-zinc-100">Queued</span>
          </div>
          <div className="flex items-center">
            <span className="w-4 h-4 bg-green-500 inline-block rounded-full"></span>
            <span className="ml-2 text-zinc-900 dark:text-zinc-100">Active</span>
          </div>
        </div>
      </div>
      
      <div className="my-table w-full zs rounded-lg text-sm md:text-md 2xl:text-lg">
        <div className="overflow-x-auto rounded-lg shadow-md">
          {useFilter && (
            <div className="flex justify-start items-center p-2">
              <span className="mr-2">Filter By: </span>
              <FormControl variant="outlined" className="w-48">
                <InputLabel>{useFilter.filterName}</InputLabel>
                <Select
                  value={filter}
                  onChange={handleFilterChange}
                  label="Job Type"
                >
                  {useFilter.options.map((option, index) => (
                    <MenuItem key={index} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          )}
          
          <table className="w-full table-auto border-collapse border border-zinc-400 dark:border-zinc-700 border-t-0 rounded-lg">
            <thead className="bg-zinc-400 dark:bg-zinc-700">
              <tr className="text-center">
                {BPTableConfig.headers?.map((header, index) => (
                  <th
                    key={index}
                    className="font-bold text-zinc-900 dark:text-zinc-100 p-3"
                  >
                    {header}
                  </th>
                ))}
                {actions && (
                  <th className="font-bold text-zinc-900 dark:text-zinc-100 p-3">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {ordersLoading ? (
                <tr>
                  <td 
                    colSpan={BPTableConfig.headers.length + (actions ? 1 : 0)}
                    className="text-center"
                  >
                    <LoadingScreen />
                  </td>
                </tr>
              ) : ordersError ? (
                <tr>
                  <td
                    colSpan={BPTableConfig.headers.length + (actions ? 1 : 0)}
                    className="text-center"
                  >
                    <ErrorScreen
                      message={ordersError}
                      handleRefresh={refreshOrders}
                    />
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={BPTableConfig.headers.length + (actions ? 1 : 0)}
                    className="text-center text-lg text-gray-600 dark:text-gray-400"
                  >
                    <div className="flex flex-col w-full items-center justify-center py-4">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-16 w-16 text-gray-400 dark:text-gray-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 17v2a1 1 0 001 1h4a1 1 0 001-1v-2m-6 0a4 4 0 018 0m-6 0v-2a4 4 0 011-2.917m3 2.917V9a4 4 0 00-8 0v2.083a4 4 0 001 2.917m4-6.583V7m0 4h.01"
                        />
                      </svg>
                      <h1 className="mt-4 text-xl font-medium text-gray-600 dark:text-gray-300">
                        No Data Available
                      </h1>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map(row => (
                  <tr
                    key={row.id}
                    className={`border-s-8 dark:hover:bg-opacity-20 hover:bg-opacity-30 text-center ${
                      row.status === 'queued'
                        ? 'border-yellow-500 hover:bg-yellow-300 dark:hover:bg-yellow-400'
                        : row.status === 'idle'
                        ? 'border-blue-500 hover:bg-blue-300 dark:hover:bg-blue-400'
                        : row.status === 'active'
                        ? 'border-green-500 hover:bg-green-300 dark:hover:bg-green-400'
                        : ''
                    } transition-all duration-300 ease-in-out`}
                  >
                    {BPTableConfig.dataKeys?.map((key, index) => (
                      <td
                        key={index}
                        className="text-zinc-900 dark:text-zinc-100 p-3 border border-zinc-600"
                      >
                        {row[key]}
                      </td>
                    ))}

                    {actions && (
                      <td className="text-zinc-900 dark:text-zinc-100 py-3 px-1 border border-zinc-600">
                        <div className="flex gap-3 md:gap-1 2xl:gap-2 justify-evenly 2xl:justify-center">
                          {actions.map((action, index) => (
                            <BPActionButton
                              key={index}
                              name={action.name}
                              icon={action.icon}
                              id={row.id}
                              action={action.action}
                              className={action.className}
                            />
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {isModalOpen && (
  <BPPopupModal
    open={isModalOpen}
    onClose={handleCloseModal}
    jobTypeId={filter === 'all-job-types' ? null : parseInt(filter)} // ✅ Add this
  />
)}
      
      {isDeleteModalOpen && (
        <ConfirmationModal
          isOpen={isDeleteModalOpen}
          title="Confirm Deletion"
          description="Are you sure you want to delete this order?"
          onConfirm={deleteOrder}
          id={preDelete}
          onCancel={cancelDelete}
          confirmText="Delete"
          cancelText="Cancel"
        />
      )}
    </>
  );
}

export default BPTableData;