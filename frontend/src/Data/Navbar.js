// import {
//   FaWarehouse,
//   FaBarcode,
//   FaBriefcase,
//   FaMicrochip,
//   FaUsers,
// } from 'react-icons/fa';
// import { FaGears } from 'react-icons/fa6';
// import { Roles } from './Roles';

// export const menuItems = [
//   {
//     name: 'Material',
//     icon: FaWarehouse,
//     tooltip: 'Material Management',
//     link: '/materials',
//     roles: [Roles.Admin, Roles.Manager, Roles.Operator],
//   },
//   {
//     name: 'Bin',
//     icon: FaBarcode,
//     tooltip: 'Bin Assignment',
//     link: '/bin',
//     roles: [Roles.Admin, Roles.Manager, Roles.Operator],
//   },
//   {
//     name: 'Job Type',
//     icon: FaBriefcase,
//     tooltip: 'Job Type Management',
//     link: '/job-type',
//     roles: [Roles.Admin],
//   },
//   {
//     name: 'Recipe',
//     icon: FaMicrochip,
//     tooltip: 'Recipe Management',
//     link: '/recipe',
//     roles: [Roles.Admin, Roles.Manager, Roles.Operator],
//   },
//   {
//     name: 'User',
//     icon: FaUsers,
//     tooltip: 'User Management',
//     link: '/user',
//     roles: [Roles.Admin, Roles.Manager],
//   },
// ];

// export const bluePrint = {
//   name: 'Orders',
//   icon: FaGears,
//   tooltip: 'Orders Page',
//   link: '/orders',
//   roles: [Roles.Admin, Roles.Manager, Roles.Operator],
// };





import {
  FaWarehouse,
  FaBarcode,
  FaBriefcase,
  FaMicrochip,
  FaUsers,
  FaBolt,
  FaCogs,
  FaSlidersH,
  FaTable,
  FaFileAlt,
  FaClipboardList,
  FaEye,
  FaChartBar
} from 'react-icons/fa';
import { Roles } from './Roles';
import { GiFactory } from 'react-icons/gi';

export const menuItems = [
  {
    name: 'Dashboard',
    icon: FaCogs,
    tooltip: 'Dashboard Overview',
    link: '/dashboard',
    roles: [Roles.Admin, Roles.Manager, Roles.Operator],
  },
  {
    name: 'Material',
    icon: FaWarehouse,
    tooltip: 'Material Management',
    link: '/materials',
    roles: [Roles.Admin, Roles.Manager, Roles.Operator],
  },
  {
    name: 'Bin',
    icon: FaBarcode,
    tooltip: 'Bin Assignment',
    link: '/bin',
    roles: [Roles.Admin, Roles.Manager, Roles.Operator],
  },
  // {
  //   name: 'Job Type',
  //   icon: FaBriefcase,
  //   tooltip: 'Job Type Management',
  //   link: '/job-type',
  //   roles: [Roles.Admin],
  // },
  // {
  //   name: 'Recipe',
  //   icon: FaMicrochip,
  //   tooltip: 'Recipe Management',
  //   link: '/recipe',
  //   roles: [Roles.Admin, Roles.Manager, Roles.Operator],
  // },
  // {
  //   name: 'Milling Recipe',
  //   icon: GiFactory,
  //   tooltip: 'Feeder Recipes',
  //   link: '/feeder-recipes',
  //   roles: [Roles.Admin, Roles.Manager],
  // },
  {
    name: 'User',
    icon: FaUsers,
    tooltip: 'User Management',
    link: '/user',
    roles: [Roles.Admin, Roles.Manager],
  },
  {
    name: 'Energy',
    icon: FaBolt,
    tooltip: 'Energy Monitoring',
    link: '/energy',
    roles: [Roles.Admin, Roles.Manager, Roles.Operator],
  },
  {
    name: 'Energy Report',
    icon: FaFileAlt,
    tooltip: 'Historical Energy Report',
    link: '/energy-report',
    roles: [Roles.Admin, Roles.Manager, Roles.Operator],
  },
  {
    name: 'Report',
    icon: FaClipboardList,
    tooltip: 'Report Page',
    link: '/new-report',
    roles: [Roles.Admin, Roles.Manager, Roles.Operator],
  },
  {
    name: 'Live monitoring',
    icon: FaEye,
    tooltip: 'Order Reports',
    link: '/report',
    roles: [Roles.Admin, Roles.Manager, Roles.Operator],
  },
  {
    name: 'Orders Analytics',
    icon: FaChartBar,
    tooltip: 'Orders Analytics',
    link: '/orders-analytics',
    roles: [Roles.Admin, Roles.Manager, Roles.Operator],
  },
  {
    name: 'Job logs',
    icon: FaClipboardList,
    tooltip: 'Job Logs',
    link: '/job-logs',
    roles: [Roles.Admin, Roles.Manager, Roles.Operator],
  }
];

// export const bluePrint = {
//   name: 'Orders',
//   icon: FaCogs,  // ✅ fixed
//   tooltip: 'Orders Page',
//   link: '/orders',
//   roles: [Roles.Admin, Roles.Manager, Roles.Operator],
// };

// export const feederBlueprint = {
//   name: 'Milling Orders',
//   icon: FaSlidersH,
//   tooltip: 'Feeder Order Management',
//   link: '/feeder-orders',
//   roles: [Roles.Admin, Roles.Manager, Roles.Operator],
// };

