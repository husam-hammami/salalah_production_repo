import useChangeTitle from '../Hooks/useChangeTitle';
import TableData from '../Components/Common/TableData';
import { FaTrash } from 'react-icons/fa';
import { userTableConfig } from '../Data/User';
import AddUser from '../Components/User/AddUser';
import useLoading from '../Hooks/useLoading';
import LoadingScreen from '../Components/Common/LoadingScreen';
import { useContext, useState } from 'react';
import { UsersContext } from '../Context/ApiContext/UsersContext';
import ErrorScreen from '../Components/Common/ErrorScreen';
import { Box } from '@mui/material';
import { toast } from 'react-toastify';
import axios from '../API/axios';
import endpoints from '../API/endpoints';
import ConfirmationModal from '../Components/Common/ConfirmationModal';

const User = () => {
  useChangeTitle('User');
  const loading = useLoading();

  const { users, usersLoading, setUsersLoading, userError, refreshUsers } =
    useContext(UsersContext);

  // delete user
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [preDelete, setPreDelete] = useState(null);

  const handleDeleteConfirmation = (id) => {
    setPreDelete(id);
    setIsModalOpen(true);
  };

  const cancelDelete = () => {
    setIsModalOpen(false);
  };

  const removeUser = async (id) => {
    try {
      setIsModalOpen(false);
      setUsersLoading(true);
      const response = await axios.delete(endpoints.users.delete(id));
      if (response.status === 200) {
        refreshUsers();
        toast.success('The user has been deleted.');
      }
    } catch (error) {
      console.error(error.response);
      toast.error('Failed to remove user: ' + error.response.data.error);
    } finally {
      setUsersLoading(false);
    }
  };

  const actions = [
    {
      name: 'Delete',
      icon: FaTrash,
      className:
        '!bg-red-800 dark:!bg-red-500 !text-zinc-50 hover:!bg-red-700 dark:hover:!bg-red-400',
      action: handleDeleteConfirmation,
    },
  ];

  return (
    <>
      {loading || usersLoading ? (
        <LoadingScreen />
      ) : userError ? (
        <ErrorScreen message={userError} handleRefresh={refreshUsers} />
      ) : (
        <div className="flex justify-center items-center">
          <Box
            className="w-full 2xl:p-5 2xl:pt-0 p-3 pt-0 max-w-8xl bg-zinc-200 dark:bg-gradient-to-r dark:from-[#0B1F3A] dark:to-[#1F3D63] rounded-md shadow-xl transition-all duration-300 dark:text-white"
          >
            {/* __________________Add User______________________ */}
            <AddUser />

            {/* __________________Table User______________________ */}
            <TableData
              headers={userTableConfig.headers}
              data={users}
              dataKeys={userTableConfig.dataKeys}
              actions={actions}
            />
          </Box>

          {isModalOpen && (
            <ConfirmationModal
              isOpen={isModalOpen}
              title="Confirm Deletion"
              description="Are you sure you want to delete this User?"
              onConfirm={removeUser}
              id={preDelete}
              onCancel={cancelDelete}
              confirmText="Delete"
              cancelText="Cancel"
            />
          )}
        </div>
      )}
    </>
  );
};

export default User;
