// Configuration for adding Job Type - Modified to include DB Number
export const addJobTypeFormConfig = {
  title: 'Add Job Type',
  newFields: [
    { name: 'jobTypeName', label: 'Job Type Name' },
    { name: 'jobTypeDescription', label: 'Description' },
    { name: 'dbNumber', label: 'DB Number', type: 'number' }, // New field
  ],
};

// Configuration for adding Job Type
export const addKPIFormConfig = {
  title: 'Define KPIs for Job Type',
  selectJobField: {
    name: 'jobTypeId',
    label: 'Select Job Type',
    type: 'select',
  },
  newFields: [
    { name: 'kpiName', label: 'KPI Name', type: 'text' },
    { name: 'kpiDataType', label: 'Data Type:', type: 'select' },
    { name: 'kpiDefaultValue', label: 'Default Value', type: 'text' },
    { name: 'kpiDbOffset', label: 'DB Offset', type: 'text' },
    { name: 'kpiUnit', label: 'Unit', type: 'text' },
    { name: 'kpiAccessType', label: 'Access Type', type: 'select' },
  ],
  dataTypes: [
    { label: 'String', value: 'string' },
    { label: 'Integer', value: 'integer' },
    { label: 'Float', value: 'float' },
    { label: 'Boolean', value: 'boolean' },
  ],
  accessTypes: [
    { label: 'Read', value: 'R' },
    { label: 'Write', value: 'W' },
  ],
};

export const KPITableConfig = {
  headers: ['ID', 'KPI Name',"Data Type", 'Default Value', 'DB Offset', 'Unit', 'Access'],
  dataKeys: [
    'id',
    'kpi_name',
    'data_type',
    'default_value',
    'db_offset',
    'unit',
    'Access',
    'bit_value', // New field in table
  ],
};
