// Updated FeederPopupModal.jsx
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import InputField from '../Common/InputField';
import SelectField from '../Common/SelectField';
import { useFormik } from 'formik';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import { useContext } from 'react';
import axios from '../../API/axios';
import { JobTypesContext } from '../../Context/ApiContext/JobTypesContext';
import endpoints from '../../API/endpoints';

const FeederPopupModal = ({
  open,
  onClose,
  currentJobType,
  defaultKpis,
  refreshRecipes,
}) => {
  const { jobTypes } = useContext(JobTypesContext);

 const fieldOptions = {
  jobTypeSelect: jobTypes
    .filter(job => job.type === 'feeder') // ✅ filter only feeder jobs
    .map(job => ({
      value: job.id,
      label: job.name,
    })),
};


  const addRecipeFormConfig = {
    title: 'New Recipe',
    fields: [
      {
        name: 'jobTypeId',
        label: 'Current Job Type:',
        type: 'select',
        fieldOptions: fieldOptions.jobTypeSelect,
        defaultValue: currentJobType,
        isDisabled: true,
      },
      {
        name: 'recipeName',
        label: 'New Recipe Name',
        type: 'text',
      },
    ],
    actionName: 'Add',
  };

  const { title, desc, fields, actionName } = addRecipeFormConfig;

  const addNewRecipe = async values => {
    try {
      const response = await axios.post(endpoints.feederRecipes.create, {
        jobTypeId: values.jobTypeId,
        recipeName: values.recipeName,
        kpis: values.kpis,
        feeders: [], // Final product & description handled later
      });

      if (response.status === 201) {
        toast.success('Feeder recipe added successfully');
        refreshRecipes(currentJobType); // Refresh recipe list to populate new entry
      } else {
        toast.error('Something went wrong while adding feeder recipe');
      }
    } catch (error) {
      console.error('Feeder Recipe Create Error:', error.response || error);
      toast.error('Failed to add feeder recipe: ' + (error.response?.data?.error || error.message));
    }
  };

  const formik = useFormik({
    initialValues: {
      jobTypeId: currentJobType,
      recipeName: '',
      kpis: defaultKpis,
    },
    validationSchema: Yup.object({
      jobTypeId: Yup.string().required('Job Type is required'),
      recipeName: Yup.string().required('Recipe Name is required'),
    }),
    onSubmit: (values, { resetForm }) => {
      onClose();
      addNewRecipe(values);
      resetForm();
    },
  });

  return (
    <form onSubmit={formik.handleSubmit}>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth={true}
        maxWidth="sm"
        className="p-4"
      >
        {title && <DialogTitle className="text-lg font-bold">{title}</DialogTitle>}
        <DialogContent className="flex flex-col gap-4">
          {desc && <p className="text-gray-600">{desc}</p>}

          {fields && fields.map((field, index) =>
            field.type === 'text' ? (
              <InputField
                key={index}
                formik={formik}
                labelName={field.label}
                field={field.name}
                className={field.className || ''}
                disabled={field.disabled}
              />
            ) : (
              <SelectField
                key={index}
                formik={formik}
                labelName={field.label}
                field={field.name}
                options={field.fieldOptions}
                defaultValue={field.defaultValue}
                isDisabled={field.isDisabled}
              />
            )
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={formik.handleSubmit}
            variant="contained"
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {actionName}
          </Button>
          <Button
            onClick={onClose}
            variant="outlined"
            className="border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </form>
  );
};

export default FeederPopupModal;
