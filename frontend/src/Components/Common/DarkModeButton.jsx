import { useContext } from 'react';
import { MdOutlineDarkMode, MdOutlineLightMode } from 'react-icons/md';
import { DarkModeContext } from '../../Context/DarkModeProvider';

function DarkModeButton() {
  // Dark mode
  const { mode, setMode } = useContext(DarkModeContext);  


  return (
    <div
      onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
      className="2xl:!h-12 2xl:!w-12 h-10 w-10 flex items-center justify-center rounded-full cursor-pointer transition-transform transform hover:scale-110 bg-zinc-400 dark:bg-zinc-700 hover:bg-zinc-500 dark:hover:bg-zinc-500 "
    >
      {mode === 'dark' ? (
        <MdOutlineLightMode
          // size={28}
          className="text-yellow-500 dark:text-white text-2xl 2xl:!text-3xl"
        />
      ) : (
        <MdOutlineDarkMode
          // size={28}
          className="text-zinc-800 dark:text-zinc-200 text-2xl 2xl:!text-3xl"
        />
      )}
    </div>
  );
}

export default DarkModeButton;
