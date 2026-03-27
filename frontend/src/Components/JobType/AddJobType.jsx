import { toast } from 'react-toastify';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Box, Typography } from '@mui/material';
import { AiOutlinePlusCircle } from 'react-icons/ai';
import CircularButton from '../Common/CircularButton';
import InputField from '../Common/InputField';
import { addJobTypeFormConfig } from '../../Data/JobType';
import { useContext } from 'react';
import { JobTypesContext } from '../../Context/ApiContext/JobTypesContext';
import axios from '../../API/axios';
import endpoints from '../../API/endpoints';

function AddJobType() {
  const { jobTypesLoading, setJobTypesLoading, refreshJobTypes } =
    useContext(JobTypesContext);
  const addNewJobType = async values => {
    try {
      setJobTypesLoading(true);
      const payload = {
         jobTypeName: values.jobTypeName,
         jobTypeDescription: values.jobTypeDescription,
         dbNumber: values.dbNumber, // ✅ Include DB Number
       };
    
        const response = await axios.post(endpoints.jobTypes.create, payload);
    
      if (response.status === 201) {
        refreshJobTypes();
        toast.success('Job Type added successfully!');
      }
    } catch (error) {
      console.error(error.response);
      toast.error('Failed to add Job Type: ' + error.response.data.error);
    } finally {
      setJobTypesLoading(false);
    }
  };
  const formik = useFormik({
    initialValues: {
      jobTypeName: '',
      jobTypeDescription: '',
      dbNumber: '', // Default value for DB Number
    },
  
    validationSchema: Yup.object({
      jobTypeName: Yup.string().required('Job Type Name is required'),
      jobTypeDescription: Yup.string().required('Description is required'),
      dbNumber: Yup.number()
        .required('DB Number is required')
        .positive('DB Number must be a positive number')
        .integer('DB Number must be an integer'),
    }),
    
    validateOnChange: false,
    validateOnBlur: false,
    onSubmit: (values, { resetForm }) => {
      addNewJobType(values);
      resetForm();
    },
  });

  return (
    <>
      {!jobTypesLoading && (
        <Box
          component="fieldset"
          className="mx-auto max-w-6xl border border-stone-300 dark:border-gray-700 px-6 pt-0 pb-2 rounded-lg mb-3 shadow-md"
        >
          <Typography component="legend">
            <h3 className="p-3 dark:bg-zinc-800 rounded-lg text-2xl font-mono text-zinc-900 dark:text-zinc-50">
              {addJobTypeFormConfig.title}
            </h3>
          </Typography>
          <form
            onSubmit={formik.handleSubmit}
            className="flex flex-wrap justify-between gap-6 lg:gap-0"
          >
            <div className="material-data flex flex-col w-full lg:w-3/4">
              {/* Name and Code */}
              <div className="flex flex-wrap gap-6 lg:flex-nowrap lg:gap-x-14">
                {/* Name Field */}
                {addJobTypeFormConfig.newFields?.map((field, index) => (
                  <InputField
                    key={index}
                    formik={formik}
                    labelName={field.label}
                    field={field.name}
                    type={field.type || 'text'} // ✅ Ensures number fields render correctly
                    className="w-full lg:w-1/3"
                  />
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-center max-sm:justify-center  w-full lg:w-auto">
              <CircularButton
                icon={AiOutlinePlusCircle}
                tooltip={addJobTypeFormConfig.title}
                className={"h-18 w-18 !bg-zinc-600 !text-zinc-100 dark:!bg-zinc-200 dark:!text-zinc-900 hover:!bg-zinc-400 hover:!text-zinc-600 dark:hover:!bg-zinc-600 dark:hover:!text-zinc-200 "}
              />
            </div>
          </form>
        </Box>
      )}
    </>
  );
}

export default AddJobType;
