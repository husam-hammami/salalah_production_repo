// import { toast } from 'react-toastify';
// import { useFormik } from 'formik';
// import * as Yup from 'yup';
// import { Box, Typography } from '@mui/material';
// import { IoArrowRedoSharp } from 'react-icons/io5';
// import CircularButton from '../Common/CircularButton';
// import SelectField from '../Common/SelectField';
// import { assignBinFormConfig } from '../../Data/Bin';
// import { useContext } from 'react';
// import { BinsContext } from '../../Context/ApiContext/BinsContext';
// import { MaterialsContext } from '../../Context/ApiContext/MaterialsContext';
// import endpoints from '../../API/endpoints';
// import axios from '../../API/axios';

// function BinAssignment() {
//   const { bins, setBinsLoading, refreshBins } = useContext(BinsContext);
//   const { materials } = useContext(MaterialsContext);

//   const binOptions = bins.map(bin => ({
//     value: bin.id,
//     label: bin.bin_name,
//   }));

//   const materialOptions = materials
//     .filter(material => material.is_released)
//     .map(material => ({
//       value: material.id,
//       label: `${material.material_name} (${material.material_code})`,
//     }));

//   const formik = useFormik({
//     initialValues: {
//       binId: '',
//       materialId: '',
//     },
//     validationSchema: Yup.object({
//       binId: Yup.number().required('Bin is required'),
//       materialId: Yup.number().required('Material is required'),
//     }),
//     validateOnChange: false,
//     validateOnBlur: false,
//     onSubmit: async (values, { resetForm }) => {
//       await assignMaterialToBin(values);
//       resetForm();
//     },
//   });

//   const assignMaterialToBin = async values => {
//     try {
//       setBinsLoading(true);
//       console.log("Submitting:", values);

//       const payload = {
//         assignments: [
//           {
//             bin_id: Number(values.binId),
//             material_id: Number(values.materialId),
//           },
//         ],
//       };

//       const response = await axios.post(endpoints.bins.assign, payload);

//       if (response.status === 200) {
//         refreshBins();
//         toast.success('Material successfully assigned to bin.');
//       }
//     } catch (error) {
//       console.error("API Error:", error.response);
//       toast.error('Failed to assign material: ' + (error.response?.data?.error || 'Unknown error'));
//     } finally {
//       setBinsLoading(false);
//     }
//   };

//   return (
//     <Box
//       component="fieldset"
//       className="mx-auto max-w-6xl border border-stone-300 dark:border-gray-700 px-6 pt-0 pb-2 rounded-lg mb-3 shadow-md"
//     >
//       <Typography component="legend">
//         <h3 className="p-3 dark:bg-zinc-800 rounded-lg text-2xl font-mono text-zinc-900 dark:text-zinc-50">
//           {assignBinFormConfig.title}
//         </h3>
//       </Typography>

//       <form onSubmit={formik.handleSubmit} className="flex flex-wrap justify-between gap-6 lg:gap-0">
//         <div className="material-data flex flex-col w-full lg:w-3/4">
//           <div className="flex flex-wrap gap-6 lg:flex-nowrap lg:gap-x-14">
//             <SelectField
//               formik={formik}
//               labelName="Bin Name"
//               field="binId"
//               className="w-full lg:w-1/3"
//               options={binOptions}
//               disabled={bins.length === 0}
//             />
//             <SelectField
//               formik={formik}
//               labelName="Material"
//               field="materialId"
//               className="w-full lg:w-1/3"
//               options={materialOptions}
//               disabled={materials.length === 0}
//             />
//           </div>
//         </div>

//         <div className="flex items-center max-sm:justify-center w-full lg:w-auto">
//           <CircularButton
//             tooltip="Assign Bin"
//             icon={IoArrowRedoSharp}
//             className="p-2 !border-4 !border-zinc-600 h-18 w-18 !bg-zinc-600 !text-zinc-100 dark:!bg-zinc-200 dark:!text-zinc-900 hover:!bg-zinc-400 hover:!text-zinc-600 dark:hover:!bg-zinc-600 dark:hover:!text-zinc-200"
//             size={55}
//             type="submit"
//             disabled={formik.isSubmitting}
//           />
//         </div>
//       </form>
//     </Box>
//   );
// }

