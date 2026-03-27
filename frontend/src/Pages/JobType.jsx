import useChangeTitle from '../Hooks/useChangeTitle';
import { Box } from '@mui/material';
import TableData from '../Components/Common/TableData';
import { FaEdit, FaTrash } from 'react-icons/fa';
import AddJobType from '../Components/JobType/AddJobType';
import AddKPI from '../Components/JobType/AddKPI';
import { KPITableConfig } from '../Data/JobType';
import useLoading from '../Hooks/useLoading';
import LoadingScreen from '../Components/Common/LoadingScreen';
import { useContext, useEffect, useState } from 'react';
import { JobTypesContext } from '../Context/ApiContext/JobTypesContext';
import axios from '../API/axios';
import endpoints from '../API/endpoints';
import ErrorScreen from '../Components/Common/ErrorScreen';
import ConfirmationModal from '../Components/Common/ConfirmationModal';
import { toast } from 'react-toastify';
import EditKpiModal from '../Components/JobType/EditKPI';

const JobType = () => {
  useChangeTitle('Job Type');
  const loading = useLoading();
  const { jobTypesLoading, jobTypesError, refreshJobTypes } = useContext(JobTypesContext);

  const [selectedJobType, setSelectedJobType] = useState(null);
  const [kpis, setKpis] = useState([]);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [kpisError, setKpisError] = useState(false);

  // Edit Modal
  const [selectedId, setSelectedId] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const editData = id => {
    setSelectedId(id);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setSelectedId(null);
    setIsEditModalOpen(false);
  };

  // Function to fetch KPIs
  const getKpis = async () => {
    try {
      setKpisLoading(true);
      console.log("Fetching KPIs for job type:", selectedJobType || 1);

      const response = await axios(`${endpoints.kpis.list(selectedJobType || 1)}`);
     

      // Ensure correct data format
      const kpiData = Array.isArray(response.data) ? response.data : response.data.kpis;
     

      // Check if the access field is present
      kpiData.forEach((kpi, index) => {
        console.log(`KPI ${index + 1} Access Value:`, kpi.access);
      });

      setKpis(kpiData);
    } catch (error) {
      setKpisError('Error fetching KPIs');
      console.error("Error fetching KPIs:", error);
    } finally {
      setKpisLoading(false);
    }
  };

  // Fetch KPIs when job type changes
  useEffect(() => {
    getKpis();
  }, [selectedJobType]);

  // Delete Modal and Delete Functionality
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [preDelete, setPreDelete] = useState(null);

  const handleDeleteConfirmation = id => {
    setPreDelete(id);
    setIsModalOpen(true);
  };

  const cancelDelete = () => {
    setIsModalOpen(false);
  };

  const removeKPI = async id => {
    try {
      setIsModalOpen(false);
      setKpisLoading(true);
      

      const response = await axios.delete(endpoints.kpis.delete(id));
      if (response.status === 200) {
        
        getKpis();
        toast.success('The KPI has been deleted.');
      } else {
        toast.error('Failed to delete KPI.');
      }
    } catch (error) {
      
      toast.error('Failed to remove KPI: ' + error.response.data.error);
    } finally {
      setKpisLoading(false);
    }
  };

  // Table Actions
  const actions = [
    {
      name: 'Edit',
      icon: FaEdit,
      className: '!bg-blue-800 dark:!bg-blue-500 !text-zinc-50 hover:!bg-blue-700 dark:hover:!bg-blue-400',
      action: editData,
    },
    {
      name: 'Delete',
      icon: FaTrash,
      className: '!bg-red-800 dark:!bg-red-500 !text-zinc-50 hover:!bg-red-700 dark:hover:!bg-red-400',
      action: handleDeleteConfirmation,
    },
  ];

  return (
    <>
      {loading ? (
        <LoadingScreen />
      ) : kpisError || jobTypesError ? (
        <>
          <div className="flex justify-center items-center">
            <Box className="w-full 2xl:p-5 p-3 max-w-8xl bg-zinc-200 dark:bg-zinc-800 rounded-md shadow-xl">
              <AddJobType />
            </Box>
          </div>
          <ErrorScreen
            message={jobTypesError || kpisError}
            handleRefresh={jobTypesError ? refreshJobTypes : getKpis}
          />
        </>
      ) : (
        <>
          {(jobTypesLoading || kpisLoading) && <LoadingScreen />}
          <div className="flex justify-center items-center">
            <Box className="w-full 2xl:p-5 p-3 max-w-8xl bg-zinc-200 dark:bg-zinc-800 rounded-md shadow-xl">
              <AddJobType />
              <AddKPI setSelectedJobType={setSelectedJobType} refreshKpis={getKpis} setKpisLoading={setKpisLoading} />
              <TableData
                headers={KPITableConfig.headers}
                data={kpis}
                dataKeys={KPITableConfig.dataKeys}
                actions={actions}
              />
            </Box>
            {isModalOpen && (
              <ConfirmationModal
                isOpen={isModalOpen}
                title="Confirm Deletion"
                description="Are you sure you want to delete this KPI?"
                onConfirm={removeKPI}
                id={preDelete}
                onCancel={cancelDelete}
                confirmText="Delete"
                cancelText="Cancel"
              />
            )}
            {isEditModalOpen && (
              <EditKpiModal id={selectedId} onClose={closeEditModal} refreshKpis={getKpis} />
            )}
          </div>
        </>
      )}
    </>
  );
};

export default JobType;
