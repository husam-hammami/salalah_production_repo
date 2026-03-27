import React from "react";
import { motion } from "framer-motion";

const circleVariants = {
  animate: {
    scale: [1, 1.04, 1],
    transition: {
      repeat: Infinity,
      duration: 4,
      ease: "easeInOut",
    },
  },
  hover: {
    scale: 1.06,
    transition: { duration: 0.4 },
  },
};

const PowerMonitorDiagram = ({ l1, l2, l3 }) => {
  const center = { x: 200, y: 200 };
  const radius = 60;
  const monitorRadius = 50;
  const lineCircleRadius = 40;

  const getCirclePosition = (angleDeg) => {
    const angle = (angleDeg * Math.PI) / 180;
    const totalDistance = radius + monitorRadius + lineCircleRadius;
    return {
      left: center.x + totalDistance * Math.cos(angle) - lineCircleRadius,
      top: center.y - totalDistance * Math.sin(angle) - lineCircleRadius,
      connector: {
        x2: center.x + (radius + monitorRadius) * Math.cos(angle),
        y2: center.y - (radius + monitorRadius) * Math.sin(angle),
      },
    };
  };

  const line1 = getCirclePosition(0);
  const line2 = getCirclePosition(90);
  const line3 = getCirclePosition(180);

  const lineData = [
    {
      pos: line1,
      label: "Line-1",
      color: "#4DD0C9",  // Teal
      voltage: l1?.voltage?.toFixed(1) || "0",
      current: l1?.current?.toFixed(1) || "0",
    },
    {
      pos: line2,
      label: "Line-2",
      color: "#F08080",  // Coral/Salmon Pink
      voltage: l2?.voltage?.toFixed(1) || "0",
      current: l2?.current?.toFixed(1) || "0",
    },
    {
      pos: line3,
      label: "Line-3",
      color: "#FFA500",  // Orange/Amber
      voltage: l3?.voltage?.toFixed(1) || "0",
      current: l3?.current?.toFixed(1) || "0",
    },
  ];

  return (
    <div className="flex items-center justify-center">
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-300 hover:shadow-md"
        style={{
          width: "400px",
          height: "300px",
          position: "relative",
          background: "transparent",
        }}
      >
        <style>{`
          .pulsing-line {
            stroke: #64748b;
            stroke-width: 1.5;
            stroke-dasharray: 5 5;
            stroke-linecap: round;
            animation: electricPulse 2s linear infinite;
            opacity: 0.6;
          }
          @keyframes electricPulse {
            0% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: -20; }
          }
          .pulse-thunder {
            animation: pulseThunder 3s ease-in-out infinite;
            transform-origin: center;
          }
          @keyframes pulseThunder {
            0%, 100% {
              transform: scale(1);
              opacity: 0.8;
            }
            50% {
              transform: scale(1.05);
              opacity: 1;
            }
          }
        `}</style>

        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
          {[line1, line2, line3].map((line, idx) => (
            <line
              key={idx}
              x1={line.connector.x2}
              y1={line.connector.y2}
              x2={center.x}
              y2={center.y}
              className="pulsing-line"
            />
          ))}
        </svg>

        <motion.div
          className="absolute z-10 rounded-full border-[2px] border-white"
          style={{
            width: "100px",
            height: "100px",
            top: center.y - monitorRadius,
            left: center.x - monitorRadius,
            background: "radial-gradient(circle at 30% 30%, #ffff66, #ffcc00, #ff9900)",
            boxShadow: "inset 0 0 12px #fff700",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
            <g className="pulse-thunder">
              <path d="M13 2L3 14H11L11 22L21 10H13L13 2Z" />
            </g>
          </svg>
        </motion.div>

        <div
          className="absolute z-10 text-xs text-black-300 font-bold text-center mt-4"
          style={{ top: center.y + monitorRadius + 10, left: center.x - 50, width: "100px" }}
        >
          Power Monitor
        </div>

        {lineData.map((line, idx) => {
          // Convert hex to RGB for rgba shadow
          const r = parseInt(line.color.slice(1, 3), 16);
          const g = parseInt(line.color.slice(3, 5), 16);
          const b = parseInt(line.color.slice(5, 7), 16);
          
          return (
            <motion.div
              key={idx}
              className="absolute z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center text-[11px] cursor-pointer font-medium"
              style={{
                top: `${line.pos.top}px`,
                left: `${line.pos.left}px`,
                background: `radial-gradient(circle at 30% 30%, ${line.color}, #2a2a2a)`,
                boxShadow: `0 0 8px 2px rgba(${r}, ${g}, ${b}, 0.3), inset 0 0 10px rgba(0, 0, 0, 0.4)`,
                border: "1px solid rgba(255,255,255,0.2)",
                color: '#ffffff', // White text for all lines
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.7)', // Text shadow for better readability
              }}
              variants={circleVariants}
              animate="animate"
              whileHover="hover"
            >
              <div className="font-semibold">{line.label}</div>
              <div>V: {line.voltage}V</div>
              <div>C: {line.current}A</div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default PowerMonitorDiagram;
