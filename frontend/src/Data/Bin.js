// Table headers and data keys for bins
export const binTableConfig = {
  headers: ['ID', 'Bin Name', 'Bin Code', 'Material Name', 'Material Code'],
  dataKeys: ['id', 'bin_name', 'bin_code', 'material_name', 'material_code'],
};

// Configuration for adding bin
export const assignBinFormConfig = {
  title: 'Bin Assignment',
  newFields: [
    { name: 'binId', label: 'Bin Name'},
    { name: 'materialId', label: 'Material'},
  ], // Fields required for creating a new bin
  tooltip:"Assign Material to Bin"
};
