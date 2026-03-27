








import React from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";
import { motion } from "framer-motion";

ChartJS.register(ArcElement, Tooltip);

export default function CircularChart({ title, value, total, label, color = "#00f6ff" }) {
  const percentage = (value / total) * 100;

  const getGradient = (ctx, color) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 160);
    if (color === "#4DD0C9") {
      // Teal for L1
      gradient.addColorStop(0, "#6DDDD6");
      gradient.addColorStop(0.5, "#4DD0C9");
      gradient.addColorStop(1, "#3DB8B0");
    } else if (color === "#F08080") {
      // Coral/Salmon Pink for L2
      gradient.addColorStop(0, "#F5A0A0");
      gradient.addColorStop(0.5, "#F08080");
      gradient.addColorStop(1, "#E06060");
    } else if (color === "#FFA500") {
      // Orange/Amber for L3
      gradient.addColorStop(0, "#FFB833");
      gradient.addColorStop(0.5, "#FFA500");
      gradient.addColorStop(1, "#E69400");
    } else if (color === "#00ffab") {
      gradient.addColorStop(0, "#a7f3d0");
      gradient.addColorStop(0.5, "#34d399");
      gradient.addColorStop(1, "#065f46");
    } else if (color === "#ffe600") {
      gradient.addColorStop(0, "#fef08a");
      gradient.addColorStop(0.5, "#facc15");
      gradient.addColorStop(1, "#78350f");
    } else if (color === "#f54291") {
      gradient.addColorStop(0, "#fbcfe8");
      gradient.addColorStop(0.5, "#ec4899");
      gradient.addColorStop(1, "#831843");
    } else {
      gradient.addColorStop(0, "#bae6fd");
      gradient.addColorStop(0.5, "#38bdf8");
      gradient.addColorStop(1, "#0c4a6e");
    }
    return gradient;
  };

  const data = {
    labels: [label, "Remaining"],
    datasets: [
      {
        data: [value, total - value],
        backgroundColor: (context) => {
          const { ctx } = context.chart;
          return [getGradient(ctx, color), "#e5e7eb"];
        },
        borderWidth: 0,
        cutout: "72%",
        circumference: 360,
      },
    ],
  };

  const options = {
    cutout: "72%",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: { enabled: false },
      legend: { display: false },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(30,58,138,0.6)" }}
      className="bg-[#f5f5f5] rounded-xl border border-gray-400 shadow-md p-2 w-[110px] h-[125px] flex flex-col items-center justify-between"
    >
      <h3 className="text-xs font-semibold text-gray-700">{title}</h3>
      <div className="relative w-[70px] h-[70px]">
        <Doughnut data={data} options={options} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold text-gray-800">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}
