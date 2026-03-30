// import PropTypes from 'prop-types';
// import { Card, CardContent, CardHeader, CardTitle } from '../../../Components/ui/card';

// export function SenderWeightTable({ data }) {
//   // Calculate total weight
//   const totalWeight = data.reduce((sum, item) => sum + (item.weight || 0), 0);

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>Sender Weight Tracking (Real-time)</CardTitle>
//       </CardHeader>
//       <CardContent>
//         <div className="overflow-x-auto">
//           <table className="w-full">
//             <thead>
//               <tr className="bg-gray-50">
//                 <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Bin ID</th>
//                 <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Product</th>
//                 <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Current Weight</th>
//                 <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
//               </tr>
//             </thead>
//             <tbody className="bg-white">
//               {data.map((item) => (
//                 <tr key={item.bin_id} className="border-t border-gray-100">
//                   <td className="px-4 py-3 text-sm font-mono">{item.bin_id}</td>
//                   <td className="px-4 py-3 text-sm">{item.product}</td>
//                   <td className="px-4 py-3 text-sm">
//                     {item.weight?.toFixed(3)} kg
//                   </td>
//                   <td className="px-4 py-3">
//                     <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
//                       item.status === 'Active' 
//                         ? 'bg-green-100 text-green-800' 
//                         : 'bg-yellow-100 text-yellow-800'
//                     }`}>
//                       {item.status}
//                     </span>
//                   </td>
//                 </tr>
//               ))}
//               <tr className="border-t border-gray-200 font-medium">
//                 <td className="px-4 py-3 text-sm">Total Weight</td>
//                 <td></td>
//                 <td className="px-4 py-3 text-sm text-blue-500">{totalWeight.toFixed(1)} kg</td>
//                 <td></td>
//               </tr>
//             </tbody>
//           </table>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }

// SenderWeightTable.propTypes = {
//   data: PropTypes.arrayOf(
//     PropTypes.shape({
//       bin_id: PropTypes.string.isRequired,
//       product: PropTypes.string.isRequired,
//       weight: PropTypes.number,
//       status: PropTypes.string.isRequired
//     })
//   ).isRequired,
// };








import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../Components/ui/card';

export function SenderWeightTable({ data }) {
  const totalWeight = data.reduce((sum, item) => sum + (item.weight || 0), 0);

  return (
    <Card className="bg-white dark:bg-[#121e2c] border border-gray-300 dark:border-cyan-900 rounded-lg shadow-md">
      <CardHeader>
        <CardTitle className="text-black dark:text-white">Sender Weight Tracking (Real-time)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-sm">
              <tr className="bg-gray-100 text-gray-700 dark:bg-[#1e2b3f] dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-medium">Bin ID</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Current Weight</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm bg-white dark:bg-[#1e2736]">
              {data.map((item) => (
                <tr key={item.bin_id} className="border-t border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
                  <td className="px-4 py-3 font-mono">{item.bin_id}</td>
                  <td className="px-4 py-3">{item.product}</td>
                  <td className="px-4 py-3">{item.weight?.toFixed(3)} kg</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.status === 'Active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-600/30 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-600/30 dark:text-yellow-300'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-gray-300 dark:border-gray-600 font-medium text-gray-800 dark:text-white bg-white dark:bg-[#1e2736]">
                <td className="px-4 py-3">Total Weight</td>
                <td></td>
                <td className="px-4 py-3 text-blue-600 dark:text-cyan-400">
                  {totalWeight.toFixed(1)} kg
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

SenderWeightTable.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      bin_id: PropTypes.string.isRequired,
      product: PropTypes.string.isRequired,
      weight: PropTypes.number,
      status: PropTypes.string.isRequired
    })
  ).isRequired,
};
