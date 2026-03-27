export const FlexContainer = ({ children }) => (
  <div className="flex flex-wrap justify-evenly items-start gap-x-4 gap-y-1">
    {children}
  </div>
  // <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-4">{children}</div>
);

export const FlexItem = ({ children, borderColor }) => {
  return (
    <div
      className={`flex-grow bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-4 py-1 rounded-lg shadow-md border max-w-36 2xl:max-w-40 ${borderColor}`}
    >
      {children}
    </div>
  );
};
