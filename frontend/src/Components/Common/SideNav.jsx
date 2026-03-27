// import { styled, useTheme } from '@mui/material/styles';
// import MuiDrawer from '@mui/material/Drawer';
// import List from '@mui/material/List';
// import Divider from '@mui/material/Divider';
// import ListItem from '@mui/material/ListItem';
// import ListItemButton from '@mui/material/ListItemButton';
// import { Box, Tooltip } from '@mui/material';
// import { menuItems /*, bluePrint, feederBlueprint */ } from '../../Data/Navbar';
// import { NavbarContext } from '../../Context/NavbarContext';
// import { useContext } from 'react';
// import { NavLink } from 'react-router-dom';
// import { AuthContext } from '../../Context/AuthProvider';

// const drawerWidth = 240;

// const openedMixin = theme => ({
//   width: drawerWidth,
//   transition: theme.transitions.create('width', {
//     easing: theme.transitions.easing.sharp,
//     duration: theme.transitions.duration.enteringScreen,
//   }),
//   overflowX: 'hidden',
// });

// const closedMixin = theme => ({
//   transition: theme.transitions.create('width', {
//     easing: theme.transitions.easing.sharp,
//     duration: theme.transitions.duration.leavingScreen,
//   }),
//   overflowX: 'hidden',
//   width: `calc(${theme.spacing(7)} + 1px)`,
//   [theme.breakpoints.up('sm')]: {
//     width: `calc(${theme.spacing(8)} + 1px)`,
//   },
// });

// const DrawerHeader = styled('div')(({ theme }) => ({
//   display: 'flex',
//   alignItems: 'center',
//   justifyContent: 'flex-end',
//   padding: theme.spacing(0, 1),
//   ...theme.mixins.toolbar,
// }));

// const Drawer = styled(MuiDrawer, {
//   shouldForwardProp: prop => prop !== 'open',
// })(({ theme, open }) => ({
//   width: drawerWidth,
//   flexShrink: 0,
//   whiteSpace: 'nowrap',
//   boxSizing: 'border-box',
//   ...(open && {
//     ...openedMixin(theme),
//     '& .MuiDrawer-paper': openedMixin(theme),
//   }),
//   ...(!open && {
//     ...closedMixin(theme),
//     '& .MuiDrawer-paper': closedMixin(theme),
//   }),
// }));

// export default function SideNav() {
//   const { open } = useContext(NavbarContext);
//   const { auth } = useContext(AuthContext);

//   return (
//     <Box sx={{ display: 'flex' }}>
//       <Drawer
//         variant="permanent"
//         open={open}
//         PaperProps={{
//           className:
//             'dark:!bg-zinc-800 dark:!text-zinc-300 !bg-zinc-300 2xl:!pt-10 pt-7',
//         }}
//       >
//         <DrawerHeader />

//         {/* --- Standard Menu Items --- */}
//         <List>
//           {menuItems.map(
//             (item) =>
//               item.roles.includes(auth.role) && (
//                 <ListItem key={item.name} disablePadding sx={{ display: 'block' }}>
//                   <NavLink
//                     to={item.link}
//                     className={({ isActive }) =>
//                       `inline-block w-full transition-all duration-300 ease-in-out ${
//                         isActive
//                           ? 'bg-zinc-600 dark:bg-zinc-200 text-zinc-100 dark:text-zinc-800 hover:!bg-zinc-500 dark:hover:!bg-zinc-400'
//                           : 'dark:hover:!bg-zinc-700 hover:!bg-zinc-400'
//                       }`
//                     }
//                   >
//                     <Tooltip
//                       title={<span className="2xl:!text-lg">{item.tooltip}</span>}
//                       placement="top"
//                       arrow
//                       disableInteractive
//                       slotProps={{
//                         popper: { className: `${open ? 'hidden' : ''}` },
//                       }}
//                     >
//                       <ListItemButton
//                         sx={[
//                           { minHeight: 48, px: 2.5 },
//                           open
//                             ? { justifyContent: 'initial' }
//                             : { justifyContent: 'center' },
//                         ]}
//                         className="last:2xl:!mb-1 !py-6 2xl:!py-7"
//                       >
//                         <div
//                           className={`flex justify-center items-center ${
//                             open ? 'mr-3' : 'mr-auto'
//                           }`}
//                         >
//                           <item.icon className="text-xl md:text-2xl 2xl:!text-3xl" />
//                         </div>
//                         <span
//                           className={`text-xl 2xl:!text-2xl ml-3 ${
//                             open ? 'inline' : 'hidden'
//                           }`}
//                         >
//                           {item.name}
//                         </span>
//                       </ListItemButton>
//                     </Tooltip>
//                   </NavLink>
//                 </ListItem>
//               )
//           )}
//         </List>

//         <Divider className="dark:!bg-zinc-600" />

