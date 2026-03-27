import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Home from '../Pages/Home';
import Material from '../Pages/Material';
import Bin from '../Pages/Bin';
import JobType from '../Pages/JobType';
import Recipe from '../Pages/Recipe';
import FeederRecipe from '../Pages/FeederRecipe';
import User from '../Pages/User';
import Blueprint from '../Pages/Blueprint';
import FeederBlueprint from '../Pages/FeederBlueprint';
import Login from '../Pages/Login';
import { ProtectedCredentials, ProtectedRoute } from './ProtectedRoute';
import { Roles } from '../Data/Roles';
import Energy from '../Pages/Energy';
import Dashboard from '../Pages/Dashboard';
import Report from '../Pages/Report';
import NewReport from '../Pages/NewReport';
import EnergyReport from '../Pages/EnergyReport';
import Orders from '../Pages/Orders';
import JobLogs from '../Pages/JobLogs';
import { useLenisScroll } from '../Hooks/useLenisScroll.js'; // ✅ Add this to the top of the file

const AppRoutes = () => {
  const location = useLocation();
  useLenisScroll(); // ✅ Add this to the top of the file
  return (
    <div className="mx-auto">
      <Routes location={location}>
        <Route
          path="/login"
          element={
            <ProtectedCredentials>
              <Login />
            </ProtectedCredentials>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={<Navigate to="/materials" replace />}
          />
          <Route path="materials" element={<Material />} />
          <Route path="bin" element={<Bin />} />
          <Route
            path="job-type"
            element={
              <ProtectedRoute roles={[Roles.Admin]}>
                <JobType />
              </ProtectedRoute>
            }
          />
          <Route path="recipe" element={<Recipe />} />
          <Route path="feeder-recipes" element={<FeederRecipe />} />
          <Route path="energy" element={<Energy />} />
          <Route
            path="user"
            element={
              <ProtectedRoute roles={[Roles.Admin, Roles.Manager]}>
                <User />
              </ProtectedRoute>
            }
          />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="report" element={<Report key={location.key} />} />
          <Route path="new-report" element={<NewReport />} />
          <Route path="energy-report" element={<EnergyReport />} />
          <Route path="orders-analytics" element={<Orders />} />
          <Route path="job-logs" element={<JobLogs />} />
        </Route>

        {/* Top-level routes */}
        <Route path="/orders" element={<ProtectedRoute><Blueprint /></ProtectedRoute>} />
        <Route path="/feeder-orders" element={<ProtectedRoute><FeederBlueprint /></ProtectedRoute>} />

        <Route path="/404" element={<div>Not found</div>} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </div>
  );
};

export default AppRoutes; 