// import { useContext, useEffect, useState } from 'react';
// import { Formik, Form } from 'formik';
// import * as Yup from 'yup';
// import {
//   TextField,
//   Button,
//   FormControlLabel,
//   Switch,
//   Checkbox,
//   Box,
//   CircularProgress,
//   Typography,
// } from '@mui/material';
// import axios from '../../API/axios';
// import endpoints from '../../API/endpoints';
// import { toast } from 'react-toastify';
// import { MaterialsContext } from '../../Context/ApiContext/MaterialsContext';

// const EditMaterialModal = ({ id, onClose }) => {
//   const { refreshMaterials } = useContext(MaterialsContext);
//   const [loading, setLoading] = useState(true);
//   const [formData, setFormData] = useState(null);

//   const getMaterialDetails = async () => {
//     try {
//       const response = await axios.get(endpoints.materials.details(id));
//       setFormData(response.data);
//     } catch (error) {
//       console.error('Error fetching Material data:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Fetch the data when the modal opens
//   useEffect(() => {
//     getMaterialDetails();
//   }, [id]);

//   // Validation Schema
//   const validationSchema = Yup.object().shape({
//     material_name: Yup.string().required('Material Name is required'),
//     material_code: Yup.string().required('Material Code is required'),
//     is_released: Yup.boolean(),
//     category_in: Yup.boolean().test(
//       'at-least-one-category',
//       'At least one category (IN or OUT) must be selected',
//       function (item) {
//         return this.parent.category_in || this.parent.category_out;
//       },
//     ),
//     category_out: Yup.boolean().test(
//       'at-least-one-category',
//       'At least one category (IN or OUT) must be selected',
//       function (item) {
//         return this.parent.category_in || this.parent.category_out;
//       },
//     ),
//   });

//   // Submit handler
//   const handleSubmit = async values => {
//     const payload = {
//       materialId: id,
//       materialName: values.material_name,
//       materialCode: values.material_code,
//       isReleased: values.is_released,
//       categoryIN: values.category_in,
//       categoryOUT: values.category_out,
//     };

//     try {
//       await axios.post(endpoints.materials.update, payload);
//       refreshMaterials();
//       toast.success('Material updated successfully!');
//       onClose();
//     } catch (error) {
//       console.error('Error updating Material:', error);
//       toast.error('Failed to update Material.');
//     }
//   };

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
//       <Box
//         className="bg-white dark:bg-zinc-800 "
//         sx={{
//           width: '400px',
//           marginTop: '10vh',
//           p: 3,
//           borderRadius: 2,
//           boxShadow: 24,
//         }}
//       >
//         {loading ? (
//           <Box display="flex" flexDirection="column" alignItems="center">
//             <CircularProgress />
//             <Typography variant="body1" sx={{ mt: 2 }}>
//               Loading...
//             </Typography>
//           </Box>
//         ) : (
//           <Formik
//             initialValues={{
//               materialId: id,
//               material_name: formData?.material_name || '',
//               material_code: formData?.material_code || '',
//               is_released: formData?.is_released || false,
//               category_in: formData?.category.includes('IN') || false,
//               category_out: formData?.category.includes('OUT') || false,
//             }}
//             validationSchema={validationSchema}
//             onSubmit={handleSubmit}
//           >
//             {({ values, errors, touched, handleChange, setFieldValue }) => (
//               <Form>
//                 {/* Material Name */}
//                 <TextField
//                   name="materialId"
//                   label="Material ID"
//                   fullWidth
//                   disabled
//                   margin="normal"
//                   value={id}
//                 />
//                 <TextField
//                   name="material_name"
//                   label="Material Name"
//                   fullWidth
//                   margin="normal"
//                   value={values.material_name}
//                   onChange={handleChange}
//                   error={touched.material_name && Boolean(errors.material_name)}
//                   helperText={touched.material_name && errors.material_name}
//                 />

