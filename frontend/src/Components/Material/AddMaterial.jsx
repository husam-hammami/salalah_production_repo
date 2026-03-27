// import { toast } from 'react-toastify';
// import { useFormik } from 'formik';
// import * as Yup from 'yup';
// import { Box, Checkbox, Switch, Typography } from '@mui/material';
// import { AiOutlinePlusCircle } from 'react-icons/ai';
// import CircularButton from '../Common/CircularButton';
// import InputField from '../Common/InputField';
// import {
//   addMaterialFormConfig,
//   materialCategoryConfig,
// } from '../../Data/Materials';
// import { useContext } from 'react';
// import axios from '../../API/axios';
// import endpoints from '../../API/endpoints';
// import { MaterialsContext } from '../../Context/ApiContext/MaterialsContext';

// function AddMaterial() {
//   const { setMaterialLoading, refreshMaterials } = useContext(MaterialsContext);
//   const formik = useFormik({
//     initialValues: {
//       materialName: '',
//       materialCode: '',
//       categoryIN: false,
//       categoryOUT: false,
//       isReleased: false, // For the switch
//     },
//     validationSchema: Yup.object({
//       materialName: Yup.string().required('Name is required'),
//       materialCode: Yup.string().required('Code is required'),
//       categoryIN: Yup.boolean().test(
//         'at-least-one-category',
//         'At least one category (IN or OUT) must be selected',
//         function (item) {
//           return this.parent.categoryIN || this.parent.categoryOUT;
//         },
//       ),
//       categoryOUT: Yup.boolean().test(
//         'at-least-one-category',
//         'At least one category (IN or OUT) must be selected',
//         function (item) {
//           return this.parent.categoryIN || this.parent.categoryOUT;
//         },
//       ),
//     }),
//     validateOnChange: false,
//     validateOnBlur: false,
//     onSubmit: (values, { resetForm }) => {
//       addNewMaterial(values);
//       resetForm();
//     },
//   });

//   const addNewMaterial = async values => {
//     try {
//       setMaterialLoading(true);
//       const response = await axios.post(endpoints.materials.create, values);
//       if (response.status === 201) {
//         refreshMaterials();
//         toast.success('Material added successfully');
//       }
//     } catch (error) {
//       console.error(error.response);
//       toast.error('Failed to add material: ' + error.response.data.error);
//     } finally {
//       setMaterialLoading(false);
//     }
//   };

 
//   return (
//     <>
//       <Box
//         component="fieldset"
//         className="mx-auto max-w-6xl border border-stone-300 dark:border-gray-700 px-6 pt-0 pb-2 rounded-lg mb-3 shadow-md"
//       >
//         <Typography component="legend">
//           <h3 className="p-3 dark:bg-zinc-800 rounded-lg text-2xl text-zinc-900 dark:text-zinc-50">
//             {addMaterialFormConfig.title}
//           </h3>
//         </Typography>
//         <form
//           onSubmit={formik.handleSubmit}
//           className="flex flex-wrap justify-between gap-6 lg:gap-0"
//         >
//           <div className="material-data flex flex-col w-full lg:w-3/4">
//             {/* Name and Code */}
//             <div className="flex flex-wrap gap-6 lg:flex-nowrap lg:gap-x-14">
//               {/* Name Field */}
//               {addMaterialFormConfig.newFields?.map((field, index) => (
//                 <InputField
//                   key={index}
//                   formik={formik}
//                   labelName={field.label}
//                   field={field.name}
//                   className="w-full lg:w-1/3"
//                 />
//               ))}
//             </div>

//             {/* Category and Release */}
//             <div className="mt-2">
//               <div className="flex flex-wrap justify-between gap-6 lg:gap-0">
//                 <div className="flex flex-wrap gap-5 items-center">
//                   <h4 className="font-semibold">
//                     {materialCategoryConfig.categoryTitle}
//                   </h4>
//                   <div className="flex gap-x-16 flex-wrap ">
//                     {materialCategoryConfig.options.map((option, index) => (
//                       <label key={index} className="flex items-center gap-0">
//                         <Checkbox
//                           checked={formik.values[option.field]}
//                           onChange={e =>
//                             formik.setFieldValue(option.field, e.target.checked)
//                           }
//                         />
//                         {option.label}
//                       </label>
//                     ))}
//                   </div>
//                 </div>
//                 <label className="flex items-center gap-2">
//                   <Switch
//                     checked={formik.values.release}
//                     onChange={e =>
//                       formik.setFieldValue(
//                         materialCategoryConfig.release.field,
//                         e.target.checked,
//                       )
//                     }
//                   />
//                   {materialCategoryConfig.release.label}
//                 </label>
//               </div>
//               {formik.errors.categoryIN || formik.errors.categoryOUT ? (
//                 <div className="text-red-500">
//                   {formik.errors['categoryIN'] || formik.errors['categoryOUT']}
//                 </div>
//               ) : null}
//             </div>
//           </div>

