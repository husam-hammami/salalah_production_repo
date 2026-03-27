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

const PopupModal = ({
  open,
  onClose,
  currentJobType,
  defaultKpis,
  refreshRecipes,
}) => {
  const { jobTypes } = useContext(JobTypesContext);

  const fieldOptions = {
    jobTypeSelect: jobTypes.map(job => ({
      value: job.id,
      label: job.name,
    })),
  };

  const addRecipeFormConfig = {
    title: 'New Recipe',
    fields: [
      {
        name: 'jobTypeId',
        label: 'Current Job Type: ',
        type: 'select',
        fieldOptions: fieldOptions.jobTypeSelect,
        defaultValue: currentJobType,
        isDisabled: true,
      },
      { name: 'recipeName', label: 'New Recipe Name', type: 'text' },
    ],

    actionName: 'Add',
  };
  const { title, desc, fields, actionName } = addRecipeFormConfig;

  const addNewRecipe = async values => {
    try {
      const response = await axios.post(endpoints.recipes.create, values);
      if (response.status === 200) {
        toast.success('Recipe added successfully');
        refreshRecipes(currentJobType);
      } else {
        toast.error('Something went wrong');
      }
    } catch (error) {
      console.error(error.response);
      toast.error('Failed to add recipe: ' + error.response.data.error);
    }
  };

  const formik = useFormik({
    initialValues: {
      jobTypeId: currentJobType,
      recipeName: '',
      kpis: defaultKpis,
    },
    validationSchema: Yup.object({
      jobTypeId: Yup.string().required('job Type is required'),
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
        {/* Modal Header */}
        {title && (
          <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
        )}
        {/* Modal Content */}
        <DialogContent className="flex flex-col gap-4">
          {desc && <p className="text-gray-600">{desc}</p>}

          {/* Render Formik Fields */}
          {fields &&
            fields?.map((field, index) => {
              return field.type === 'text' ? (
                <InputField
                  key={index}
                  formik={formik}
                  labelName={field.label}
                  field={field.name}
                  className={`${field.className}`}
                  disabled={field.disabled}
                />
              ) : (
                <SelectField
                  key={index}
                  formik={formik}
                  labelName={field.label}
                  field={field.name}
                  // className="w-full lg:w-1/3"
                  options={field.fieldOptions}
                  defaultValue={field.defaultValue}
                  isDisabled={field.isDisabled}
                />
              );
            })}
        </DialogContent>

        {/* Modal Actions */}
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

export default PopupModal;
