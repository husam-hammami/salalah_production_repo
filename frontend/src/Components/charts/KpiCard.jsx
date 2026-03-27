





import React from "react";

export default function KpiCard({ title, value, unit, icon }) {
  return (
    <div
      className="rounded-lg p-4 flex items-center space-x-4 bg-white dark:bg-[#1a2332] border border-gray-300 dark:border-gray-600 shadow-sm transition-all duration-300 hover:shadow-md"
    >
      {/* Muted Icon - no glow, industrial style */}
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#475569] to-[#334155] p-[6px]">
          <div className="bg-white dark:bg-[#1a2332] w-full h-full rounded-full flex items-center justify-center text-[#1e40af] dark:text-[#3b82f6] text-xl">
            {icon}
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="flex flex-col">
        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider opacity-75">{title}</div>
        <div className="text-lg font-extrabold text-gray-900 dark:text-white">
          {value} <span className="text-sm font-normal text-gray-600 dark:text-gray-400 opacity-75">{unit}</span>
        </div>
      </div>
    </div>
  );
}








