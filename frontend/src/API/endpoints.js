const blueprint_url_prefix = 'orders';


const endpoints = {
  auth: {
    login: '/login',
    logout: '/logout',
    checkAuth: '/check-auth'
  },
  users: {
    list: '/users',
    create: '/add-user',
    delete: id => `/delete-user/${id}`,
  },
  materials: {
    list: '/materials',
    create: '/add-material',
    details: id => `/material/${id}`,
    update: '/update-material',
    delete: id => `/delete-material/${id}`,
  },
  bins: {
    list: '/bins',
    assign: '/assign-bin',
    unassign: id => `/unassign-bin/${id}`,
  },
  jobTypes: {
    list: '/job-types',
    create: '/add-job-type',
  },
  kpis: {
    list: id => `/kpis/${id}`,
    create: '/add-kpi-definition',
    delete: id => `/delete-kpi/${id}`,
    details: id => `/get-kpi/${id}`,
    update: '/update-kpi',
  },
  recipes: {
    list: id => `/job-fields/${id}`,
    create: '/add-recipe',
    details: id => `/load-recipe/${id}`,
    update: `/update-recipe`,
    delete: id => `/delete-recipe/${id}`,
  },
 feederRecipes: {
  list: id => `/feeder-recipes/${id}`,
  create: `/feeder-recipes/create`,
  update: `/feeder-recipes/update`,
  details: id => `/feeder-recipes/details/${id}`,
  delete: id => `/delete-recipe/${id}`,
},
 feederOrders: {
  list: '/orders/feeder-orders',
  create: `/orders/feeder-orders/create`,
  details: id => `/orders/feeder-orders/details/${id}`,
  release: id => `/orders/feeder-orders/release/${id}`,
},
  orders: {
    list: '/orders/get-orders',
    details: id => `/orders/get-active-order?job_type_id=${id}`,
    release: id => `/orders/release-order/${id}`,
    duplicate: id => `/orders/duplicate-order/${id}`,
    delete: id => `/orders/delete-order/${id}`,
    submit: `/orders/submit-order`,
  },
  controlPanel: {
    send: `/${blueprint_url_prefix}/send-command`,
  },
};

export default endpoints;
