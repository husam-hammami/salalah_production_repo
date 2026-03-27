import { toast } from 'react-toastify';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  Checkbox,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
  Grid,
} from '@mui/material';
import { IoAddOutline } from 'react-icons/io5';
import { FaMinus, FaPlus, FaSave } from 'react-icons/fa';
import { MdDelete } from 'react-icons/md';
import CircularButton from '../Common/CircularButton';
import InputField from '../Common/InputField';
import SelectField from '../Common/SelectField';
import { useContext, useEffect, useState } from 'react';
import ActionButton from '../Common/ActionButton';
import PopupModal from './PopupModal';
import { recipeFormConfig } from '../../Data/Recipe';
import { JobTypesContext } from '../../Context/ApiContext/JobTypesContext';
import { MaterialsContext } from '../../Context/ApiContext/MaterialsContext';
import endpoints from '../../API/endpoints';
import axios from '../../API/axios';
import ErrorScreen from '../Common/ErrorScreen';
import LoadingScreen from '../Common/LoadingScreen';
import ConfirmationModal from '../Common/ConfirmationModal';

function RecipeManagement() {
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [recipesError, setRecipesError] = useState(null);
  const { jobTypes } = useContext(JobTypesContext);
  const { materials } = useContext(MaterialsContext);
  
  const [fieldOptions, setFieldOptions] = useState({
    recipeId: [],
    jobTypeId: jobTypes.map(job => ({
      value: job.id,
      label: job.name,
    })),
    finalProductId: [],
  });

  useEffect(() => {
    if (materials.length > 0) {
      const outMaterials = materials.filter(item => 
        item.is_released && item.category === 'OUT'
      );
      
      setFieldOptions(prev => ({
        ...prev,
        finalProductId: outMaterials.map(item => ({
          label: `${item.material_name} (${item.material_code})`,
          value: item.id,
        })),
      }));

      if (!formik.values.finalProductId && outMaterials.length > 0) {
        formik.setFieldValue('finalProductId', outMaterials[0].id);
      }
    }
  }, [materials]);

  const ingredientsOptions = materials
    .filter(item => item.is_released)
    .map(item => ({
      label: `${item.material_name} (${item.material_code})`,
      value: item.id,
    }));

  const formik = useFormik({
    initialValues: {
      sources: [],
      destinations: [],
      kpis: [],
      jobTypeId: jobTypes[0]?.id || '',
      recipeId: '-1',
      finalProductId: '',
      is_released: false,
      description: {
        jobQti: false,
        fullDest: false,
        emptySource: false,
        heldStatus: false,
        heldStatusDelay: 0,
        autoStopDelay: 0,
      },
    },
    validationSchema: Yup.object({
      finalProductId: Yup.string()
        .required('Final Product is required')
        .notOneOf([''], 'Final Product is required'),
    }),
    validateOnChange: false,
    validateOnBlur: false,
    onSubmit: values => {
      updateRecipe(values);
    },
  });

  const [saveLoading, setSaveLoading] = useState(false);
  const updateRecipe = async values => {
    try {
      setSaveLoading(true);
      const response = await axios.post(endpoints.recipes.update, values);
      if (response.status === 200) {
        toast.success('Recipe Updated successfully');
      }
    } catch (error) {
      console.error(error.response);
      toast.error('Failed to update recipe: ' + error.response.data.error);
    } finally {
      setSaveLoading(false);
    }
  };

  const getRecipes = async (id = null) => {
  try {
    setRecipesLoading(true);
    
    const response = await axios(
      `${endpoints.recipes.list(id || jobTypes[0]?.id)}`
    );

    // Set KPIs if present
    formik.setFieldValue(
      'kpis',
      response.data?.kpis?.map(kpi => ({
        id: kpi.id,
        kpi_name: kpi.kpi_name,
        value: kpi.default_value,
        data_type: kpi.data_type,
        unit: kpi.unit,
      }))
    );

    // ✅ Filter only regular recipes
    const regularRecipes = response.data.recipes?.filter(
      recipe => recipe.type === 'regular'
    ) || [];

    if (regularRecipes.length === 0) {
      setRecipesError('No Regular Recipes Found');
      formik.setFieldValue('recipeId', '-1');
    } else {
      setRecipesError(null);

      // ✅ Set dropdown options
      setFieldOptions(prevOptions => ({
        ...prevOptions,
        recipeId: regularRecipes.map(recipe => ({
          value: recipe.id,
          label: recipe.name,
        })),
      }));

      // ✅ Default select first recipe and load its details
      formik.setFieldValue('recipeId', regularRecipes[0].id);
      await getRecipeDetail(regularRecipes[0].id);
    }
  } catch (error) {
    setRecipesError('Error fetching Recipes: ' + error.message);
    console.error(error);
  } finally {
    setRecipesLoading(false);
  }
};


  const getWriteKPIs = async (jobTypeId) => {
    try {
      const response = await axios(`${endpoints.kpis.list(jobTypeId)}`);
      const writeKPIs = response.data?.filter(kpi => kpi.access === 'W');
      formik.setFieldValue(
        'kpis',
        writeKPIs.map(kpi => ({
          id: kpi.id,
          kpi_name: kpi.kpi_name,
          value: kpi.default_value,
          data_type: kpi.data_type,
          unit: kpi.unit,
        })),
      );
    } catch (error) {
      console.error("Error fetching Write KPIs:", error);
      toast.error("Error fetching Write KPIs");
    }
  };

  useEffect(() => {
    if (formik.values.jobTypeId) {
      formik.setFieldValue('kpis', []);
      getRecipes(formik.values.jobTypeId);
      getWriteKPIs(formik.values.jobTypeId);
    }
  }, [formik.values.jobTypeId]);
  
  useEffect(() => {
    formik.setFieldValue('kpis', []);
    if (formik.values.recipeId !== '-1') {
      getRecipeDetail(formik.values.recipeId);
      getWriteKPIs(formik.values.jobTypeId);
    }
  }, [formik.values.recipeId]);
  
  const [recipeDetailsLoading, setRecipeDetailsLoading] = useState(true);
  const [recipeDetailsError, setRecipeDetailsError] = useState(false);

  const fillFormikValues = recipe => {
    try {
      formik.setFieldValue('finalProductId', recipe.final_product_id || fieldOptions.finalProductId[0]?.value || '');
      formik.setFieldValue('is_released', recipe.released);

      const jobTypeKPIs = formik.values.kpis;
      const recipeKPIs = recipe.kpis;
      const kpiMap = new Map();

      jobTypeKPIs.forEach(kpi => {
        kpiMap.set(String(kpi.id), { ...kpi });
      });
      recipeKPIs.forEach(kpi => {
        kpiMap.set(String(kpi.id), { ...kpi });
      });
      const mergedKPIs = Array.from(kpiMap.values());

      formik.setFieldValue('kpis', mergedKPIs);

      if (recipe.sources && recipe.sources.length > 0) {
        formik.setFieldValue(
          'sources',
          recipe.sources.map(ingredient => ({
            materialId: ingredient.materialId,
            percentage: ingredient.percentage,
          })),
        );
      } else {
        formik.setFieldValue('sources', [
          {
            materialId: ingredientsOptions[0]?.value || '',
            percentage: 100,
          },
        ]);
      }

      if (recipe.destinations && recipe.destinations.length > 0) {
        formik.setFieldValue('destinations', recipe.destinations);
      } else {
        formik.setFieldValue('destinations', [1]);
      }
    } catch (error) {
      throw new Error(`Error while filling Formik values: ${error.message}`);
    }
  };

  const getRecipeDetail = async id => {
    try {
      setRecipeDetailsLoading(true);
      const response = await axios(`${endpoints.recipes.details(id)}`);
      if (response.data.length === 0) {
        setRecipeDetailsError('No Recipe Details Found');
      } else {
        setRecipeDetailsError(null);
        fillFormikValues(response.data);
      }
    } catch (error) {
      setRecipeDetailsError('Error fetching Recipe Details: ' + error);
      console.error(error);
    } finally {
      setRecipeDetailsLoading(false);
    }
  };

  const [isModalOpen, setModalOpen] = useState(false);
  const handleOpenModal = () => setModalOpen(true);
  const handleCloseModal = () => setModalOpen(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const cancelDelete = () => {
    setIsDeleteModalOpen(false);
  };
  
  const removeRecipe = async id => {
    try {
      setIsDeleteModalOpen(false);
      const response = await axios.delete(endpoints.recipes.delete(id));
      if (response.status === 200) {
        getRecipes(formik.values.jobTypeId);
        toast.success('The recipe has been deleted.');
      }
    } catch (error) {
      console.error(error.response);
      toast.error('Failed to remove recipe: ' + error.response.data.error);
    }
  };

  const handleAddIngredient = () => {
    const currentSources = formik.values.sources || [];
    if (currentSources.length < 5) {
      const newIngredient = {
        materialId: ingredientsOptions[0]?.value || '',
        percentage: 0,
      };
      formik.setFieldValue('sources', [...currentSources, newIngredient]);
    }
  };
  
  const handleRemoveIngredient = () => {
    const currentSources = formik.values.sources || [];
    if (currentSources.length > 1) {
      const updatedSources = currentSources.slice(0, -1);
      formik.setFieldValue('sources', updatedSources);
    }
  };

  const handleAddDestination = () => {
    const currentDestinations = formik.values.destinations || [];
    if (currentDestinations.length < 5) {
      const newDestination = currentDestinations.length + 1;
      formik.setFieldValue('destinations', [
        ...currentDestinations,
        newDestination,
      ]);
    }
  };

  const handleRemoveDestination = () => {
    const currentDestinations = formik.values.destinations || [];
    if (currentDestinations.length > 1) {
      const updatedDestinations = currentDestinations.slice(0, -1);
      formik.setFieldValue('destinations', updatedDestinations);
    }
  };

  return (
    <>
      {recipesLoading ? (
        <LoadingScreen />
      ) : (
        <>
          {saveLoading && <LoadingScreen />}
          <Box
            component="fieldset"
            className="mx-auto w-full max-w-7xl border border-stone-300 dark:border-gray-700 px-4 sm:px-6 pt-0 pb-4 rounded-lg mb-3"
          >
         <Typography component="legend">
  <h3 className="p-3 rounded-lg text-2xl font-mono font-semibold text-zinc-900 bg-zinc-200 dark:text-zinc-50 dark:bg-gradient-to-r dark:from-[#0B1F3A] dark:to-[#1F3D63] shadow">
    {recipeFormConfig.title}
  </h3>
</Typography>

            <form className="flex flex-col gap-4">
              <div className="recipes w-full">
                <Grid container spacing={2} alignItems="center" className="mb-4">
                  <Grid item xs={12} md={6}>
                    <div className="flex flex-wrap gap-4 items-end">
                      <SelectField
                        formik={formik}
                        labelName={recipeFormConfig.recipeControl[0].label}
                        field={recipeFormConfig.recipeControl[0].name}
                        className="flex-1 min-w-[200px]"
                        options={
                          fieldOptions[recipeFormConfig.recipeControl[0].name]
                        }
                      />
                      {recipesError ? (
                        <ErrorScreen
                          message={
                            recipesError + ', Please add a recipe first'
                          }
                          handleRefresh={() =>
                            getRecipes(formik?.values?.jobTypeId)
                          }
                        />
                      ) : (
                        <SelectField
                          formik={formik}
                          labelName={recipeFormConfig.recipeControl[1].label}
                          field={recipeFormConfig.recipeControl[1].name}
                          className="flex-1 min-w-[200px]"
                          options={
                            fieldOptions[
                              recipeFormConfig.recipeControl[1].name
                            ]
                          }
                        />
                      )}
                    </div>
                  </Grid>
                  <Grid item xs={12} md={6} className="flex justify-end">
                    <div className="flex gap-3">
                      <CircularButton
                        action={handleOpenModal}
                        type="button"
                        icon={IoAddOutline}
                        tooltip="Add Recipe"
                        className={
                          '!text-zinc-100 p-2 !bg-green-900 hover:!bg-green-800 dark:!bg-green-700 dark:hover:!bg-green-600 hover:!text-zinc-100'
                        }
                        size={55}
                      />
                      {!recipesError && (
                        <>
                          <CircularButton
                            action={formik.handleSubmit}
                            icon={FaSave}
                            tooltip="Save Recipe"
                            className={
                              '!text-zinc-100 p-2 !bg-blue-900 hover:!bg-blue-800 dark:!bg-blue-700 dark:hover:!bg-blue-600 hover:!text-zinc-100'
                            }
                            size={55}
                          />
                          <CircularButton
                            icon={MdDelete}
                            action={() => setIsDeleteModalOpen(true)}
                            tooltip="Remove Recipe"
                            type="button"
                            className={
                              '!text-zinc-100 p-2 bg-red-900  hover:!bg-red-700 dark:!bg-red-700 dark:hover:!bg-red-600 hover:!text-zinc-100'
                            }
                            size={55}
                          />
                        </>
                      )}
                    </div>
                  </Grid>
                </Grid>

                {recipesError ? null : recipeDetailsLoading ? (
                  <LoadingScreen />
                ) : recipeDetailsError ? (
                  <ErrorScreen
                    message={recipeDetailsError}
                    handleRefresh={
                      recipeDetailsError
                        ? () => getRecipeDetail(formik.values.recipeId)
                        : () => getRecipes(formik?.values?.jobTypeId)
                    }
                  />
                ) : (
                  <>
                    <div className="recipe-data mb-6">
                      <h4 className="font-medium mb-3">Data:</h4>
                      <Grid container spacing={3}>
                        <Grid item xs={12} sm={6} md={3}>
                          <div className="flex flex-col">
                            <label
                              htmlFor={recipeFormConfig.recipeData[0].name}
                              className="dark:text-zinc-50 mb-1"
                            >
                              {recipeFormConfig.recipeData[0].label}
                            </label>
                            <TextField
                              id={recipeFormConfig.recipeData[0].name}
                              name={recipeFormConfig.recipeData[0].name}
                              variant="outlined"
                              size="small"
                              disabled={recipeFormConfig.recipeData[0].disabled}
                              value={formik.values.recipeId || '-1'}
                              onChange={formik?.handleChange}
                              onBlur={formik?.handleBlur}
                              error={
                                formik?.touched[
                                  recipeFormConfig.recipeData[0].name
                                ] &&
                                Boolean(
                                  formik?.errors[
                                    recipeFormConfig.recipeData[0].name
                                  ],
                                )
                              }
                              helperText={
                                formik?.touched[
                                  recipeFormConfig.recipeData[0].name
                                ] &&
                                formik.errors[recipeFormConfig.recipeData[0].name]
                              }
                              fullWidth
                            />
                          </div>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                          <div className="flex flex-col">
                            <label htmlFor="finalProductId" className="dark:text-zinc-50 mb-1">
                              {recipeFormConfig.recipeData[1].label}
                            </label>
                            <Select
                              value={formik.values.finalProductId || ''}
                              size="small"
                              id="finalProductId"
                              name="finalProductId"
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              displayEmpty
                              fullWidth
                            >
                              <MenuItem value="" disabled>
                                <em>Select Final Product</em>
                              </MenuItem>
                              {fieldOptions.finalProductId.length > 0 ? (
                                fieldOptions.finalProductId.map((option, index) => (
                                  <MenuItem key={index} value={option.value}>
                                    {option.label}
                                  </MenuItem>
                                ))
                              ) : (
                                <MenuItem disabled>No OUT materials available</MenuItem>
                              )}
                            </Select>
                            {formik?.touched.finalProductId &&
                              formik?.errors.finalProductId && (
                                <span className="text-red-500 text-sm">
                                  {formik.errors.finalProductId}
                                </span>
                              )}
                          </div>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3} className="flex items-center">
                          <label className="flex items-center">
                            <Switch
                              checked={formik.values.is_released}
                              onChange={e =>
                                formik.setFieldValue(
                                  'is_released',
                                  e.target.checked,
                                )
                              }
                            />
                            <span
                              className={`ml-2 font-semibold text-xl ${
                                formik.values.is_released
                                  ? 'text-green-700 dark:text-green-500'
                                  : 'text-red-700 dark:text-red-500'
                              }`}
                            >
                              {formik.values.is_released
                                ? 'Released'
                                : 'Not Released'}
                            </span>
                          </label>
                        </Grid>
                      </Grid>
                    </div>

                    <div className="recipe-kpi mb-6">
                      <h4 className="font-medium mb-3">KPIs:</h4>
                      <Grid container spacing={2}>
                        {formik.values.kpis?.map((kpi, index) => (
                          <Grid item xs={12} sm={6} md={4} lg={3} key={kpi.id}>
                            <Paper className="p-3 rounded-lg shadow">
                              <h4 className="mb-2 text-center">{kpi.kpi_name} ({kpi.unit})</h4>
                              {kpi.data_type?.toLowerCase() === 'boolean' ? (
                                <Select
                                  value={formik.values.kpis[index].value ? 'true' : 'false'}
                                  onChange={(e) =>
                                    formik.setFieldValue(`kpis[${index}].value`, e.target.value === 'true')
                                  }
                                  size="small"
                                  variant="outlined"
                                  fullWidth
                                >
                                  <MenuItem value="true">True</MenuItem>
                                  <MenuItem value="false">False</MenuItem>
                                </Select>
                              ) : (
                                <InputField
                                  type={kpi.data_type === 'string' ? 'text' : 'number'}
                                  formik={formik}
                                  field={`kpis[${index}].value`}
                                  defaultValue={kpi.value}
                                  fullWidth
                                />
                              )}
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    </div>

                   <div className="raw-ingredients mb-6">
  <div className="flex justify-between items-center mb-3">
    <h4 className="font-semibold text-lg text-zinc-800 dark:text-zinc-100">Raw Ingredients:</h4>
    <div className="flex gap-2">
      <ActionButton
        className="h-10 w-10 !bg-zinc-600 !text-white dark:!bg-zinc-200 dark:!text-zinc-900 hover:!bg-zinc-400 dark:hover:!bg-zinc-600 dark:hover:!text-zinc-100"
        icon={FaPlus}
        tooltip="Add Ingredient"
        iconSize="sm:!text-xl !text-lg"
        action={handleAddIngredient}
      />
      <ActionButton
        className="h-10 w-10 !bg-zinc-600 !text-white dark:!bg-zinc-200 dark:!text-zinc-900 hover:!bg-zinc-400 dark:hover:!bg-zinc-600 dark:hover:!text-zinc-100"
        icon={FaMinus}
        tooltip="Remove Ingredient"
        iconSize="sm:!text-xl !text-lg"
        action={handleRemoveIngredient}
      />
    </div>
  </div>

 <Grid container spacing={2}>
  {formik.values.sources?.map((ingredient, index) => (
    <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
      <Paper
        elevation={3}
        className="p-4 rounded-xl shadow-md bg-zinc-100 text-zinc-800 dark:bg-gradient-to-r dark:from-[#0B1F3A] dark:to-[#1F3D63] dark:text-white transition-colors duration-300"
      >
        <h4 className="mb-2 text-center font-semibold tracking-wide">
          Ingredient {index + 1}
        </h4>
        <SelectField
          formik={formik}
          field={`sources[${index}].materialId`}
          defaultValue={ingredient.materialId}
          options={ingredientsOptions}
          fullWidth
          className="mb-3"
        />
        <div className="flex items-center">
          <InputField
            type="number"
            formik={formik}
            field={`sources[${index}].percentage`}
            defaultValue={ingredient.percentage}
            fullWidth
            className="mr-2"
          />
          <span className="text-sm font-semibold dark:text-white">%</span>
        </div>
      </Paper>
    </Grid>
  ))}
</Grid>

</div>


                    <div className="destination mb-6">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium">Destination:</h4>
                        <div className="flex gap-2">
                          <ActionButton
                            className="h-10 w-10 !bg-zinc-600 !text-zinc-100 dark:!bg-zinc-200 dark:!text-zinc-900 hover:!bg-zinc-400 hover:!text-zinc-600 dark:hover:!bg-zinc-600 dark:hover:!text-zinc-200"
                            icon={FaPlus}
                            tooltip="Add Destination"
                            action={handleAddDestination}
                            iconSize="sm:!text-xl !text-lg"
                          />
                          <ActionButton
                            className="h-10 w-10 !bg-zinc-600 !text-zinc-100 dark:!bg-zinc-200 dark:!text-zinc-900 hover:!bg-zinc-400 hover:!text-zinc-600 dark:hover:!bg-zinc-600 dark:hover:!text-zinc-200"
                            icon={FaMinus}
                            tooltip="Remove Destination"
                            action={handleRemoveDestination}
                            iconSize="sm:!text-xl !text-lg"
                          />
                        </div>
                      </div>
                      <Grid container spacing={2}>
                        {formik.values.destinations.map((destination, index) => (
                          <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                            <Paper className="p-3 rounded-lg shadow text-center">
                              <h4>Destination {index + 1}</h4>
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    </div>

                    <div className="description">
                      <h4 className="font-medium mb-3">Stop Options:</h4>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
                            <h5 className="mb-2">Conditions:</h5>
                            <Grid container spacing={1}>
                              {recipeFormConfig.description.map(
                                (option, index) => (
                                  <Grid item xs={12} sm={6} key={index}>
                                    <label className="flex items-center">
                                      <Checkbox
                                        checked={
                                          formik.values.description?.[option.name]
                                            ? true
                                            : false
                                        }
                                        onChange={e =>
                                          formik.setFieldValue(
                                            `description.${option.name}`,
                                            e.target.checked,
                                          )
                                        }
                                      />
                                      {option.label}
                                    </label>
                                  </Grid>
                                )
                              )}
                            </Grid>
                          </div>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
                            <h5 className="mb-2">Delays:</h5>
                            <Grid container spacing={2}>
                              {recipeFormConfig.delays?.map((field, index) => (
                                <Grid item xs={12} sm={6} key={index}>
                                  <InputField
                                    formik={formik}
                                    labelName={field.label}
                                    field={`description.${field.name}`}
                                    type={field.type}
                                    fullWidth
                                  />
                                </Grid>
                              ))}
                            </Grid>
                          </div>
                        </Grid>
                      </Grid>
                    </div>
                  </>
                )}
              </div>
            </form>
          </Box>
          {isModalOpen && (
            <PopupModal
              open={isModalOpen}
              onClose={handleCloseModal}
              currentJobType={formik.values.jobTypeId}
              defaultKpis={formik.values.kpis}
              refreshRecipes={getRecipes}
            />
          )}
          {isDeleteModalOpen && (
            <ConfirmationModal
              isOpen={isDeleteModalOpen}
              title="Confirm Deletion"
              description={`Are you sure you want to delete ${
                fieldOptions.recipeId.find(
                  option => option.value === formik.values.recipeId,
                )?.label
              }?`}
              onConfirm={removeRecipe}
              id={formik.values.recipeId}
              onCancel={cancelDelete}
              confirmText="Delete"
              cancelText="Cancel"
            />
          )}
        </>
      )}
    </>
  );
}

export default RecipeManagement;