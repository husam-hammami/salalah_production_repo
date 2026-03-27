// import { useContext, useState } from 'react';
// import { IoIosClose, IoIosMenu } from 'react-icons/io';
// import AppBar from '@mui/material/AppBar';
// import Toolbar from '@mui/material/Toolbar';
// import Typography from '@mui/material/Typography';
// import IconButton from '@mui/material/IconButton';
// import Avatar from '@mui/material/Avatar';
// import MenuItem from '@mui/material/MenuItem';
// import Menu from '@mui/material/Menu';
// import DarkModeButton from '../Common/DarkModeButton';
// import HercLogo from '../../Assets/Herc_Logo_v2.0';
// import Asm_Logo from '../../Assets/Asm_Logo.png';
// import { NavbarContext } from '../../Context/NavbarContext';
// import { AuthContext } from '../../Context/AuthProvider';

// function Navbar({ isBlueprint = false }) {
//   const contextValue = useContext(NavbarContext);
//   const { open, setOpen } = contextValue || {};

//   const { auth, logout } = useContext(AuthContext);
//   const [anchorEl, setAnchorEl] = useState(null);

//   const handleMenu = event => {
//     setAnchorEl(event.currentTarget);
//   };

//   const handleClose = () => {
//     setAnchorEl(null);
//   };

//   const handleLogout = () => {
//     handleClose();
//     logout();
//   };

//   return (
//     <AppBar
//       position="fixed"
//       sx={{ zIndex: theme => theme.zIndex.drawer + 1 }}
//       className="dark:!bg-zinc-800 !bg-zinc-300 !text-slate-900 dark:!text-slate-50"
//     >
//       <Toolbar className="p-2 flex justify-between items-center">
//         <div className="nav-logo flex items-center">
//           {!isBlueprint && auth && (
//             <IconButton
//               size="large"
//               edge="start"
//               color="inherit"
//               aria-label="menu"
//               sx={{ mr: 2 }}
//               onClick={() => setOpen(open => !open)}
//               className="2xl:!mr-2"
//             >
//               {open ? (
//                 <IoIosClose className="text-xl md:text-2xl 2xl:!text-5xl transition-transform duration-300 transform rotate-180" />
//               ) : (
//                 <IoIosMenu className="text-xl md:text-2xl 2xl:!text-5xl transition-transform duration-300 transform rotate-0" />
//               )}
//             </IconButton>
//           )}
//           <Typography
//             variant="h6"
//             component="div"
//             sx={{ flexGrow: 1 }}
//             className="text-lg md:text-2xl 2xl:!text-4xl !font-semibold"
//           >
//             <HercLogo className="w-40 h-14 2xl:!w-56 2xl:!h-20 2xl:!ms-5 ms-2 " />
//           </Typography>
//         </div>
//         {/* <Asm_Logo className="w-56 h-20 ms-5" /> */}

//         <div className="actions-container mx-5 flex-1 flex items-center justify-between">
//           <DarkModeButton />

//           {auth && (
//             <div className="flex items-center">
//               <Typography className="2xl:!text-xl p-2">
//                 Hello, <span className='font-semibold capitalize'>{auth.username}</span>
//               </Typography>
//               <div>
//                 <IconButton
//                   size="large"
//                   aria-label="account of current user"
//                   aria-controls="menu-appbar"
//                   aria-haspopup="true"
//                   onClick={handleMenu}
//                   color="inherit"
//                 >
//                   <Avatar
//                     alt={auth.username}
//                     className="2xl:!h-16 2xl:!w-16 2xl:!text-4xl !w-12 !h-12 !text-2xl "
//                   >
//                     {auth?.username?.charAt(0)}
//                   </Avatar>
//                 </IconButton>
//                 <Menu
//                   id="menu-appbar"
//                   anchorEl={anchorEl}
//                   anchorOrigin={{
//                     vertical: 'bottom',
//                     horizontal: 'left',
//                   }}
//                   keepMounted
//                   transformOrigin={{
//                     vertical: 'top',
//                     horizontal: 'left',
//                   }}
//                   open={Boolean(anchorEl)}
//                   onClose={handleClose}
//                   slotProps={{
//                     paper: {
//                       className:
//                         'dark:!bg-zinc-700 dark:!text-zinc-300 !bg-zinc-300 ',
//                     },
//                   }}
//                   // sx={{ display: { xs: 'block', md: 'none' } }}
//                 >
//                   <MenuItem className="2xl:!text-xl" onClick={handleLogout}>
//                     <button>Logout</button>
//                   </MenuItem>
//                   {/* <MenuItem className="2xl:!text-xl" onClick={handleClose}>
//                   Settings
//                 </MenuItem> */}
//                 </Menu>
//               </div>
//             </div>
//           )}
//         </div>

