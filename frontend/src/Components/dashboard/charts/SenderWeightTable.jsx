import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

export function SenderWeightTable({ data }) {
  // Calculate total weight
  const totalWeight = data.reduce((sum, item) => sum + (item.weight || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sender Weight Tracking (Real-time)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Bin ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Product</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Current Weight</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {data.map((item) => (
                <tr key={item.bin_id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-sm font-mono">{item.bin_id}</td>
                  <td className="px-4 py-3 text-sm">{item.product}</td>
                  <td className="px-4 py-3 text-sm">
                    {item.weight?.toFixed(3)} kg
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.status === 'Active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-gray-200 font-medium">
                <td className="px-4 py-3 text-sm">Total Weight</td>
                <td></td>
                <td className="px-4 py-3 text-sm text-blue-500">{totalWeight.toFixed(1)} kg</td>
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











