import { Box, createTheme, styled, ThemeProvider } from '@mui/material';
import SideNav from '../Components/Common/SideNav';
import Navbar from '../Components/Navbar/Navbar';
import { Outlet } from 'react-router-dom';
import { DarkModeContext } from '../Context/DarkModeProvider';
import { useContext } from 'react';

function Home() {
  const contextValue = useContext(DarkModeContext);
  const { mode } = contextValue || {};

  const DrawerHeader = styled('div')(({ theme }) => ({
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
  }));

  const theme = createTheme({
    colorSchemes: {
      dark: mode === 'dark' ? true : false,
    },
  });
  return (
    <>
      <Box sx={{ display: 'flex' }}>
        <Navbar />
        <SideNav />
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          <DrawerHeader />

          <ThemeProvider theme={theme}>
            <div className="management 2xl:mt-7 mt-5">
              <Outlet />
            </div>
          </ThemeProvider>
        </Box>
      </Box>
    </>
  );
}

export default Home;
