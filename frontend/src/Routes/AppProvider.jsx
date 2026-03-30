import { useContext } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BinsProvider } from '../Context/ApiContext/BinsContext';
import { JobTypesProvider } from '../Context/ApiContext/JobTypesContext';
import { MaterialsProvider } from '../Context/ApiContext/MaterialsContext';
import { OrdersProvider } from '../Context/ApiContext/OrdersContext';
import { UsersProvider } from '../Context/ApiContext/UsersContext';
import { DarkModeProvider } from '../Context/DarkModeProvider';
import { NavbarProvider } from '../Context/NavbarContext';
import { AuthContext } from '../Context/AuthProvider';
import LoadingScreen from '../Components/Common/LoadingScreen';
import { ThemeProvider } from '../Context/ThemeContext';
import { SocketProvider } from '../Context/SocketContext';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 2,
    },
  },
});

const AppProviders = ({ children }) => {
  const { authLoading } = useContext(AuthContext);

  if (authLoading) {
    return <LoadingScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        <NavbarProvider>
          <DarkModeProvider>
            <MaterialsProvider>
              <BinsProvider>
                <JobTypesProvider>
                  <OrdersProvider>
                    <UsersProvider>
                      <ThemeProvider>
                        {children}
                      </ThemeProvider>
                    </UsersProvider>
                  </OrdersProvider>
                </JobTypesProvider>
              </BinsProvider>
            </MaterialsProvider>
          </DarkModeProvider>
        </NavbarProvider>
      </SocketProvider>
    </QueryClientProvider>
  );
};

export default AppProviders;
