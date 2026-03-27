import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Checkbox,
} from '@mui/material';
import InputField from '../Common/InputField';
import SelectField from '../Common/SelectField';
import { useFormik } from 'formik';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import { useContext, useEffect, useMemo, useState } from 'react';
import { FlexContainer, FlexItem } from './FlexContainer';
import { JobTypesContext } from '../../Context/ApiContext/JobTypesContext';
import { BinsContext } from '../../Context/ApiContext/BinsContext';
import { OrdersContext } from '../../Context/ApiContext/OrdersContext';
import endpoints from '../../API/endpoints';
import axios from '../../API/axios';
import LoadingScreen from '../Common/LoadingScreen';
import ErrorScreen from '../Common/ErrorScreen';



const BPPopupModal = ({ open, onClose, jobTypeId }) => {
  const { jobTypes } = useContext(JobTypesContext);
  const { bins } = useContext(BinsContext);
  const { refreshOrders, setOrdersLoading } = useContext(OrdersContext);

  const resolvedJobTypeId = jobTypeId ?? jobTypes?.[0]?.id;

  const binsByMaterialId = useMemo(() => {
    return bins.reduce((acc, bin) => {
      if (!acc[bin.material_id]) acc[bin.material_id] = [];
      acc[bin.material_id].push({
        label: bin.bin_name,
        value: bin.id,
      });
      return acc;
    }, {});
  }, [bins]);


  const [fieldOptions, setFieldOptions] = useState({
    jobTypeSelect: jobTypes.map(job => ({
      value: job.id,
      label: job.name,
    })),
    recipe_id: [],
    destinationSelect: [],
  });

  const [recipesLoading, setRecipesLoading] = useState(true);
  const [recipesError, setRecipesError] = useState(null);
  const [recipeDetailsLoading, setRecipeDetailsLoading] = useState(true);
  const [recipeDetailsError, setRecipeDetailsError] = useState(null);

   const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      sources: [],
      destinations: [],
      kpis: [],
      job_type_id: resolvedJobTypeId,
      recipe_id: '-1',
      stop_options: {},
    },
    validationSchema: Yup.object({}),
    validateOnChange: false,
    validateOnBlur: false,
    onSubmit: async (values, { resetForm }) => {
      onClose();
      await submitOrder(values);
      resetForm();
    },
  });
 const submitOrder = async values => {
    try {
      setOrdersLoading(true);
      const response = await axios.post(endpoints.orders.submit, values);
      if (response.status === 200) {
        await refreshOrders();
        toast.success('Order submitted successfully');
      }
    } catch (error) {
      console.error(error.response);
      toast.error('Failed to submit order: ' + (error.response?.data?.error || error.message));
    } finally {
      setOrdersLoading(false);
    }
  };


  
  const getRecipes = async id => {
    try {
      setRecipesLoading(true);
      const res = await axios(endpoints.recipes.list(id));
      const recipes = res.data.recipes || [];

      if (recipes.length === 0) {
        setRecipesError('No Recipes Found');
        formik.setFieldValue('recipe_id', '-1');
      } else {
        setRecipesError(null);
        setFieldOptions(prev => ({
          ...prev,
          recipe_id: recipes.map(r => ({ value: r.id, label: r.name })),
        }));
        formik.setFieldValue('recipe_id', recipes[0].id);
      }
    } catch (error) {
      console.error('Recipe Fetch Error:', error);
      setRecipesError('Error fetching Recipes');
    } finally {
      setRecipesLoading(false);
    }
  };

   // Fetch recipes when job type changes
  useEffect(() => {
    if (formik.values.job_type_id) {
      formik.setFieldValue('kpis', []);
      getRecipes(formik.values.job_type_id);
    }
  }, [formik.values.job_type_id]);

  // Fetch recipe detail when recipe changes
  useEffect(() => {
    formik.setFieldValue('kpis', []);
    if (formik.values.recipe_id !== '-1') {
      getRecipeDetail(formik.values.recipe_id);
    }
  }, [formik.values.recipe_id]);



    const fillFormikValues = recipe => {
    try {
      const jobTypeKPIs = formik.values.kpis;
      const recipeKPIs = recipe.kpis || [];

      const kpiMap = new Map();
      jobTypeKPIs.forEach(kpi => kpiMap.set(String(kpi.id), { ...kpi }));
      recipeKPIs.forEach(kpi => kpiMap.set(String(kpi.id), { ...kpi }));
      const mergedKPIs = Array.from(kpiMap.values());

      formik.setFieldValue('kpis', mergedKPIs);
      formik.setFieldValue('stop_options', recipe.description || {});

      const sources = (recipe.sources || []).map((src, i) => ({
        bin_id: '',
        qty_percent: src.percentage,
        source_number: i + 1,
        materialId: src.materialId,
      }));
      formik.setFieldValue('sources', sources);

      const destinations = (recipe.destinations || []).map((_, i) => ({
        bin_id: '',
        destination_number: i + 1,
        prd_name: '',
        prd_code: '0',
      }));
      formik.setFieldValue('destinations', destinations);

      getBinsByFinalProductId(recipe.final_product_id);
    } catch (e) {
      throw new Error(`Error while filling Formik values: ${e.message}`);
    }
  };

   const getRecipeDetail = async id => {
    try {
      setRecipeDetailsLoading(true);
      const response = await axios(endpoints.recipes.details(id));
      if (!response.data) {
        setRecipeDetailsError('No Recipe Details Found');
        return;
      }
      fillFormikValues(response.data);
      setRecipeDetailsError(null);
    } catch (err) {
      console.error('Recipe Detail Error:', err);
      setRecipeDetailsError('Error fetching Recipe Details');
    } finally {
      setRecipeDetailsLoading(false);
    }
  };
