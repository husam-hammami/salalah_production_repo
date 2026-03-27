// import { Box } from '@mui/material';
// import FeederRecipeManagement from '../Components/Recipe/FeederRecipeManagement';
// import useChangeTitle from '../Hooks/useChangeTitle';
// import useLoading from '../Hooks/useLoading';
// import LoadingScreen from '../Components/Common/LoadingScreen';
// import ErrorScreen from '../Components/Common/ErrorScreen';
// import { useContext, useState } from 'react';
// import { JobTypesContext } from '../Context/ApiContext/JobTypesContext';
// import { MaterialsContext } from '../Context/ApiContext/MaterialsContext';

// function Recipe() {
//   useChangeTitle('Recipe');
//   const loading = useLoading();
//   const { jobTypesLoading, jobTypesError, refreshJobTypes } =
//     useContext(JobTypesContext);
//   const { materialsLoading } =
//     useContext(MaterialsContext);
//   const [recipesError, setRecipesError] = useState(false);

//   return (
//     <>
//       {loading || jobTypesLoading || materialsLoading ? (
//         <LoadingScreen />
//       ) : jobTypesError || recipesError ? (
//         <ErrorScreen
//           message={jobTypesError || recipesError}
//           handleRefresh={refreshJobTypes}
//         />
//       ) : (
//         <>
//           <div className="flex justify-center items-center">
//             <Box className="w-full 2xl:p-5 2xl:pt-0 p-3 pt-0 max-w-8xl bg-zinc-200 dark:bg-zinc-800 rounded-md shadow-xl ">
//               {/* __________________Add Job Type______________________ */}
//               <FeederRecipeManagement setRecipesError={setRecipesError} />
//             </Box>
//           </div>
//         </>
//       )}
//     </>
//   );
// }

// export default Recipe;











import { Box } from '@mui/material';
import FeederRecipeManagement from '../Components/Recipe/FeederRecipeManagement';
import useChangeTitle from '../Hooks/useChangeTitle';
import useLoading from '../Hooks/useLoading';
import LoadingScreen from '../Components/Common/LoadingScreen';
import ErrorScreen from '../Components/Common/ErrorScreen';
import { useContext, useState } from 'react';
import { JobTypesContext } from '../Context/ApiContext/JobTypesContext';
import { MaterialsContext } from '../Context/ApiContext/MaterialsContext';

function Recipe() {
  useChangeTitle('Recipe');
  const loading = useLoading();

  const { jobTypesLoading, jobTypesError, refreshJobTypes } = useContext(JobTypesContext);
  const { materialsLoading } = useContext(MaterialsContext);

  const [recipesError, setRecipesError] = useState(false);

  const isLoading = loading || jobTypesLoading || materialsLoading;
  const hasError = jobTypesError || recipesError;

  return (
    <>
      {isLoading ? (
        <LoadingScreen />
      ) : hasError ? (
        <ErrorScreen
          message={jobTypesError || recipesError}
          handleRefresh={refreshJobTypes}
        />
      ) : (
        <div className="flex justify-center items-center">
          <Box
            className="w-full 2xl:p-5 2xl:pt-0 p-3 pt-0 max-w-8xl 
                       bg-zinc-200 dark:bg-gradient-to-r 
                       dark:from-[#0B1F3A] dark:to-[#1F3D63] 
                       rounded-md shadow-xl transition-all duration-300"
          >
            {/* __________________Feeder Recipe Management______________________ */}
            <FeederRecipeManagement setRecipesError={setRecipesError} />
          </Box>
        </div>
      )}
    </>
  );
}

export default Recipe;
