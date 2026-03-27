import { Box, createTheme, styled, ThemeProvider } from '@mui/material';
import Navbar from '../Components/Navbar/Navbar';
import { NavLink } from 'react-router-dom';
import { DarkModeContext } from '../Context/DarkModeProvider';
import { useContext, useState } from 'react';
import useChangeTitle from '../Hooks/useChangeTitle';
import FlashButton from '../Components/Blueprint/FlashButton';
import { FaHome } from 'react-icons/fa';
import BPContentContainer from '../Components/Blueprint/BPContentContainer';
import FeederActiveOrderDetails from '../Components/Blueprint/FeederActiveOrderDetails';
import FeederTableData from '../Components/Blueprint/FeederTableData';
import useLoading from '../Hooks/useLoading';
import LoadingScreen from '../Components/Common/LoadingScreen';
import { JobTypesContext } from '../Context/ApiContext/JobTypesContext';
import ErrorScreen from '../Components/Common/ErrorScreen';
import { FeederOrdersProvider } from '../Components/Blueprint/FeederOrdersContext';

function FeederBlueprint() {
  useChangeTitle('Feeder Orders');
  const loading = useLoading();
  const { jobTypesLoading, jobTypesError, refreshJobTypes } = useContext(JobTypesContext);
  const { mode } = useContext(DarkModeContext);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentJobType, setCurrentJobType] = useState(null);

  const AppBarMargin = styled('div')(({ theme }) => ({
    ...theme.mixins.toolbar,
  }));

  const theme = createTheme({
    colorSchemes: {
      dark: mode === 'dark' ? true : false,
    },
  });

  return (
    <>
      {loading || jobTypesLoading ? (
        <LoadingScreen />
      ) : (
        <FeederOrdersProvider>
          <Box sx={{ display: 'flex' }}>
            <Navbar isBlueprint={true} />
            <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
              <AppBarMargin />
              <ThemeProvider theme={theme}>
                <div className="blueprint 2xl:mt-8 mt-5 space-y-4">
                  {/* _______________________ Header __________________ */}
                  <div className="blueprint-header relative flex items-center">
                    <div className="blueprint-return-button">
                      <NavLink to="/materials">
                        <FlashButton title="Back to dashboard" icon={FaHome} />
                      </NavLink>
                    </div>
                    <div className="blueprint-title absolute left-1/2 transform -translate-x-1/2">
                      <h1 className="text-2xl font-semibold">Feeder Order Management</h1>
                    </div>
                  </div>

                  {jobTypesError ? (
                    <ErrorScreen
                      handleRefresh={refreshJobTypes}
                      message={jobTypesError}
                    />
                  ) : (
                    <div className="blueprint-body flex justify-between w-full space-x-4">
                      {/* Orders List */}
                      <div className="blueprint-orders w-1/2">
                        <BPContentContainer title="Feeder Orders List">
                          <FeederTableData
                            setCurrentJobType={setCurrentJobType}
                            onOrderAction={() => {
                              setRefreshTrigger(prev => prev + 1);
                            }}
                          />
                        </BPContentContainer>
                      </div>

                      {/* Active Order Details */}
                      <div className="blueprint-active-order w-1/2">
                        <BPContentContainer title="Active Feeder Order Details">
                          <FeederActiveOrderDetails
                            currentJobType={currentJobType}
                            refreshTrigger={refreshTrigger}
                          />
                        </BPContentContainer>
                      </div>
                    </div>
                  )}
                </div>
              </ThemeProvider>
            </Box>
          </Box>
        </FeederOrdersProvider>
      )}
    </>
  );
}

export default FeederBlueprint;
