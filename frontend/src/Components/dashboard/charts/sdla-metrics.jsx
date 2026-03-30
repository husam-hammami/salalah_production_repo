import PropTypes from 'prop-types';
import { Card, CardContent } from '../../../Components/ui/card';
import { Thermometer, Gauge, BarChart3, Percent } from 'lucide-react';

export function SDLAMetrics({ className = '' }) {
  // These would come from real API endpoints in production
  const metrics = {
    processingRate: 89.5,
    temperature: 85.2,
    pressure: 2.4,
    efficiency: 94.7
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      <Card className="bg-white border-l-4 border-primary">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Processing Rate</p>
              <p className="text-3xl font-bold text-primary">{metrics.processingRate}</p>
              <p className="text-xs text-gray-500 mt-1">kg/min</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10">
              <BarChart3 className="text-2xl text-primary" size={20} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-l-4 border-primary">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Temperature</p>
              <p className="text-3xl font-bold text-primary">{metrics.temperature}</p>
              <p className="text-xs text-gray-500 mt-1">°C</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10">
              <Thermometer className="text-2xl text-primary" size={20} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-l-4 border-primary">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pressure</p>
              <p className="text-3xl font-bold text-primary">{metrics.pressure}</p>
              <p className="text-xs text-gray-500 mt-1">bar</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10">
              <Gauge className="text-2xl text-primary" size={20} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-l-4 border-primary">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Efficiency</p>
              <p className="text-3xl font-bold text-primary">{metrics.efficiency}</p>
              <p className="text-xs text-gray-500 mt-1">%</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10">
              <Percent className="text-2xl text-primary" size={20} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

SDLAMetrics.propTypes = {
  className: PropTypes.string,
};