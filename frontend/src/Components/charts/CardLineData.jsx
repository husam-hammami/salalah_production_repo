





import React from "react";

export default function CardLineData({ label, value, unit, type, color }) {
  const percent = Math.min((value / (type === "Current" ? 20 : 250)) * 100, 100); // 20A or 250V max

  // Color gradients - modern and vibrant
  const gradientMap = {
    red: "bg-gradient-to-r from-[#6DDDD6] via-[#4DD0C9] to-[#3DB8B0]", // Teal for L1
    blue: "bg-gradient-to-r from-[#F5A0A0] via-[#F08080] to-[#E06060]", // Coral/Salmon Pink for L2
    green: "bg-gradient-to-r from-[#FFB833] via-[#FFA500] to-[#E69400]", // Orange/Amber for L3
  };

  const shadowMap = {
    red: "hover:shadow-md",
    blue: "hover:shadow-md",
    green: "hover:shadow-md",
  };

  const gradientClass = gradientMap[color] || "bg-gray-500";
  const glowClass = shadowMap[color] || "hover:shadow-lg";

  return (
    <div
      className={`bg-white dark:bg-[#1a2332] rounded-lg p-4 w-full min-w-0 border border-gray-300 dark:border-gray-600 shadow-sm transform transition-all duration-300 hover:shadow-md ${glowClass}`}
    >
      <div className="text-md font-bold mb-2">{label}</div>

      {/* Modern 3D progress bar */}
      <div className="w-full h-4 bg-gray-300 rounded-full overflow-hidden mb-3 shadow-inner">
        <div
          className={`${gradientClass} h-full rounded-full transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="text-sm font-semibold">
        {type}: <span className="font-normal">{value} {unit}</span>
      </div>
    </div>
  );
}