//                 {/* Material Code */}
//                 <TextField
//                   name="material_code"
//                   label="Material Code"
//                   fullWidth
//                   margin="normal"
//                   value={values.material_code}
//                   onChange={handleChange}
//                   error={touched.material_code && Boolean(errors.material_code)}
//                   helperText={touched.material_code && errors.material_code}
//                 />

//                 {/* Is Released */}
//                 <FormControlLabel
//                   control={
//                     <Switch
//                       name="is_released"
//                       checked={values.is_released}
//                       onChange={event =>
//                         setFieldValue('is_released', event.target.checked)
//                       }
//                     />
//                   }
//                   label="Is Released"
//                 />

//                 {/* Categories */}
//                 <Box display="flex" flexDirection="column" mt={2}>
//                   <Typography variant="subtitle1" gutterBottom>
//                     Categories
//                   </Typography>
//                   <FormControlLabel
//                     control={
//                       <Checkbox
//                         name="category_in"
//                         checked={values.category_in}
//                         onChange={event =>
//                           setFieldValue('category_in', event.target.checked)
//                         }
//                       />
//                     }
//                     label="Raw Material (IN)"
//                   />
//                   <FormControlLabel
//                     control={
//                       <Checkbox
//                         name="category_out"
//                         checked={values.category_out}
//                         onChange={event =>
//                           setFieldValue('category_out', event.target.checked)
//                         }
//                       />
//                     }
//                     label="Final Product (OUT)"
//                   />
//                   {touched.category_in &&
//                     !values.category_in &&
//                     !values.category_out && (
//                       <Typography color="error" variant="body2">
//                         At least one category must be selected.
//                       </Typography>
//                     )}
//                   {/* {errors.category_in || errors.category_out ? (
//                     <div className="text-red-500">
//                       {errors['categoryIN'] || errors['categoryOUT']}
//                     </div>
//                   ) : null} */}
//                 </Box>

//                 {/* Buttons */}
//                 <Box display="flex" justifyContent="flex-end" mt={2}>
//                   <Button onClick={onClose} variant="outlined" sx={{ mr: 2 }}>
//                     Cancel
//                   </Button>
//                   <Button type="submit" variant="contained" color="primary">
//                     Save
//                   </Button>
//                 </Box>
//               </Form>
//             )}
//           </Formik>
//         )}
//       </Box>
//     </div>
//   );
// };

// export default EditMaterialModal;











import { useContext, useEffect, useState } from 'react';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import {
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Checkbox,
  Box,
  CircularProgress,
  Typography,
} from '@mui/material';
import axios from '../../API/axios';
import endpoints from '../../API/endpoints';
import { toast } from 'react-toastify';
import { MaterialsContext } from '../../Context/ApiContext/MaterialsContext';

