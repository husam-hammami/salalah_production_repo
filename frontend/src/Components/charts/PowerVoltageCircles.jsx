import React from 'react';
import { motion } from 'framer-motion';
import { FaBolt } from 'react-icons/fa';

const gradientClasses = [
  'bg-gradient-to-t from-[#3DB8B0] via-[#4DD0C9] to-[#6DDDD6]', // Teal for L1
  'bg-gradient-to-t from-[#E06060] via-[#F08080] to-[#F5A0A0]', // Coral/Salmon Pink for L2
  'bg-gradient-to-t from-[#E69400] via-[#FFA500] to-[#FFB833]'  // Orange/Amber for L3
];

const LiquidCircle = ({ label, percentage, gradient }) => {
  return (
    <div className="flex flex-col items-center m-4">
      <div className="text-gray-800 text-sm mb-1 font-medium">
        {label}: {Math.round(percentage)}%
      </div>
      <div className="group relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-2 border-yellow-400 overflow-hidden transition duration-300 group-hover:shadow-[0_0_15px_5px_rgba(255,255,0,0.7)]">
          <motion.div
            className={`absolute bottom-0 left-0 w-full ${gradient}`}
            style={{ height: `${percentage}%`, opacity: 0.7 }}
            animate={{ y: [5, -5, 5] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-0 flex items-center justify-center text-yellow-400 text-3xl"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <FaBolt />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const PowerVoltageCircles = ({ currentData = [], voltageData = [] }) => {
  return (
    <div className="group flex justify-center border border-gray-500 items-center bg-[#f5f5f5] mt-4 text-gray-800 rounded-xl shadow-md p-4 overflow-x-auto transition duration-300 hover:shadow-[0_0_20px_rgba(0,0,128,0.8)]">
      <div className="flex gap-10">
        {currentData.map((value, index) => (
          <LiquidCircle
            key={`current-${index}`}
            label={`Current ${index + 1}`}
            percentage={value}
            gradient={gradientClasses[index % gradientClasses.length]}
          />
        ))}
        {voltageData.map((value, index) => (
          <LiquidCircle
            key={`voltage-${index}`}
            label={`Voltage ${index + 1}`}
            percentage={value}
            gradient={gradientClasses[(index + 1) % gradientClasses.length]}
          />
        ))}
      </div>
    </div>
  );
};

export default PowerVoltageCircles;