// 📦 Memoize job type options once
const jobTypeOptions = useMemo(() => {
  return jobTypes.map(job => ({
    value: job.id,
    label: job.name,
  }));
}, [jobTypes]);


// ✅ Optimized destination bin loader
const getBinsByFinalProductId = (finalProductId) => {
  const destinationOptions = bins
    .filter(bin => bin.material_id === finalProductId)
    .map(bin => ({
      label: bin.bin_name,
      value: bin.id,
    }));

  setFieldOptions(prev => ({
    ...prev,
    destinationSelect: destinationOptions.length > 0
      ? destinationOptions
      : [{ label: '', value: '' }],
  }));
};
  const addRecipeFormConfig = {
    title: 'Create New Order',
    fields: [
      {
        name: 'job_type_id',
        label: 'Select Job Type: ',
        type: 'select',
        fieldOptions: fieldOptions.jobTypeSelect,
      },
      {
        name: 'recipe_id',
        label: 'Select Recipe Name',
        type: 'select',
        fieldOptions: fieldOptions.recipe_id,
      },
    ],

    actionName: 'Submit Order',
  };
  const { title, desc, fields, actionName } = addRecipeFormConfig;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth={true}
      maxWidth="lg"
      className="p-4"
    >
      {recipesLoading ? (
        <LoadingScreen/>
      ) : (
        <>                
          {/* Modal Header */}
          {title && (
            <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
          )}
          {/* Modal Content */}
          <DialogContent className="flex flex-col gap-4">
            {desc && <p className="text-gray-600">{desc}</p>}

            {/* Render Formik Fields */}
            <SelectField
              formik={formik}
              labelName={fields[0].label}
              field={fields[0].name}
              className="w-full lg:w-1/3"
              options={fields[0].fieldOptions}
            />
            {recipesError ? (
              <ErrorScreen
                message={recipesError}
                handleRefresh={() => getRecipes(formik?.values?.job_type_id)}
              />
            ) : (
              <SelectField
                formik={formik}
                labelName={fields[1].label}
                field={fields[1].name}
                className="w-full lg:w-1/3"
                options={fields[1].fieldOptions}
              />
            )}

            {recipeDetailsLoading ? (
              <LoadingScreen/>
            ) : recipeDetailsError || recipesError ? (
              <ErrorScreen
                message={recipeDetailsError || recipesError}
                handleRefresh={
                  recipeDetailsError
                    ? () => getRecipeDetail(formik.values.recipe_id)
                    : () => getRecipes(formik?.values?.job_type_id)
                }
              />
            ) : (
              <>
            {/* KPIs Section */}
<Box className="border border-zinc-300 dark:border-zinc-600 p-4 rounded-lg">
  <h3 className="text-xl font-semibold mb-2 text-center">
    Key Performance Indicators (KPIs)
  </h3>
  <FlexContainer>
    {formik.values.kpis?.map((kpi, index) => (
      <FlexItem
        key={index}
        borderColor="border-zinc-300 dark:border-zinc-600"
      >
        <h4 className="text-center font-bold mb-2">
          {kpi.kpi_name}
        </h4>
        <InputField
          type={
            kpi.data_type?.toLowerCase() === 'string'
              ? 'text'
              : kpi.data_type?.toLowerCase() === 'integer' ||
                kpi.data_type?.toLowerCase() === 'float'
              ? 'number'
              : 'text' // Default fallback
          }
          formik={formik}
          field={`kpis[${index}].value`}
          className="w-3/4 m-0"
          defaultValue={kpi.value}
        />
      </FlexItem>
    ))}
  </FlexContainer>
</Box>

                {/* Sources Section */}
                <Box className="border border-zinc-300 dark:border-zinc-600 p-4 rounded-lg">
                  <h3 className="text-xl font-semibold mb-2 text-center">
                    Sources
                  </h3>
                  <FlexContainer>
                    {formik.values.sources?.map((source, index) => (
                      <FlexItem
                        key={source.source_number}
                        borderColor="border-zinc-300 dark:border-zinc-600"
                        className="p-4 rounded-lg"
                      >
                        {/* Source Header */}
                        <h4 className="text-center font-bold mb-2">{`Source ${
                          index + 1
                        } `}</h4>

                        {/* SelectField for Bin Selection */}
                        <SelectField
                          formik={formik}
                          field={`sources[${index}].bin_id`} // Make the field unique with source_number
                          options={
                            binsByMaterialId[+source.materialId] || [
                              { label: '', value: '' },
                            ]
                          }
                        />

                        {/* InputField for Percentage */}
                        <InputField
                          formik={formik}
                          labelName=""
                          type="number"
                          field={`sources[${index}].qty_percent`} // Make the field unique with source_number
                          defaultValue={source.qty_percent} // Set the default value to qty_percent
                          className="text-center text-lg"
                        />
                      </FlexItem>
                    ))}
                  </FlexContainer>
                </Box>

                {/* Destination Section */}
                <Box className="border border-zinc-300 dark:border-zinc-600 p-4 rounded-lg">
                  <h3 className="text-xl font-semibold mb-2 text-center">
                    Destinations
                  </h3>
                  <FlexContainer>
                    {formik.values.destinations?.map((destination, index) => (
                      <FlexItem
                        key={index}
                        borderColor="border-zinc-300 dark:border-zinc-600"
                      >
                        <h4 className="text-center font-bold mb-2">
                          Destination {destination.destination_number}
                        </h4>
                        {/* Select Field for Bin */}
                        <SelectField
                          key={index}
                          formik={formik}
                          field={`destinations[${index}].bin_id`} // unique field name
                          options={fieldOptions.destinationSelect}
                        />
                      </FlexItem>
                    ))}
                  </FlexContainer>
                </Box>
              </>
            )}
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
              className="border-gray-300 text-gray-800 hover:bg-gray-100"
            >
              Cancel
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default BPPopupModal;
