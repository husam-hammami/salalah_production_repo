import { useEffect, useState } from 'react';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import {
  TextField,
  MenuItem,
  Select,
  Button,
  InputLabel,
  FormControl,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import axios from '../../API/axios';
import endpoints from '../../API/endpoints';
import { toast } from 'react-toastify';

const EditKpiModal = ({ id, onClose, refreshKpis }) => {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(null);

  const getKPIDetails = async () => {
    try {
      const response = await axios.get(endpoints.kpis.details(id));
      setFormData(response.data);
    } catch (error) {
      console.error('Error fetching KPI data:', error);
    } finally {
      setLoading(false);
    }
  };
  // Fetch the data when the modal opens
  useEffect(() => {
    getKPIDetails();
  }, [id]);

  // Validation Schema
  const validationSchema = Yup.object().shape({
    kpi_name: Yup.string().required('KPI Name is required'),
    read_write: Yup.string()
      .oneOf(['R', 'W'], 'Must be R or W')
      .required('Read/Write is required'),
    unit: Yup.string().required('Unit is required'),
    data_type: Yup.string()
      .oneOf(['string', 'integer', 'float', 'boolean'], 'Invalid Data Type')
      .required('Data Type is required'),
    db_offset: Yup.number().required('DB Offset is required'),
    default_value: Yup.string().required('Default Value is required'),
  });

  // Submit handler
  const handleSubmit = async values => {
    const payload = {
      kpiAccessType: values.read_write,
      kpiDataType: values.data_type,
      kpiDbOffset: values.db_offset,
      kpiDefaultValue: values.default_value,
      kpiId: id,
      kpiName: values.kpi_name,
      kpiUnit: values.unit,
    };

    try {
      await axios.put(endpoints.kpis.update, payload);
      refreshKpis();
      toast.success('KPI updated successfully!');
      onClose();
    } catch (error) {
      console.error('Error updating KPI:', error);
      toast.error('Failed to update KPI.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <Box
        className="bg-white dark:bg-zinc-800 "
        sx={{
          width: '400px',
          marginTop: '10vh',
          p: 3,
          borderRadius: 2,
          boxShadow: 24,
        }}
      >
        {loading ? (
          <Box display="flex" flexDirection="column" alignItems="center">
            <CircularProgress />
            <Typography variant="body1" sx={{ mt: 2 }}>
              Loading...
            </Typography>
          </Box>
        ) : (
          <Formik
            initialValues={{
              kpi_name: formData?.kpi_name || '',
              read_write: formData?.read_write || '',
              unit: formData?.unit?.trim() || '',
              data_type: formData?.data_type || 'string',
              db_offset: formData?.db_offset || 0,
              default_value: formData?.default_value || '',
              bit_value: formData?.bit_value || 0,  // Include bit value
            }}
            validationSchema={validationSchema}
            onSubmit={handleSubmit}
          >
            {({ values, errors, touched, handleChange }) => (
              <Form>
                {/* KPI Name */}
                <TextField
                  name="kpi_name"
                  label="KPI Name"
                  fullWidth
                  margin="normal"
                  value={values.kpi_name}
                  onChange={handleChange}
                  error={touched.kpi_name && Boolean(errors.kpi_name)}
                  helperText={touched.kpi_name && errors.kpi_name}
                />
                <TextField
                  name="bit_value"
                  label="Bit Value"
                  type="number"
                  fullWidth
                  margin="normal"
                  value={values.bit_value}
                  onChange={handleChange}
                />

                {/* Read/Write */}
                <FormControl fullWidth margin="normal">
                  <InputLabel id="read-write-label">Read/Write</InputLabel>
                  <Select
                    labelId="read-write-label"
                    name="read_write"
                    value={values.read_write}
                    onChange={handleChange}
                    error={touched.read_write && Boolean(errors.read_write)}
                  >
                    <MenuItem value="R">Read</MenuItem>
                    <MenuItem value="W">Write</MenuItem>
                  </Select>
                </FormControl>

                {/* Unit */}
                <TextField
                  name="unit"
                  label="Unit"
                  fullWidth
                  margin="normal"
                  value={values.unit}
                  onChange={handleChange}
                  error={touched.unit && Boolean(errors.unit)}
                  helperText={touched.unit && errors.unit}
                />

                {/* Data Type */}
                <FormControl fullWidth margin="normal">
                  <InputLabel id="data-type-label">Data Type</InputLabel>
                  <Select
                    labelId="data-type-label"
                    name="data_type"
                    value={values.data_type}
                    onChange={handleChange}
                    error={touched.data_type && Boolean(errors.data_type)}
                  >
                    <MenuItem value="string">String</MenuItem>
                    <MenuItem value="integer">Integer</MenuItem>
                    <MenuItem value="float">Float</MenuItem>
                    <MenuItem value="boolean">Boolean</MenuItem>
                  </Select>
                </FormControl>

                {/* DB Offset */}
                <TextField
                  name="db_offset"
                  label="DB Offset"
                  type="number"
                  fullWidth
                  margin="normal"
                  value={values.db_offset}
                  onChange={handleChange}
                  error={touched.db_offset && Boolean(errors.db_offset)}
                  helperText={touched.db_offset && errors.db_offset}
                />

                {/* Default Value */}
                <TextField
                  name="default_value"
                  label="Default Value"
                  fullWidth
                  margin="normal"
                  value={values.default_value}
                  onChange={handleChange}
                  error={touched.default_value && Boolean(errors.default_value)}
                  helperText={touched.default_value && errors.default_value}
                />

                {/* Buttons */}
                <Box display="flex" justifyContent="flex-end" mt={2}>
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

export default EditKpiModal;
