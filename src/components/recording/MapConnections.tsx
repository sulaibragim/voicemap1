interface Connection {
  targetId: string;
  word: string;
}

interface MapConnectionsProps {
  hoveredId: string | null;
  connections: Map<string, Connection[]>;
  positions: Map<string, { x: number; y: number }>;
  canvasWidth: number;
  canvasHeight: number;
}

export const MapConnections = ({
  hoveredId,
  connections,
  positions,
  canvasWidth,
  canvasHeight,
}: MapConnectionsProps) => {
  if (!hoveredId) return null;

  const sourcePos = positions.get(hoveredId);
  if (!sourcePos) return null;

  const conns = connections.get(hoveredId) ?? [];

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={canvasWidth}
      height={canvasHeight}
      style={{ zIndex: 5 }}
    >
      <defs>
        <filter id="conn-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {conns.map((conn, i) => {
        const targetPos = positions.get(conn.targetId);
        if (!targetPos) return null;

        const midX = (sourcePos.x + targetPos.x) / 2;
        const midY = (sourcePos.y + targetPos.y) / 2;
        const label = conn.word.length > 14 ? conn.word.slice(0, 14) + '…' : conn.word;
        const labelW = label.length * 6.5 + 12;

        return (
          <g key={i}>
            <line
              x1={sourcePos.x}
              y1={sourcePos.y}
              x2={targetPos.x}
              y2={targetPos.y}
              stroke="rgba(123, 97, 255, 0.45)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
              filter="url(#conn-glow)"
            />
            {/* Label background */}
            <rect
              x={midX - labelW / 2}
              y={midY - 10}
              width={labelW}
              height={18}
              rx={5}
              fill="rgba(15, 12, 30, 0.88)"
              stroke="rgba(123, 97, 255, 0.3)"
              strokeWidth="0.8"
            />
            <text
              x={midX}
              y={midY + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(175, 162, 255, 0.95)"
              fontSize="10"
              fontWeight="700"
              fontFamily="monospace"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
