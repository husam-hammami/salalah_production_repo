import { useContext } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BinsProvider } from '../context/ApiContext/BinsContext';
import { JobTypesProvider } from '../context/ApiContext/JobTypesContext';
import { MaterialsProvider } from '../context/ApiContext/MaterialsContext';
import { OrdersProvider } from '../context/ApiContext/OrdersContext';
import { UsersProvider } from '../context/ApiContext/UsersContext';
import { DarkModeProvider } from '../context/DarkModeProvider';
import { NavbarProvider } from '../context/NavbarContext';
import { AuthContext } from '../context/AuthProvider';
import LoadingScreen from '../components/Common/LoadingScreen';
import { ThemeProvider } from '../context/ThemeContext';
import { SocketProvider } from '../context/SocketContext';

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