// export default BinAssignment;






import { toast } from 'react-toastify';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Box } from '@mui/material';
import { IoArrowRedoSharp } from 'react-icons/io5';
import CircularButton from '../Common/CircularButton';
import SelectField from '../Common/SelectField';
import { assignBinFormConfig } from '../../Data/Bin';
import { useContext } from 'react';
import { BinsContext } from '../../Context/ApiContext/BinsContext';
import { MaterialsContext } from '../../Context/ApiContext/MaterialsContext';
import endpoints from '../../API/endpoints';
import axios from '../../API/axios';

function BinAssignment() {
  const { bins, setBinsLoading, refreshBins } = useContext(BinsContext);
  const { materials } = useContext(MaterialsContext);

  const binOptions = bins.map(bin => ({
    value: bin.id,
    label: bin.bin_name,
  }));

  const materialOptions = materials
    .filter(material => material.is_released)
    .map(material => ({
      value: material.id,
      label: `${material.material_name} (${material.material_code})`,
    }));

  const formik = useFormik({
    initialValues: {
      binId: '',
      materialId: '',
    },
    validationSchema: Yup.object({
      binId: Yup.number().required('Bin is required'),
      materialId: Yup.number().required('Material is required'),
    }),
    validateOnChange: false,
    validateOnBlur: false,
    onSubmit: async (values, { resetForm }) => {
      await assignMaterialToBin(values);
      resetForm();
    },
  });

  const assignMaterialToBin = async values => {
    try {
      setBinsLoading(true);

      const payload = {
        assignments: [
          {
            bin_id: Number(values.binId),
            material_id: Number(values.materialId),
          },
        ],
      };

      const response = await axios.post(endpoints.bins.assign, payload);

      if (response.status === 200) {
        refreshBins();
        toast.success('Material successfully assigned to bin.');
      }
    } catch (error) {
      toast.error('Failed to assign material: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setBinsLoading(false);
    }
  };

  return (
    <Box
      component="div"
      className="mx-auto max-w-6xl border border-stone-300 dark:border-cyan-800 px-6 pt-0 pb-2 rounded-lg mb-3 shadow-md bg-white dark:bg-gradient-to-r dark:from-[#0B1F3A] dark:to-[#1F3D63]"
    >
      <h3 className="p-3 rounded-lg text-2xl font-semibold text-zinc-900 dark:text-white">
        {assignBinFormConfig.title}
      </h3>

      <form onSubmit={formik.handleSubmit} className="flex flex-wrap justify-between gap-6 lg:gap-0">
        <div className="material-data flex flex-col w-full lg:w-3/4">
          <div className="flex flex-wrap gap-6 lg:flex-nowrap lg:gap-x-14">
            <SelectField
              formik={formik}
              labelName="Bin Name"
              field="binId"
              className="w-full lg:w-1/3"
              options={binOptions}
              disabled={bins.length === 0}
            />
            <SelectField
              formik={formik}
              labelName="Material"
              field="materialId"
              className="w-full lg:w-1/3"
              options={materialOptions}
              disabled={materials.length === 0}
            />
          </div>
        </div>

        <div className="flex items-center max-sm:justify-center w-full lg:w-auto">
          <CircularButton
            tooltip="Assign Bin"
            icon={IoArrowRedoSharp}
            className="p-2 !border-4 !border-zinc-600 h-18 w-18 !bg-zinc-600 !text-zinc-100 dark:!bg-zinc-200 dark:!text-zinc-900 hover:!bg-zinc-400 hover:!text-zinc-600 dark:hover:!bg-zinc-600 dark:hover:!text-zinc-200"
            size={55}
            type="submit"
            disabled={formik.isSubmitting}
          />
        </div>
      </form>
    </Box>
  );
}

export default BinAssignment;
