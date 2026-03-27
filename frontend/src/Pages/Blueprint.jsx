import { Box, createTheme, styled, ThemeProvider } from '@mui/material';
import Navbar from '../Components/Navbar/Navbar';
import { NavLink } from 'react-router-dom';
import { DarkModeContext } from '../Context/DarkModeProvider';
import { useContext, useState } from 'react';
import useChangeTitle from '../Hooks/useChangeTitle';
import FlashButton from '../Components/Blueprint/FlashButton';
import { FaHome } from 'react-icons/fa';
import BPContentContainer from '../Components/Blueprint/BPContentContainer';
import BPActiveOrderDetails from '../Components/Blueprint/BPActiveOrder';
import BPTableData from '../Components/Blueprint/BPTableData';
import useLoading from '../Hooks/useLoading';
import LoadingScreen from '../Components/Common/LoadingScreen';
import { JobTypesContext } from '../Context/ApiContext/JobTypesContext';
import ErrorScreen from '../Components/Common/ErrorScreen';
import { OrdersContext } from '../Components/Blueprint/OrdersContext';

function Blueprint() {
  useChangeTitle('Blueprint');
  const loading = useLoading();
  const { jobTypesLoading, jobTypesError, refreshJobTypes } =
    useContext(JobTypesContext);

  const { mode } = useContext(DarkModeContext);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const AppBarMargin = styled('div')(({ theme }) => ({
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
  }));
  const theme = createTheme({
    colorSchemes: {
      dark: mode === 'dark' ? true : false,
    },
  });

  const [currentJobType, setCurrentJobType] = useState(null)
  

  return (
    <>
      {loading || jobTypesLoading ? (
        <LoadingScreen />
      ) : (
        <Box sx={{ display: 'flex' }}>
          <Navbar isBlueprint={true} />
          <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
            <AppBarMargin />
            <ThemeProvider theme={theme}>
              <div className="blueprint 2xl:mt-8 mt-5 space-y-4">
                {/* _______________________blueprint header__________________ */}
                <div className="blueprint-header relative flex items-center">
                  <div className="blueprint-return-button">
                    <NavLink to="/materials">
                      <FlashButton title="Back to dashboard" icon={FaHome} />
                    </NavLink>
                  </div>
                  <div className="blueprint-title absolute left-1/2 transform -translate-x-1/2">
                    <h1 className="text-2xl font-semibold">Order Management</h1>
                  </div>
                </div>
                {jobTypesError ? (
                  <ErrorScreen
                    handleRefresh={refreshJobTypes}
                    message={jobTypesError}
                  />
                ) : (
                  // Body
                  <div className="blueprint-body flex justify-between w-full space-x-4">
                    {/* _______________________blueprint Orders __________________ */}
                    <div className="blueprint-orders w-1/2">
                      <BPContentContainer title="Orders List">
                        <BPTableData
                            setCurrentJobType={setCurrentJobType}
                            onOrderAction={() => {
                              console.log('[🌟 onOrderAction] Incrementing refreshTrigger...');
                              setRefreshTrigger(prev => prev + 1);
                            }}
                          />
                      </BPContentContainer>
                    </div>

                    {/* _______________________blueprint active-orders __________________ */}
                    <div className="blueprint-active-order w-1/2">
                      <BPContentContainer title="Active Order Details">
                        <BPActiveOrderDetails
                                currentJobType={currentJobType}
                                refreshTrigger={refreshTrigger} // ✅ Add this
                              />
                      </BPContentContainer>
                    </div>
                  </div>
                )}
              </div>
            </ThemeProvider>
          </Box>
        </Box>
      )}
    </>
  );
}

export default Blueprint;
