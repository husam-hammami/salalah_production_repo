import useChangeTitle from '../Hooks/useChangeTitle';
import { Box } from '@mui/material';
import AddMaterial from '../Components/Material/AddMaterial';
import TableData from '../Components/Common/TableData';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { materialTableConfig } from '../Data/Materials';
import { useContext, useState } from 'react';
import { MaterialsContext } from '../Context/ApiContext/MaterialsContext';
import LoadingScreen from '../Components/Common/LoadingScreen';
import ErrorScreen from '../Components/Common/ErrorScreen';
import useLoading from '../Hooks/useLoading';
import { toast } from 'react-toastify';
import endpoints from '../API/endpoints';
import axios from '../API/axios';
import ConfirmationModal from '../Components/Common/ConfirmationModal';
import EditMaterialModal from '../Components/Material/EditMaterial';

const MaterialForm = () => {
  useChangeTitle('Material');
  const loading = useLoading();

  const {
    materials,
    materialLoading,
    setMaterialLoading,
    materialError,
    refreshMaterials,
  } = useContext(MaterialsContext);

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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [preDelete, setPreDelete] = useState(null);
  const handleDeleteConfirmation = id => {
    setPreDelete(id);
    setIsModalOpen(true);
  };
  const cancelDelete = () => {
    setIsModalOpen(false);
  };
  const removeMaterial = async id => {
    try {
      setIsModalOpen(false);
      setMaterialLoading(true);
      const response = await axios.delete(endpoints.materials.delete(id));
      if (response.status === 200) {
        refreshMaterials();
        toast.success('The material has been deleted.');
      }
    } catch (error) {
      console.error(error.response);
      toast.error('Failed to remove material: ' + error.response.data.error);
    } finally {
      setMaterialLoading(false);
    }
  };

  const actions = [
    {
      name: 'Edit',
      icon: FaEdit,
      className:
        '!bg-blue-800 dark:!bg-blue-500 !text-white hover:!bg-blue-700 dark:hover:!bg-blue-400',
      action: editData,
    },
    {
      name: 'Delete',
      icon: FaTrash,
      className:
        '!bg-red-800 dark:!bg-red-500 !text-white hover:!bg-red-700 dark:hover:!bg-red-400',
      action: handleDeleteConfirmation,
    },
  ];

  return (
    <>
      {loading || materialLoading ? (
        <LoadingScreen />
      ) : materialError ? (
        <>
          <div className="flex justify-center items-center">
            <Box className="w-full max-w-8xl 2xl:p-5 p-3 pt-0 rounded-md shadow-xl bg-white text-black dark:!bg-gradient-to-r dark:from-[#0B1F3A] dark:to-[#1F3D63] dark:text-white">
              <AddMaterial />
            </Box>
          </div>
          <ErrorScreen
            message={materialError}
            handleRefresh={refreshMaterials}
          />
        </>
      ) : (
        <>
          <div className="flex justify-center items-center">
            <Box className="w-full 2xl:p-5 2xl:pt-0 p-3 pt-0 max-w-8xl bg-zinc-200 dark:bg-gradient-to-r dark:from-[#0B1F3A] dark:to-[#1F3D63] rounded-md shadow-xl dark:text-white">
              <AddMaterial />
              <TableData
                headers={materialTableConfig.headers}
                data={materials}
                dataKeys={materialTableConfig.dataKeys}
                actions={actions}
              />
            </Box>
            {isModalOpen && (
              <ConfirmationModal
                isOpen={isModalOpen}
                title="Confirm Deletion"
                description="Are you sure you want to delete this material?"
                onConfirm={removeMaterial}
                id={preDelete}
                onCancel={cancelDelete}
                confirmText="Delete"
                cancelText="Cancel"
              />
            )}
            {isEditModalOpen && (
              <EditMaterialModal id={selectedId} onClose={closeEditModal} />
            )}
          </div>
        </>
      )}
    </>
  );
};

export default MaterialForm;