//         {/* --- Blueprint Order Menu --- */}
//         {/* Commented out for future use
//         <Tooltip
//           title={<span className="2xl:!text-lg">{bluePrint.tooltip}</span>}
//           placement="right"
//         >
//           <ListItemButton
//             component={NavLink}
//             to={bluePrint.link}
//             className={`!rounded-lg !mb-2 !p-2 !min-h-0 ${
//               open ? '!justify-start' : '!justify-center'
//             }`}
//             sx={{
//               '&.active': {
//                 backgroundColor: 'primary.main',
//                 color: 'white',
//                 '&:hover': {
//                   backgroundColor: 'primary.dark',
//                 },
//               },
//             }}
//           >
//             <Box
//               className={`flex items-center ${
//                 open ? 'w-full' : 'w-auto'
//               }`}
//             >
//               <bluePrint.icon className="text-xl md:text-2xl 2xl:!text-3xl" />
//               {open && (
//                 <span className="ml-3 text-sm md:text-base 2xl:!text-lg">
//                   {bluePrint.name}
//                 </span>
//               )}
//             </Box>
//           </ListItemButton>
//         </Tooltip>

//         <Tooltip
//           title={<span className="2xl:!text-lg">{feederBlueprint.tooltip}</span>}
//           placement="right"
//         >
//           <ListItemButton
//             component={NavLink}
//             to={feederBlueprint.link}
//             className={`!rounded-lg !mb-2 !p-2 !min-h-0 ${
//               open ? '!justify-start' : '!justify-center'
//             }`}
//             sx={{
//               '&.active': {
//                 backgroundColor: 'primary.main',
//                 color: 'white',
//                 '&:hover': {
//                   backgroundColor: 'primary.dark',
//                 },
//               },
//             }}
//           >
//             <Box
//               className={`flex items-center ${
//                 open ? 'w-full' : 'w-auto'
//               }`}
//             >
//               <feederBlueprint.icon className="text-xl md:text-2xl 2xl:!text-3xl" />
//               {open && (
//                 <span className="ml-3 text-sm md:text-base 2xl:!text-lg">
//                   {feederBlueprint.name}
//                 </span>
//               )}
//             </Box>
//           </ListItemButton>
//         </Tooltip>
//         */}
//       </Drawer>
//     </Box>
//   );
// }














import { styled, useTheme } from '@mui/material/styles';
import MuiDrawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import Divider from '@mui/material/Divider';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import { Box, Tooltip } from '@mui/material';
import { menuItems } from '../../Data/Navbar';
import { NavbarContext } from '../../Context/NavbarContext';
import { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AuthContext } from '../../Context/AuthProvider';

const drawerWidth = 260;

const openedMixin = theme => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = theme => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: prop => prop !== 'open',
})(({ theme, open }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open && {
    ...openedMixin(theme),
    '& .MuiDrawer-paper': openedMixin(theme),
  }),
  ...(!open && {
    ...closedMixin(theme),
    '& .MuiDrawer-paper': closedMixin(theme),
  }),
}));

export default function SideNav() {
  const { open } = useContext(NavbarContext);
  const { auth } = useContext(AuthContext);

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="permanent"
        open={open}
        PaperProps={{
          className:
            '2xl:!pt-10 pt-7 !bg-zinc-300 text-black dark:!bg-gradient-to-b dark:from-[#0B1F3A] dark:to-[#1F3D63] dark:text-white',
        }}
      >
        <DrawerHeader />

        <List>
          {menuItems.map(
            (item) =>
              item.roles.includes(auth.role) && (
                <ListItem key={item.name} disablePadding sx={{ display: 'block' }}>
                  <NavLink
                    to={item.link}
                    className={({ isActive }) =>
                      `inline-block w-full transition-all duration-300 ease-in-out ${
                        isActive
  ? 'bg-zinc-700 text-white dark:bg-cyan-500 dark:text-black hover:!bg-zinc-600 dark:hover:!bg-cyan-400'
  : 'hover:!bg-zinc-400 dark:hover:!bg-[#264166] text-black dark:text-white'

                      }`
                    }
                  >
                    <Tooltip
                      title={<span className="2xl:!text-lg">{item.tooltip}</span>}
                      placement="top"
                      arrow
                      disableInteractive
                      slotProps={{
                        popper: { className: `${open ? 'hidden' : ''}` },
                      }}
                    >
                      <ListItemButton
                        sx={[
                          { minHeight: 48, px: 2.5 },
                          open
                            ? { justifyContent: 'initial', overflow: 'visible' }
                            : { justifyContent: 'center' },
                        ]}
                        className="last:2xl:!mb-1 !py-6 2xl:!py-7"
                      >
                        <div
                          className={`flex justify-center items-center ${
                            open ? 'mr-3' : 'mr-auto'
                          }`}
                        >
                          <item.icon className="text-xl md:text-2xl 2xl:!text-3xl dark:text-white" />
                        </div>
                        <span
                          className={`text-xl 2xl:!text-2xl ml-3 whitespace-nowrap overflow-visible ${
                            open ? 'inline' : 'hidden'
                          }`}
                        >
                          {item.name}
                        </span>
                      </ListItemButton>
                    </Tooltip>
                  </NavLink>
                </ListItem>
              )
          )}
        </List>

        <Divider className="dark:!bg-zinc-600" />
      </Drawer>
    </Box>
  );
}
