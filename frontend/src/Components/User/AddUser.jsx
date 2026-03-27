import { toast } from 'react-toastify';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
} from '@mui/material';
import {
  AiOutlineEye,
  AiOutlineEyeInvisible,
  AiOutlinePlusCircle,
} from 'react-icons/ai';
import CircularButton from '../Common/CircularButton';
import InputField from '../Common/InputField';
import { addUserFormConfig } from '../../Data/User';
import axios from '../../API/axios';
import { useContext, useState } from 'react';
import endpoints from '../../API/endpoints';
import { UsersContext } from '../../Context/ApiContext/UsersContext';

function AddUser() {
  const { setUsersLoading, refreshUsers } = useContext(UsersContext);
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const formik = useFormik({
    initialValues: {
      username: '',
      password: '',
      role: '',  // Added the role field
    },
    validationSchema: Yup.object({
      username: Yup.string().required('Name is required'),
      password: Yup.string().required('Password is required'),
      role: Yup.string().required('Role is required'),  // Validation for role
    }),
    validateOnChange: false,
    validateOnBlur: false,
    onSubmit: (values, { resetForm }) => {
      addNewUser(values);
      resetForm();
    },
  });

  const addNewUser = async values => {
    try {
      setUsersLoading(true);
      const response = await axios.post(endpoints.users.create, values);
      if (response.status === 201) {
        refreshUsers();
        toast.success('User added successfully!');
      } else {
        toast.error('Failed to add user: ' + response.data.error);
      }
    } catch (error) {
      console.error(error.response);
      toast.error('Failed to add user: ' + error.response.data.error);
    } finally {
      setUsersLoading(false);
    }
  };

  return (
    <Box
      component="fieldset"
      className="mx-auto max-w-6xl border border-stone-300 dark:border-gray-700 px-6 pt-0 pb-2 rounded-lg mb-3 shadow-md"
    >
      <Typography component="legend">
        <h3 className="p-3 dark:bg-zinc-800 rounded-lg text-2xl font-mono text-zinc-900 dark:text-zinc-50">
          {addUserFormConfig.title}
        </h3>
      </Typography>
      <form
        onSubmit={formik.handleSubmit}
        className="flex flex-wrap justify-between gap-6 lg:gap-0"
      >
        <div className="user-data flex flex-col w-full space-y-3 lg:w-3/4">
          {/* Username and password */}
          <div className="flex flex-wrap gap-6 lg:flex-nowrap lg:gap-x-14">
            {/* Username Field */}
            <div className={`flex flex-col w-full lg:w-1/3`}>
              <TextField
                fullWidth
                id="username"
                name="username"
                label="Username"
                variant="outlined"
                size="small"
                value={formik.values.username}
                onChange={formik.handleChange}
                error={formik.touched.username && Boolean(formik.errors.username)}
                helperText={formik.touched.username && formik.errors.username}
              />
            </div>

            {/* Password Field */}
            <div className={`flex flex-col w-full lg:w-1/3`}>
              <TextField
                fullWidth
                id="password"
                name="password"
                label="Password"
                variant="outlined"
                size="small"
                type={showPassword ? 'text' : 'password'}
                value={formik.values.password}
                onChange={formik.handleChange}
                error={formik.touched.password && Boolean(formik.errors.password)}
                helperText={formik.touched.password && formik.errors.password}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={togglePasswordVisibility} edge="end">
                        {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </div>
          </div>

          {/* Role Field */}
          <div className="flex flex-col w-full lg:w-1/3">
            <FormControl fullWidth size="small" error={formik.touched.role && Boolean(formik.errors.role)}>
              <InputLabel>Role</InputLabel>
              <Select
                id="role"
                name="role"
                label="Role"
                value={formik.values.role}
                onChange={formik.handleChange}
              >
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="operator">Operator</MenuItem>
                <MenuItem value="manager">Manager</MenuItem>
              </Select>
              <FormHelperText>{formik.touched.role && formik.errors.role}</FormHelperText>
            </FormControl>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center max-sm:justify-center w-full lg:w-auto">
          <CircularButton
            icon={AiOutlinePlusCircle}
            tooltip={addUserFormConfig.tooltip}
            className="h-18 w-18 !bg-zinc-600 !text-zinc-100 dark:!bg-zinc-200 dark:!text-zinc-900 hover:!bg-zinc-400 hover:!text-zinc-600 dark:hover:!bg-zinc-600 dark:hover:!text-zinc-200"
          />
        </div>
      </form>
    </Box>
  );
}

export default AddUser;
