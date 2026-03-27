import { Box } from '@mui/material';
import useChangeTitle from '../Hooks/useChangeTitle';
import { binTableConfig } from '../Data/Bin';
import { FaMinus } from 'react-icons/fa';
import TableData from '../Components/Common/TableData';
import BinAssignment from '../Components/Bin/BinAssignment';
import useLoading from '../Hooks/useLoading';
import LoadingScreen from '../Components/Common/LoadingScreen';
import { useContext, useState } from 'react';
import { BinsContext } from '../Context/ApiContext/BinsContext';
import ErrorScreen from '../Components/Common/ErrorScreen';
import axios from '../API/axios';
import endpoints from '../API/endpoints';
import { toast } from 'react-toastify';
import ConfirmationModal from '../Components/Common/ConfirmationModal';
import { MaterialsContext } from '../Context/ApiContext/MaterialsContext';

function Bin() {
  useChangeTitle('Bin');
  const loading = useLoading();

  const { bins, binsLoading, setBinsLoading, binsError, refreshBins } = useContext(BinsContext);
  const { materialsLoading } = useContext(MaterialsContext);

  // unassign bin modal logic
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [preUnassign, setPreUnassign] = useState(null);

  const handleUnassignConfirmation = id => {
    setPreUnassign(id);
    setIsModalOpen(true);
  };

  const cancelUnassign = () => {
    setIsModalOpen(false);
  };

  const unassignBin = async id => {
    try {
      setIsModalOpen(false);
      setBinsLoading(true);
      const response = await axios.post(endpoints.bins.unassign(id));
      if (response.status === 200) {
        refreshBins();
        toast.success('The bin has been unassigned.');
      }
    } catch (error) {
      console.error(error.response);
      toast.error('Failed to unassign bin: ' + error.response.data.error);
    } finally {
      setBinsLoading(false);
    }
  };

  const actions = [
    {
      name: 'Unassign Bin',
      icon: FaMinus,
      className:
        '!bg-red-800 dark:!bg-red-500 !text-zinc-50 hover:!bg-red-700 dark:hover:!bg-red-400',
      action: handleUnassignConfirmation,
    },
  ];

  return (
    <>
      {loading || binsLoading || materialsLoading ? (
        <LoadingScreen />
      ) : binsError ? (
        <>
          <div className="flex justify-center items-center">
            <Box className="w-full 2xl:p-5 2xl:pt-0 p-3 pt-0 max-w-8xl 
              bg-zinc-200 dark:bg-gradient-to-r dark:from-[#0B1F3A] dark:to-[#1F3D63]
              rounded-md shadow-xl dark:text-white">
              <BinAssignment />
            </Box>
          </div>
          <ErrorScreen handleRefresh={refreshBins} message={binsError} />
        </>
      ) : (
        <div className="flex justify-center items-center">
          <Box className="w-full 2xl:p-5 2xl:pt-0 p-3 pt-0 max-w-8xl 
            bg-zinc-200 dark:bg-gradient-to-r dark:from-[#0B1F3A] dark:to-[#1F3D63]
            rounded-md shadow-xl dark:text-white">
            {/* Bin Assignment Form */}
            <BinAssignment />

            {/* Bin Table with Unassign Actions */}
            <TableData
              headers={binTableConfig.headers}
              data={bins}
              dataKeys={binTableConfig.dataKeys}
              actions={actions}
            />
          </Box>

          {/* Confirmation Modal */}
          {isModalOpen && (
            <ConfirmationModal
              isOpen={isModalOpen}
              title="Confirm Un-Assignment"
              description="Are you sure you want to unassign this bin?"
              onConfirm={unassignBin}
              id={preUnassign}
              onCancel={cancelUnassign}
              confirmText="Un-Assign"
              cancelText="Cancel"
            />
          )}
        </div>
      )}
    </>
  );
}

export default Bin;
