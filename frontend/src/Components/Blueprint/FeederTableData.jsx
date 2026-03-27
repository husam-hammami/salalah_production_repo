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
import FeederPopupModal from './FeederPopupModal'; // ✅ Make sure it's imported
import LoadingScreen from '../Common/LoadingScreen';
import ConfirmationModal from '../Common/ConfirmationModal';
import ErrorScreen from '../Common/ErrorScreen';
import { JobTypesContext } from '../../Context/ApiContext/JobTypesContext';
import { FeederOrdersContext } from './FeederOrdersContext';
import axios from '../../API/axios';
import { toast } from 'react-toastify';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import useLoading from '../../Hooks/useLoading';

const FeederTableConfig = {
  headers: ['Order Name', 'Recipe', 'Status', 'Created At'],
  dataKeys: ['order_name', 'recipe_name', 'status', 'created_at']
};

function FeederTableData({ setCurrentJobType, onOrderAction }) {
  const loading = useLoading();
  const { jobTypes } = useContext(JobTypesContext);
  const {
    orders,
    setOrders,
    ordersLoading,
    setOrdersLoading,
    ordersError,
    refreshOrders
  } = useContext(FeederOrdersContext);

  const [filter, setFilter] = useState('all-job-types');
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [preDelete, setPreDelete] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);

  const filterOptions = [
    { label: 'All job types', value: 'all-job-types' },
    ...jobTypes.map(job => ({ value: job.id, label: job.name }))
  ];

  const applyFilter = useCallback(() => {
    if (filter === 'all-job-types') {
      setFilteredOrders(orders);
      setCurrentJobType('all-job-types');
    } else {
      const filtered = orders.filter(order => order.job_type_id === parseInt(filter));
      setFilteredOrders(filtered);
      setCurrentJobType(parseInt(filter));
    }
  }, [filter, orders, setCurrentJobType]);

  useEffect(() => {
    applyFilter();
  }, [filter, orders, applyFilter]);

  const handleFilterChange = event => setFilter(event.target.value);

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
      const response = await axios.delete(`/orders/feeder-orders/delete/${id}`);
      if (response.status === 200) {
        await refreshOrders();
        toast.success('The order has been deleted.');
      } else {
        toast.error('Failed to delete order');
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to delete order');
    } finally {
      setOrdersLoading(false);
      setPreDelete(null);
    }
  };

  const releaseOrder = async id => {
  try {
    console.log('[🚀 Feeder Release Order] ID:', id);
    setOrdersLoading(true);

    const response = await axios.post(`orders/feeder-orders/release/${id}`);

    if (response.status === 200) {
      toast.success(`Order is now ${response.data.status}`);
      const updatedOrders = await refreshOrders() || [];
      const releasedOrder = updatedOrders.find(o => o.id === id);

      if (releasedOrder) {
        console.log('[🎯 Updating jobType]', releasedOrder.job_type_id);
        setCurrentJobType(releasedOrder.job_type_id);
      } else {
        console.warn('[⚠️ Not found in refreshed orders]');
      }

      if (onOrderAction) {
        console.log('[ Triggering onOrderAction]');
        onOrderAction();
      }
    } else {
      toast.error('Release failed');
    }
  } catch (error) {
    toast.error(error?.response?.data?.error || 'Release failed');
  } finally {
    setOrdersLoading(false);
  }
};


  const duplicateOrder = async id => {
    try {
      setOrdersLoading(true);
      const response = await axios.post(`orders/feeder-orders/duplicate/${id}`);
      if (response.status === 200) {
        await refreshOrders();
        toast.success('The order has been duplicated.');
      } else {
        toast.error('Failed to duplicate order');
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to duplicate order');
    } finally {
      setOrdersLoading(false);
    }
  };

  const actions = [
    { name: 'Release', icon: FaPaperPlane, className: '!bg-green-700 !text-zinc-50 hover:!bg-green-500', action: releaseOrder },
    { name: 'Edit', icon: FaEdit, className: '!bg-gray-500 !text-zinc-50 hover:!bg-gray-400', action: () => null },
    { name: 'Duplicate', icon: FaCopy, className: '!bg-blue-500 !text-zinc-50 hover:!bg-blue-400', action: duplicateOrder },
    { name: 'Remove', icon: FaTrash, className: '!bg-red-500 !text-zinc-50 hover:!bg-red-400', action: handleDeleteConfirmation }
  ];

  const handleOpenModal = () => setModalOpen(true);
  const handleCloseModal = () => setModalOpen(false);

  if (loading) return <LoadingScreen />;

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
          <div className="flex justify-start items-center p-2">
            <span className="mr-2">Filter By: </span>
            <FormControl variant="outlined" className="w-48">
              <InputLabel>Job Type</InputLabel>
              <Select value={filter} onChange={handleFilterChange} label="Job Type">
                {filterOptions.map((option, index) => (
                  <MenuItem key={index} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>

          <table className="w-full table-auto border-collapse border border-zinc-400 dark:border-zinc-700 border-t-0 rounded-lg">
            <thead className="bg-zinc-400 dark:bg-zinc-700">
              <tr className="text-center">
                {FeederTableConfig.headers.map((header, index) => (
                  <th key={index} className="font-bold text-zinc-900 dark:text-zinc-100 p-3">{header}</th>
                ))}
                <th className="font-bold text-zinc-900 dark:text-zinc-100 p-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {ordersLoading ? (
                <tr><td colSpan={FeederTableConfig.headers.length + 1} className="text-center"><LoadingScreen /></td></tr>
              ) : ordersError ? (
                <tr><td colSpan={FeederTableConfig.headers.length + 1} className="text-center"><ErrorScreen message={ordersError} handleRefresh={refreshOrders} /></td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={FeederTableConfig.headers.length + 1} className="text-center text-lg text-gray-600 dark:text-gray-400">No Data Available</td></tr>
              ) : (
                filteredOrders.map(row => (
                  <tr
                    key={row.id}
                    className={`border-s-8 dark:hover:bg-opacity-20 hover:bg-opacity-30 text-center ${
                      row.status === 'queued' ? 'border-yellow-500 hover:bg-yellow-300 dark:hover:bg-yellow-400'
                      : row.status === 'idle' ? 'border-blue-500 hover:bg-blue-300 dark:hover:bg-blue-400'
                      : row.status === 'active' ? 'border-green-500 hover:bg-green-300 dark:hover:bg-green-400' : ''}`}
                  >
                    {FeederTableConfig.dataKeys.map((key, index) => (
                      <td key={index} className="text-zinc-900 dark:text-zinc-100 p-3 border border-zinc-600">
                        {key === 'created_at' ? new Date(row[key]).toLocaleString() : row[key]}
                      </td>
                    ))}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <FeederPopupModal
  open={isModalOpen}
  onClose={handleCloseModal}
  jobTypeId={filter === 'all-job-types' ? null : parseInt(filter)}
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

export default FeederTableData;
