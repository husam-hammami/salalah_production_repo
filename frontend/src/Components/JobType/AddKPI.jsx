import { toast } from 'react-toastify';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Box, Typography } from '@mui/material';
import { AiOutlinePlusCircle } from 'react-icons/ai';
import CircularButton from '../Common/CircularButton';
import InputField from '../Common/InputField';
import SelectField from '../Common/SelectField';
import { addKPIFormConfig } from '../../Data/JobType';
import { useContext, useEffect, useState } from 'react';
import { JobTypesContext } from '../../Context/ApiContext/JobTypesContext';
import axios from '../../API/axios';
import endpoints from '../../API/endpoints';

function AddKPI({ setSelectedJobType, refreshKpis, setKpisLoading }) {
  const { jobTypes } = useContext(JobTypesContext);

  // Store DB Number of selected Job Type
  const [selectedDbNumber, setSelectedDbNumber] = useState(null);

  const [fieldOptions, setFieldOptions] = useState({
    kpiDataType: addKPIFormConfig.dataTypes,
    jobTypeId: jobTypes.map(job => ({
      value: job.id,
      label: job.name,
    })),
    kpiAccessType: addKPIFormConfig.accessTypes,
  });

  const addNewKpi = async values => {
    try {
      setKpisLoading(true);
      const response = await axios.post(endpoints.kpis.create, values);
      if (response.status === 201) {
        refreshKpis();
        toast.success('KPI added successfully');
      }
    } catch (error) {
      console.error(error.response);
      toast.error('Failed to add KPI: ' + error.response.data.error);
    } finally {
      setKpisLoading(false);
    }
  };

  // Set Job Type options
  useEffect(() => {
    setFieldOptions(prevOptions => ({
      ...prevOptions,
      jobTypeId: jobTypes.map(job => ({
        value: job.id,
        label: job.name,
      })), // Update the jobTypeId options
    }));
  }, [jobTypes]);

  // Formik for handling form submission and validation
  const formik = useFormik({
    initialValues: {
      jobTypeId: '',
      kpiName: '',
      kpiDataType: '',
      kpiDefaultValue: '',
      kpiDbOffset: '',
      kpiUnit: '',
      kpiAccessType: '',
      bitValue: '', // New field initialization
    },
    validationSchema: Yup.object({
      jobTypeId: Yup.string().required('Please select a job type.'),
      kpiName: Yup.string().required('KPI name is required.'),
      kpiDataType: Yup.string().required('Please select the data type for the KPI.'),
      kpiDefaultValue: Yup.string().required('Default value for the KPI is required.'),
      kpiDbOffset: Yup.string().required('Database offset for the KPI is required.'),
      kpiUnit: Yup.string().required('Please specify a unit for the KPI.'),
      kpiAccessType: Yup.string().required('Please select an access type (Read or Write).'),
      bitValue: Yup.number().integer().required('Bit value is required.')
    }),
    validateOnChange: false,
    validateOnBlur: false,
    onSubmit: (values, { resetForm }) => {
      addNewKpi(values);
      resetForm({
        values: {
          jobTypeId: values.jobTypeId,
          kpiName: '',
          kpiDataType: '',
          kpiDefaultValue: '',
          kpiDbOffset: '',
          kpiUnit: '',
          kpiAccessType: '',
          bitValue: '', // Reset after submission
        },
      });
    },
  });

  // Update selected Job Type and fetch its DB Number
  useEffect(() => {
    // Update the selected job type in the parent component (if needed)
    setSelectedJobType(formik.values.jobTypeId);
  
    // Find the selected job type from the jobTypes list
    const selectedJob = jobTypes.find(
      job => String(job.id) === String(formik.values.jobTypeId) 
    );
  
    // Use nullish coalescing (??) to allow valid 0 values to display
    if (selectedJob) {
      setSelectedDbNumber(selectedJob.db_number ?? "N/A");
    } else {
      setSelectedDbNumber("N/A");
    }
  }, [formik.values.jobTypeId, jobTypes]);
  

  return (
    <>
      <Box
        component="fieldset"
        className="mx-auto max-w-6xl border border-stone-300 dark:border-gray-700 px-6 pt-0 pb-2 rounded-lg mb-3 shadow-md"
      >
        <Typography component="legend">
          <h3 className="p-3 dark:bg-zinc-800 rounded-lg text-2xl font-mono text-zinc-900 dark:text-zinc-50">
            {addKPIFormConfig.title}
          </h3>
        </Typography>
        <form
          onSubmit={formik.handleSubmit}
          className="flex flex-wrap justify-between gap-6 lg:gap-0 lg:space-x-20"
        >
          <div className="kpi-data flex flex-col w-full flex-1">
            {/* Job Type Dropdown & DB Number Display */}
            <div className="job-type mb-3 flex items-center space-x-6">
              {/* Job Type Dropdown */}
              <SelectField
                formik={formik}
                labelName={addKPIFormConfig.selectJobField.label}
                field={addKPIFormConfig.selectJobField.name}
                type={addKPIFormConfig.selectJobField.type}
                className="w-full lg:w-2/3"
                options={fieldOptions[addKPIFormConfig.selectJobField.name]}
              />

              {/* Display DB Number */}
              <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
                DB Number: <span className="text-blue-500">{selectedDbNumber}</span>
              </span>
               <InputField
                    formik={formik}
                    labelName="Bit Value"
                    field="bitValue"
                    type="number"
                    className="w-full lg:w-1/3"
                  />

            </div>

            

            {/* KPI Fields */}
            <div className="flex flex-wrap gap-6 lg:flex-nowrap lg:gap-x-8">
              {addKPIFormConfig.newFields?.map((field, index) => {
                return field.type === 'text' ? (
                  <InputField
                    key={index}
                    formik={formik}
                    labelName={field.label}
                    field={field.name}
                    className="w-full lg:w-1/3"
                  />
                 
                ) : (
                  
                  <SelectField
                    key={index}
                    formik={formik}
                    labelName={field.label}
                    field={field.name}
                    className="w-full lg:w-1/3"
                    options={fieldOptions[field.name]}
                  />
                );
              })}
            </div>
          </div>
          

          {/* Submit Button */}
          <div className="flex items-center max-sm:justify-center w-full lg:w-auto">
            <CircularButton
              icon={AiOutlinePlusCircle}
              tooltip={addKPIFormConfig.title}
              className="h-18 w-18 !bg-zinc-600 !text-zinc-100 dark:!bg-zinc-200 dark:!text-zinc-900 hover:!bg-zinc-400 hover:!text-zinc-600 dark:hover:!bg-zinc-600 dark:hover:!text-zinc-200"
            />
          </div>
        </form>
      </Box>
    </>
  );
}

export default AddKPI;