//         <img
//           className="w-40 h-16 2xl:!w-52 2xl:!h-20 ms-5"
//           src={Asm_Logo}
//           alt="ASM-Process Automation Logo"
//         />
//       </Toolbar>
//     </AppBar>
//   );
// }

// export default Navbar;













import { useContext, useState } from 'react';
import { IoIosClose, IoIosMenu } from 'react-icons/io';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import DarkModeButton from '../Common/DarkModeButton';
import HercLogo from '../../Assets/Herc_Logo_v2.0';
import Asm_Logo from '../../Assets/Asm_Logo.png';
import Salalah_Logo from '../../Assets/salalah_logo.png';
import { NavbarContext } from '../../Context/NavbarContext';
import { AuthContext } from '../../Context/AuthProvider';

function Navbar({ isBlueprint = false }) {
  const contextValue = useContext(NavbarContext);
  const { open, setOpen } = contextValue || {};
  const { auth, logout } = useContext(AuthContext);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    logout();
  };

  return (
    <AppBar
      position="fixed"
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      className="!bg-zinc-300 dark:!bg-gradient-to-r dark:from-[#0B1F3A] dark:to-[#1F3D63] !text-slate-900 dark:!text-white"
    >
      <Toolbar className="p-2 flex justify-between items-center">
        <div className="nav-logo flex items-center">
          {!isBlueprint && auth && (
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="menu"
              sx={{ mr: 2 }}
              onClick={() => setOpen((prev) => !prev)}
              className="2xl:!mr-2"
            >
              {open ? (
                <IoIosClose className="text-xl md:text-2xl 2xl:!text-5xl transition-transform duration-300 transform rotate-180" />
              ) : (
                <IoIosMenu className="text-xl md:text-2xl 2xl:!text-5xl transition-transform duration-300 transform rotate-0" />
              )}
            </IconButton>
          )}
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1 }}
            className="text-lg md:text-2xl 2xl:!text-4xl !font-semibold"
          >
            <HercLogo className="w-40 h-14 2xl:!w-56 2xl:!h-20 2xl:!ms-5 ms-2" />
          </Typography>
        </div>

        <div className="actions-container mx-5 flex-1 flex items-center justify-between">
          <DarkModeButton />
          {auth && (
            <div className="flex items-center">
              <Typography className="2xl:!text-xl p-2">
                Hello, <span className="font-semibold capitalize">{auth.username}</span>
              </Typography>
              <div>
                <IconButton
                  size="large"
                  aria-label="account of current user"
                  aria-controls="menu-appbar"
                  aria-haspopup="true"
                  onClick={handleMenu}
                  color="inherit"
                >
                  <Avatar
                    alt={auth.username}
                    className="2xl:!h-16 2xl:!w-16 2xl:!text-4xl !w-12 !h-12 !text-2xl"
                  >
                    {auth?.username?.charAt(0)}
                  </Avatar>
                </IconButton>
                <Menu
                  id="menu-appbar"
                  anchorEl={anchorEl}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                  }}
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                  slotProps={{
                    paper: {
                      className:
                        'dark:!bg-zinc-700 dark:!text-zinc-300 !bg-zinc-300',
                    },
                  }}
                >
                  <MenuItem className="2xl:!text-xl" onClick={handleLogout}>
                    <button>Logout</button>
                  </MenuItem>
                </Menu>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <img
            className="h-12 2xl:h-16 w-auto object-contain"
            src={Asm_Logo}
            alt="ASM-Process Automation Logo"
          />
          <img
            className="h-14 2xl:h-20 w-auto object-contain"
            src={Salalah_Logo}
            alt="Salalah Logo"
          />
        </div>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
