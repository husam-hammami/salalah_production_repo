// import { Box } from '@mui/material';
// import RecipeManagement from '../Components/Recipe/RecipeManagement';
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
//               <RecipeManagement setRecipesError={setRecipesError} />
//             </Box>
//           </div>
//         </>
//       )}
//     </>
//   );
// }

// export default Recipe;









import { Box } from '@mui/material';
import RecipeManagement from '../Components/Recipe/RecipeManagement';
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
  const { jobTypesLoading, jobTypesError, refreshJobTypes } =
    useContext(JobTypesContext);
  const { materialsLoading } = useContext(MaterialsContext);
  const [recipesError, setRecipesError] = useState(false);

  return (
    <>
      {loading || jobTypesLoading || materialsLoading ? (
        <LoadingScreen />
      ) : jobTypesError || recipesError ? (
        <ErrorScreen
          message={jobTypesError || recipesError}
          handleRefresh={refreshJobTypes}
        />
      ) : (
        <div className="flex justify-center items-center">
          <Box
            className="w-full max-w-8xl p-3 pt-0 2xl:p-5 2xl:pt-0 rounded-md shadow-xl
                       bg-zinc-200 dark:bg-gradient-to-r dark:from-[#0B1F3A] dark:to-[#1F3D63]"
          >
            {/* __________________Recipe Management______________________ */}
            <RecipeManagement setRecipesError={setRecipesError} />
          </Box>
        </div>
      )}
    </>
  );
}

export default Recipe;
