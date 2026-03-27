// Table headers and data keys for materials
export const materialTableConfig = {
  headers: ['ID', 'Material Name', 'Material Code', 'Category', 'Released'],
  dataKeys: ['id', 'material_name', 'material_code', 'category', 'is_released'],
};

// Configuration for adding material
export const addMaterialFormConfig = {
  title: 'Add Material',
  newFields: [
    { name: 'materialName', label: 'Name' },
    { name: 'materialCode', label: 'Code' },
  ],
};

// Category and release configuration for the form
export const materialCategoryConfig = {
  categoryTitle: 'Category:',
  options: [
    {
      label: 'Raw Material (IN)',
      field: 'categoryIN',
    },
    {
      label: 'Final Product (OUT)',
      field: 'categoryOUT',
    },
  ],
  release: {
    label: 'Release',
    field: 'isReleased',
  },
};
