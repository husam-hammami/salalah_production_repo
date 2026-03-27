function FlashButton({ className, title, iconSize, icon: Icon, action }) {
  return (
    <button
      onClick={action}
      className={`flex items-center justify-center rounded-xl uppercase space-x-2 px-3 2xl:px-4 py-2 font-semibold shadow-md transition duration-300 max-2xl:text-sm 
        bg-gray-300 text-zinc-950 hover:bg-zinc-700 hover:text-white dark:bg-zinc-900 dark:text-white dark:hover:!bg-zinc-50 dark:hover:text-zinc-900 dark:hover:shadow-zinc-400 hover:shadow-zinc-800 ${className}`}
    >
      <Icon className={`${iconSize ? iconSize : 'text-lg'} max-2xl:text-sm`} />
      <span>{title}</span>
    </button>
  );
}

export default FlashButton;
