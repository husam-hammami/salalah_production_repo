import { Tooltip } from '@mui/material';

function BPActionButton({ icon: Icon, name, action, className, iconSize, id }) {
  return (
    <Tooltip
      title={<span className="2xl:!text-lg ">{name || ''}</span>}
      arrow
      placement="top"
      disableInteractive
    >
      <button
        className={`flex items-center p-1 md:p-2 2xl:p-3 rounded-full shadow-md hover:scale-105 hover:shadow-lg transition-all duration-200 ease-in-out ${className}`}
        onClick={() => action(id)}
      >
        <Icon className={`text-md 2xl:text-lg ${iconSize} `} />
        {/* <span className="text-xs 2xl:text-md">{name}</span> */}
      </button>
    </Tooltip>
  );
}

export default BPActionButton;
