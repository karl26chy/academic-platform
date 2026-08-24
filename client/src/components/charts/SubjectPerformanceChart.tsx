import React from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Cell, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { getSubjectColor } from '../../lib/subjectColors';

export interface SubjectChartDatum {
  name: string;
  [serie: string]: string | number;
}

interface SubjectPerformanceChartProps {
  data: SubjectChartDatum[];
  /** Nombre de la serie a pintar; también es la clave de cada dato. */
  dataKey: string;
  /** Tope del eje Y: 10 en colegios, 5 en universidades. */
  maxScore: number;
  /** Línea roja de la nota mínima de aprobación. */
  notaMinima?: number;
  referenceLabel?: string;
  referenceLabelPosition?: 'insideBottomRight';
  height?: string;
  gridStroke?: string;
  showActiveDot?: boolean;
  highlightTooltipLabel?: boolean;
}

/** Barras + línea de promedio por materia, con la mínima institucional. */
export const SubjectPerformanceChart: React.FC<SubjectPerformanceChartProps> = ({
  data,
  dataKey,
  maxScore,
  notaMinima,
  referenceLabel,
  referenceLabelPosition,
  height = 'h-72',
  gridStroke = '#e2e8f0',
  showActiveDot = false,
  highlightTooltipLabel = false,
}) => (
  <div className={`${height} w-full`}>
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
        <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          interval="preserveStartEnd"
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis stroke="#94a3b8" fontSize={11} domain={[0, maxScore]} tickLine={false} />
        <Tooltip
          contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '12px' }}
          labelStyle={highlightTooltipLabel ? { color: '#1e293b', fontWeight: 'bold' } : undefined}
        />
        <Legend />
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} barSize={24}>
          {data.map(d => (
            <Cell key={d.name} fill={getSubjectColor(d.name)} />
          ))}
        </Bar>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke="#94a3b8"
          strokeWidth={2}
          activeDot={showActiveDot ? { r: 6 } : undefined}
        />
        {notaMinima !== undefined && (
          <ReferenceLine
            y={notaMinima}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{
              value: referenceLabel,
              fill: '#f87171',
              fontSize: 10,
              position: referenceLabelPosition,
            }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  </div>
);
