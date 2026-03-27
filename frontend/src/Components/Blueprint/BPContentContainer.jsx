function BPContentContainer({ children, title }) {
  return (
    <div className="blueprint-content-container rounded-lg bg-zinc-300 dark:bg-zinc-900 shadow-md drop-shadow-lg">
      <div className="bp-container-header bg-zinc-400 dark:bg-zinc-800 p-3 rounded-t-lg">
        <h2 className="text-xl text-zinc-900 dark:text-white">{title}</h2>
      </div>
      <div className="bp-container-body flex flex-col justify-center items-center p-3 space-y-3">
        {children}
      </div>
    </div>
  );
}

export default BPContentContainer;
