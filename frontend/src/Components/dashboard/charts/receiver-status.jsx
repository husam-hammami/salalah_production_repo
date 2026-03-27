// import PropTypes from 'prop-types';

// export function ReceiverStatus({ binId, product, location, weight }) {
//   return (
//     <div className="space-y-6">
//       <div className="flex justify-between items-center">
//         <div>
//           <p className="text-sm text-gray-600">Bin ID</p>
//           <p className="text-lg font-medium text-gray-900">{binId}</p>
//         </div>
//         <div>
//           <p className="text-4xl font-bold text-[#4B92FF] text-right">{weight.toFixed(1)}</p>
//           <p className="text-sm text-gray-600 text-right">kg</p>
//         </div>
//       </div>

//       <div className="grid grid-cols-2 gap-6">
//         <div>
//           <p className="text-sm text-gray-600">Product</p>
//           <p className="text-lg font-medium text-gray-900">{product}</p>
//         </div>
//         <div>
//           <p className="text-sm text-gray-600">Location</p>
//           <p className="text-lg font-medium text-gray-900">{location}</p>
//         </div>
//       </div>
//     </div>
//   );
// }

// ReceiverStatus.propTypes = {
//   binId: PropTypes.string.isRequired,
//   product: PropTypes.string.isRequired,
//   location: PropTypes.string.isRequired,
//   weight: PropTypes.number.isRequired,
// };




import PropTypes from 'prop-types';

export function ReceiverStatus({ binId, product, location, weight }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300">Bin ID</p>
          <p className="text-lg font-medium text-gray-900 dark:text-white">{binId}</p>
        </div>
        <div>
          <p className="text-4xl font-bold text-[#4B92FF] dark:text-cyan-400 text-right">{weight.toFixed(1)}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300 text-right">kg</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300">Product</p>
          <p className="text-lg font-medium text-gray-900 dark:text-white">{product}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300">Location</p>
          <p className="text-lg font-medium text-gray-900 dark:text-white">{location}</p>
        </div>
      </div>
    </div>
  );
}

ReceiverStatus.propTypes = {
  binId: PropTypes.string.isRequired,
  product: PropTypes.string.isRequired,
  location: PropTypes.string.isRequired,
  weight: PropTypes.number.isRequired,
};
