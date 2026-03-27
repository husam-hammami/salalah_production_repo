// Table headers and data keys for users
export const userTableConfig = {
  headers: ['ID', 'Username', 'Role'],
  dataKeys: ['id', 'username', 'role'],
};

// Configuration for adding user
export const addUserFormConfig = {
  title: 'User Management',
  tooltip: 'Add User',
  newFields: [
    { name: 'username', label: 'Username' },
    { name: 'password', label: 'Password', type: 'password' },
  ],
};
