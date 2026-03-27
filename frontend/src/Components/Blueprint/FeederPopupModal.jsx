import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box
} from '@mui/material';
import InputField from '../Common/InputField';
import SelectField from '../Common/SelectField';
import { useFormik } from 'formik';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import { useContext, useEffect, useState, useMemo } from 'react';
import { JobTypesContext } from '../../Context/ApiContext/JobTypesContext';
import { FeederOrdersContext } from './FeederOrdersContext';
import axios from '../../API/axios';
import LoadingScreen from '../Common/LoadingScreen';
import ErrorScreen from '../Common/ErrorScreen';
import { FlexContainer, FlexItem } from '../Blueprint/FlexContainer';

const FeederPopupModal = ({ open, onClose, jobTypeId }) => {
  const { jobTypes } = useContext(JobTypesContext);
  const { refreshOrders, setOrdersLoading } = useContext(FeederOrdersContext);
  const [materials, setMaterials] = useState([]);
  const [bins, setBins] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState(null);

  const binsByMaterialId = useMemo(() => {
    return bins.reduce((acc, bin) => {
      if (!acc[bin.material_id]) acc[bin.material_id] = [];
      acc[bin.material_id].push({ label: bin.bin_name, value: bin.id });
      return acc;
    }, {});
  }, [bins]);

  const formik = useFormik({
    initialValues: {
      jobTypeId: jobTypeId || '',
      recipeId: '',
      feeders: [],
      kpis: [],
      stopOptions: {},
      orderName: ''
    },
    validationSchema: Yup.object({
      jobTypeId: Yup.string().required('Job type is required'),
      recipeId: Yup.string().required('Recipe is required'),
      orderName: Yup.string().required('Order name is required')
    }),
    validateOnChange: false,
    validateOnBlur: false,
    onSubmit: (values, { resetForm }) => {
      onClose();
      submitOrder(values);
      resetForm();
    }
  });

useEffect(() => {
  if (formik.values.jobTypeId) {
    console.log('[🔁 Trigger getRecipes] JobTypeId:', formik.values.jobTypeId);
    getRecipes(formik.values.jobTypeId);
  }
}, [formik.values.jobTypeId]);

  const getMaterials = async () => {
    try {
      const res1 = await axios.get('/materials');
      const res2 = await axios.get('/bins');
      if (res1.status === 200) setMaterials(res1.data);
      if (res2.status === 200) setBins(res2.data);
    } catch (error) {
      console.error('[❌ Error fetching materials or bins]', error);
    }
  };

  useEffect(() => {
    getMaterials();
  }, []);

  const getRecipes = async (jobTypeId) => {
    try {
      setRecipesLoading(true);
      setRecipesError(null);
       // 🔍 Log what jobTypeId is used in the request
    console.log('[📡 getRecipes] Fetching recipes for jobTypeId:', jobTypeId);
      const response = await axios.get(`/feeder-recipes/${jobTypeId}`);
      const data = response.data || [];
        // 🔍 Log the actual API response
    console.log('[✅ API Response]', response.data);
      if (!Array.isArray(data)) {
        setRecipesError('Invalid data format');
        return;
      }
      setRecipes(data);
     if (data.length === 0) {
        setRecipesError('No Recipes Found for this Job Type');
        formik.setFieldValue('recipeId', '');
      } else {
        setRecipesError(null);
        setRecipes(data);
        formik.setFieldValue('recipeId', data[0].id);
      }
    } catch (error) {
      console.error('[❌ Error fetching recipes]', error);
      setRecipes([]);
      setRecipesError('Failed to load recipes');
    } finally {
      setRecipesLoading(false);
    }
  };

  const getRecipeDetails = async (id) => {
    try {
      const response = await axios.get(`/feeder-recipes/details/${id}`);
      if (response.status === 200 && response.data) {
        const data = response.data;
       const enrichedFeeders = (data.feeders || []).map(feeder => {
        const materialId = feeder.materialId || feeder.material_id;  // ✅ normalize key
        const matchedMaterial = materials.find(m => m.id === materialId);
        const possibleBins = bins.filter(bin => bin.material_id === materialId);

        return {
          material_id: materialId,
          material_name: matchedMaterial?.material_name || 'Unnamed',
          bin_id: possibleBins.length === 1 ? possibleBins[0].id : '',
          percentage: feeder.percentage || 0
        };
      });

        console.log('[🧩 Enriched Feeders]', enrichedFeeders);
        formik.setFieldValue('feeders', enrichedFeeders);
        formik.setFieldValue('kpis', data.kpis || []);
        formik.setFieldValue('stopOptions', data.description || {});
      }
    } catch (error) {
      console.error('[❌ Error fetching recipe details]', error);
      toast.error('Failed to load recipe details');
    }
  };

  useEffect(() => {
    if (formik.values.recipeId) {
      getRecipeDetails(formik.values.recipeId);
    }
  }, [formik.values.recipeId]);

  const submitOrder = async (values) => {
    try {
      setOrdersLoading(true);
      const payload = {
        jobTypeId: values.jobTypeId,
        recipeId: values.recipeId,
        orderName: values.orderName,
        feeders: values.feeders,
        kpis: values.kpis,
        stopOptions: values.stopOptions,
      };
      const response = await axios.post('/orders/feeder-orders/create', payload);
      if (response.status === 201) {
        toast.success('Feeder order created');
        await refreshOrders();
      }
    } catch (error) {
      toast.error('Failed to create feeder order');
      console.error('[❌ Feeder order error]', error);
    } finally {
      setOrdersLoading(false);
    }
  };

  const jobTypeOptions = jobTypes.map(j => ({ label: j.name, value: j.id }));
  const recipeOptions = recipes.map(r => ({ label: r.name, value: r.id }));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      {recipesLoading ? (
        <LoadingScreen />
      ) : recipesError ? (
        <ErrorScreen
          message={recipesError}
          handleRefresh={() => getRecipes(formik.values.jobTypeId)}
        />
      ) : (
        <>
          <DialogTitle>Create Feeder Order</DialogTitle>
          <DialogContent className="flex flex-col gap-4 py-4">
            <InputField labelName="Order Name" formik={formik} field="orderName" className="w-full" />
            <SelectField labelName="Job Type" formik={formik} field="jobTypeId" options={jobTypeOptions} className="w-full" />
            <SelectField labelName="Recipe" formik={formik} field="recipeId" options={recipeOptions} className="w-full" />

            <Box className="border border-zinc-300 dark:border-zinc-600 p-4 rounded-lg">
              <h3 className="text-xl font-semibold mb-2 text-center">Key Performance Indicators (KPIs)</h3>
              <FlexContainer>
                {formik.values.kpis?.map((kpi, index) => (
                  <FlexItem key={index} borderColor="border-zinc-300 dark:border-zinc-600">
                    <h4 className="text-center font-bold mb-2">{kpi.kpi_name}</h4>
                    <InputField
                      type={kpi.data_type?.toLowerCase() === 'string' ? 'text' : kpi.data_type?.toLowerCase() === 'integer' || kpi.data_type?.toLowerCase() === 'float' ? 'number' : 'text'}
                      formik={formik}
                      field={`kpis[${index}].value`}
                      className="w-3/4 m-0"
                      defaultValue={kpi.value}
                    />
                  </FlexItem>
                ))}
              </FlexContainer>
            </Box>

            <Box className="border border-zinc-300 dark:border-zinc-600 p-4 rounded-lg">
              <h3 className="text-xl font-semibold mb-2 text-center">Feeders</h3>
              <FlexContainer>
  {formik.values.feeders?.map((feeder, index) => {
    const binOptions = binsByMaterialId[feeder.material_id] || [];

    // Auto-select bin if only one
    if (!feeder.bin_id && binOptions.length === 1) {
      formik.setFieldValue(`feeders[${index}].bin_id`, binOptions[0].value);
    }

    return (
      <FlexItem key={index} borderColor="border-zinc-300 dark:border-zinc-600" className="p-4 rounded-lg">
        <h4 className="text-center font-bold mb-2">Source {index + 1}</h4>
        <div className="text-sm text-gray-700 mb-1">Material: {feeder.material_name}</div>

        {binOptions.length > 0 ? (
          <SelectField
            formik={formik}
            field={`feeders[${index}].bin_id`}
            labelName="Bin"
            options={binOptions}
            className="w-full"
          />
        ) : (
          <div className="text-red-600 text-sm text-center">No bins found for this material</div>
        )}
      </FlexItem>
    );
  })}
</FlexContainer>

            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={formik.handleSubmit} variant="contained" className="bg-blue-600 text-white hover:bg-blue-700">Submit</Button>
            <Button onClick={onClose} variant="outlined">Cancel</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

export default FeederPopupModal;
