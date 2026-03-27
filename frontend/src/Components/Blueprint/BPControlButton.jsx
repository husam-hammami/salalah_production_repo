import { Tooltip } from '@mui/material';

const BPControlButton = ({
  name,
  icon: Icon,
  action,
  className,
  commandName,
}) => {
  return (
    <Tooltip
      title={<span className="2xl:!text-lg ">{name || ''}</span>}
      arrow
      placement="top"
      disableInteractive
    >
      <button
        onClick={() => action(commandName)}
        className={`w-full flex justify-center space-x-1 items-center text-white px-2 py-2 rounded-lg transition duration-200 ease-in-out ${className} active:scale-95 active:bg-opacity-70`}
      >
        <Icon className="text-sm 2xl:text-sm" />
        <span className="text-sm 2xl:text-lg">{name}</span>
      </button>
    </Tooltip>
  );
};

export default BPControlButton;