//           {/* Submit Button */}
//           <div className="flex items-center max-sm:justify-center  w-full lg:w-auto">
//             <CircularButton
//               icon={AiOutlinePlusCircle}
//               tooltip={addMaterialFormConfig.title}
//               className="h-18 w-18  !bg-zinc-600 !text-zinc-100 dark:!bg-zinc-200 dark:!text-zinc-900 hover:!bg-zinc-400 hover:!text-zinc-600 dark:hover:!bg-zinc-600 dark:hover:!text-zinc-200 "
//             />
//           </div>
//         </form>
//       </Box>
//     </>
//   );
// }

// export default AddMaterial;











import { toast } from 'react-toastify';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Box, Checkbox, Switch } from '@mui/material';
import { AiOutlinePlusCircle } from 'react-icons/ai';
import CircularButton from '../Common/CircularButton';
import InputField from '../Common/InputField';
import {
  addMaterialFormConfig,
  materialCategoryConfig,
} from '../../Data/Materials';
import { useContext } from 'react';
import axios from '../../API/axios';
import endpoints from '../../API/endpoints';
import { MaterialsContext } from '../../Context/ApiContext/MaterialsContext';

function AddMaterial() {
  const { setMaterialLoading, refreshMaterials } = useContext(MaterialsContext);

  const formik = useFormik({
    initialValues: {
      materialName: '',
      materialCode: '',
      categoryIN: false,
      categoryOUT: false,
      isReleased: false,
    },
    validationSchema: Yup.object({
      materialName: Yup.string().required('Name is required'),
      materialCode: Yup.string().required('Code is required'),
      categoryIN: Yup.boolean().test(
        'at-least-one-category',
        'At least one category (IN or OUT) must be selected',
        function () {
          return this.parent.categoryIN || this.parent.categoryOUT;
        }
      ),
      categoryOUT: Yup.boolean().test(
        'at-least-one-category',
        'At least one category (IN or OUT) must be selected',
        function () {
          return this.parent.categoryIN || this.parent.categoryOUT;
        }
      ),
    }),
    validateOnChange: false,
    validateOnBlur: false,
    onSubmit: (values, { resetForm }) => {
      addNewMaterial(values);
      resetForm();
    },
  });

  const addNewMaterial = async values => {
    try {
      setMaterialLoading(true);
      const response = await axios.post(endpoints.materials.create, values);
      if (response.status === 201) {
        refreshMaterials();
        toast.success('Material added successfully');
      }
    } catch (error) {
      console.error(error.response);
      toast.error('Failed to add material: ' + error.response.data.error);
    } finally {
      setMaterialLoading(false);
    }
  };

  return (
    <Box
      component="div"
      className="mx-auto max-w-6xl border border-stone-300 dark:border-cyan-700 px-6 pt-0 pb-2 rounded-lg mb-3 shadow-md bg-white dark:bg-gradient-to-r dark:from-[#0B1F3A] dark:to-[#1F3D63]"
    >
      <div className="p-3 rounded-lg text-2xl font-semibold text-zinc-900 dark:text-white">
        {addMaterialFormConfig.title}
      </div>

      <form
        onSubmit={formik.handleSubmit}
        className="flex flex-wrap justify-between gap-6 lg:gap-0"
      >
        <div className="material-data flex flex-col w-full lg:w-3/4">
          {/* Name and Code */}
          <div className="flex flex-wrap gap-6 lg:flex-nowrap lg:gap-x-14">
            {addMaterialFormConfig.newFields?.map((field, index) => (
              <InputField
                key={index}
                formik={formik}
                labelName={field.label}
                field={field.name}
                className="w-full lg:w-1/3"
              />
            ))}
          </div>

          {/* Category and Release */}
          <div className="mt-2">
            <div className="flex flex-wrap justify-between gap-6 lg:gap-0">
              <div className="flex flex-wrap gap-5 items-center">
                <h4 className="font-semibold text-zinc-800 dark:text-white">
                  {materialCategoryConfig.categoryTitle}
                </h4>
                <div className="flex gap-x-16 flex-wrap">
                  {materialCategoryConfig.options.map((option, index) => (
                    <label
                      key={index}
                      className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100"
                    >
                      <Checkbox
                        checked={formik.values[option.field]}
                        onChange={e =>
                          formik.setFieldValue(option.field, e.target.checked)
                        }
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                <Switch
                  checked={formik.values.release}
                  onChange={e =>
                    formik.setFieldValue(
                      materialCategoryConfig.release.field,
                      e.target.checked
                    )
                  }
                />
                {materialCategoryConfig.release.label}
              </label>
            </div>

            {(formik.errors.categoryIN || formik.errors.categoryOUT) && (
              <div className="text-red-500 text-sm mt-1">
                {formik.errors.categoryIN || formik.errors.categoryOUT}
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center max-sm:justify-center w-full lg:w-auto">
          <CircularButton
            icon={AiOutlinePlusCircle}
            tooltip={addMaterialFormConfig.title}
            className="h-18 w-18 !bg-zinc-600 !text-zinc-100 dark:!bg-zinc-200 dark:!text-zinc-900 hover:!bg-zinc-400 hover:!text-zinc-600 dark:hover:!bg-cyan-700 dark:hover:!text-white"
          />
        </div>
      </form>
    </Box>
  );
}

export default AddMaterial;
