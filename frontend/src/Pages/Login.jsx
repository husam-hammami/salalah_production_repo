import {
  Box,
  createTheme,
  styled,
  ThemeProvider,
  TextField,
  Button,
  Typography,
  Paper,
  InputAdornment,
  IconButton,
} from '@mui/material';
import SideNav from '../Components/Common/SideNav';
import Navbar from '../Components/Navbar/Navbar';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { DarkModeContext } from '../Context/DarkModeProvider';
import { useContext, useEffect, useState } from 'react';
import axios from '../API/axios';
import endpoints from '../API/endpoints';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import useChangeTitle from '../Hooks/useChangeTitle';
import { AuthContext } from '../Context/AuthProvider';
import LoadingScreen from '../Components/Common/LoadingScreen';
import useLoading from '../Hooks/useLoading';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';

const validationSchema = Yup.object({
  username: Yup.string().required('Username is required'),
  password: Yup.string()
    .required('Password is required')
    .min(2, 'Password must be at least 2 characters long'),
});

function Login() {
  useChangeTitle('Login');

  // const loading = useLoading();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const { validateUser } = useContext(AuthContext);

  const loginUser = async values => {
    setLoading(true);
    try {
      const response = await axios.post(endpoints.auth.login, values);
      if (response.status === 200) {
        toast.success('Logged in!..', { theme: 'dark' });
        await validateUser();
        navigate('/');
      }
    } catch (error) {
      toast.error(error.response?.data?.message);
      console.error(error.response)
    } finally {
      setLoading(false);
    }
  };

  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const formik = useFormik({
    initialValues: {
      username: '',
      password: '',
    },
    validationSchema,
    onSubmit: values => {
      loginUser(values);
    },
  });

  const { mode } = useContext(DarkModeContext);

  const DrawerHeader = styled('div')(({ theme }) => ({
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
  }));

  const theme = createTheme({
    colorSchemes: {
      dark: mode === 'dark' ? true : false,
    },
  });

  useEffect(() => {
    setLoading(false);
  }, []);

  return (
    <>
      <Box sx={{ display: 'flex' }}>
        <Navbar />
        {loading && <LoadingScreen />}
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          <DrawerHeader />

          <ThemeProvider theme={theme}>
            <div className="Login container mx-auto 2xl:mt-10 mt-10">
              {!loading && (
                <Paper elevation={3} className="p-6 mx-auto w-3/4">
                  <Box textAlign="center" mb={4}>
                    <Typography variant="h4" className="font-bold">
                      Login
                    </Typography>
                    <Typography variant="body2" className="mt-2">
                      Enter your credentials to access your account
                    </Typography>
                  </Box>
                  <form
                    onSubmit={formik.handleSubmit}
                    className="flex flex-col gap-4"
                  >
                    {/* Username */}
                    <TextField
                      fullWidth
                      label="Username"
                      variant="outlined"
                      name="username"
                      value={formik.values.username}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={
                        formik.touched.username &&
                        Boolean(formik.errors.username)
                      }
                      helperText={
                        formik.touched.username && formik.errors.username
                      }
                    />

                    {/* Password */}
                    <TextField
                      fullWidth
                      label="Password"
                      variant="outlined"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formik.values.password}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      error={
                        formik.touched.password &&
                        Boolean(formik.errors.password)
                      }
                      helperText={
                        formik.touched.password && formik.errors.password
                      }
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={togglePasswordVisibility}
                              edge="end"
                            >
                              {showPassword ? (
                                <AiOutlineEyeInvisible />
                              ) : (
                                <AiOutlineEye />
                              )}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      color="primary"
                      className="!py-3 mt-4 !mx-auto !w-1/3"
                    >
                      Login
                    </Button>
                  </form>
                </Paper>
              )}
            </div>
          </ThemeProvider>
        </Box>
      </Box>
    </>
  );
}
export default Login;