const EditMaterialModal = ({ id, onClose }) => {
  const { refreshMaterials } = useContext(MaterialsContext);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(null);

  const getMaterialDetails = async () => {
    try {
      const response = await axios.get(endpoints.materials.details(id));
      setFormData(response.data);
    } catch (error) {
      console.error('Error fetching Material data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getMaterialDetails();
  }, [id]);

  const validationSchema = Yup.object().shape({
    material_name: Yup.string().required('Material Name is required'),
    material_code: Yup.string().required('Material Code is required'),
    is_released: Yup.boolean(),
    category_in: Yup.boolean().test(
      'at-least-one-category',
      'At least one category (IN or OUT) must be selected',
      function () {
        return this.parent.category_in || this.parent.category_out;
      }
    ),
    category_out: Yup.boolean().test(
      'at-least-one-category',
      'At least one category (IN or OUT) must be selected',
      function () {
        return this.parent.category_in || this.parent.category_out;
      }
    ),
  });

  const handleSubmit = async values => {
    const payload = {
      materialId: id,
      materialName: values.material_name,
      materialCode: values.material_code,
      isReleased: values.is_released,
      categoryIN: values.category_in,
      categoryOUT: values.category_out,
    };

    try {
      await axios.post(endpoints.materials.update, payload);
      refreshMaterials();
      toast.success('Material updated successfully!');
      onClose();
    } catch (error) {
      console.error('Error updating Material:', error);
      toast.error('Failed to update Material.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Box
        className="w-full max-w-md rounded-lg shadow-xl dark:bg-gradient-to-r dark:from-[#0B1F3A] dark:to-[#1F3D63] bg-white"
        sx={{ p: 4 }}
      >
        {loading ? (
          <Box display="flex" flexDirection="column" alignItems="center">
            <CircularProgress />
            <Typography className="text-gray-700 dark:text-gray-200 mt-2">
              Loading...
            </Typography>
          </Box>
        ) : (
          <Formik
            initialValues={{
              materialId: id,
              material_name: formData?.material_name || '',
              material_code: formData?.material_code || '',
              is_released: formData?.is_released || false,
              category_in: formData?.category.includes('IN') || false,
              category_out: formData?.category.includes('OUT') || false,
            }}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
          >
            {({ values, errors, touched, handleChange, setFieldValue }) => (
              <Form>
                <Typography variant="h6" className="text-zinc-900 dark:text-white mb-4">
                  Edit Material
                </Typography>

                <TextField
                  name="materialId"
                  label="Material ID"
                  fullWidth
                  disabled
                  margin="normal"
                  value={id}
                  className="text-zinc-900 dark:text-white"
                  InputProps={{
                    className: 'text-zinc-800 dark:text-white',
                  }}
                />

                <TextField
                  name="material_name"
                  label="Material Name"
                  fullWidth
                  margin="normal"
                  value={values.material_name}
                  onChange={handleChange}
                  error={touched.material_name && Boolean(errors.material_name)}
                  helperText={touched.material_name && errors.material_name}
                  InputLabelProps={{ className: 'dark:text-gray-300' }}
                  InputProps={{ className: 'dark:text-white' }}
                />

                <TextField
                  name="material_code"
                  label="Material Code"
                  fullWidth
                  margin="normal"
                  value={values.material_code}
                  onChange={handleChange}
                  error={touched.material_code && Boolean(errors.material_code)}
                  helperText={touched.material_code && errors.material_code}
                  InputLabelProps={{ className: 'dark:text-gray-300' }}
                  InputProps={{ className: 'dark:text-white' }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      name="is_released"
                      checked={values.is_released}
                      onChange={event =>
                        setFieldValue('is_released', event.target.checked)
                      }
                    />
                  }
                  label="Is Released"
                  className="dark:text-gray-300"
                />

                <Box mt={2}>
                  <Typography variant="subtitle1" className="text-zinc-800 dark:text-gray-200">
                    Categories
                  </Typography>

                  <FormControlLabel
                    control={
                      <Checkbox
                        name="category_in"
                        checked={values.category_in}
                        onChange={event =>
                          setFieldValue('category_in', event.target.checked)
                        }
                      />
                    }
                    label="Raw Material (IN)"
                    className="dark:text-gray-200"
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        name="category_out"
                        checked={values.category_out}
                        onChange={event =>
                          setFieldValue('category_out', event.target.checked)
                        }
                      />
                    }
                    label="Final Product (OUT)"
                    className="dark:text-gray-200"
                  />

                  {touched.category_in &&
                    !values.category_in &&
                    !values.category_out && (
                      <Typography color="error" variant="body2">
                        At least one category must be selected.
                      </Typography>
                    )}
                </Box>

                <Box display="flex" justifyContent="flex-end" mt={4}>
                  <Button onClick={onClose} variant="outlined" sx={{ mr: 2 }}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="contained" color="primary">
                    Save
                  </Button>
                </Box>
              </Form>
            )}
          </Formik>
        )}
      </Box>
    </div>
  );
};

export default EditMaterialModal;
