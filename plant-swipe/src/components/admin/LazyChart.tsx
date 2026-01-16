 // @ts-nocheck
import React, { Suspense, createContext, useContext, useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import type {
  ResponsiveContainerProps,
  LineProps,
  AreaProps,
  CartesianGridProps,
  XAxisProps,
  YAxisProps,
  TooltipProps,
  ReferenceLineProps,
  PieProps,
  CellProps,
  BarProps,
  RadialBarProps,
  PolarAngleAxisProps,
} from 'recharts'

// ComposedChart props type (not exported from recharts)
type ComposedChartProps = React.ComponentProps<typeof import('recharts').ComposedChart>

// Lazy load the entire recharts module at once
const loadRecharts = () => import('recharts')

type RechartsModule = typeof import('recharts')

// Context to share loaded recharts module across all chart components
const RechartsContext = createContext<RechartsModule | null>(null)

// Provider component that loads recharts once
const RechartsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [charts, setCharts] = useState<RechartsModule | null>(null)
  
  useEffect(() => {
    loadRecharts().then(mod => setCharts(mod))
  }, [])
  
  return (
    <RechartsContext.Provider value={charts}>
      {charts ? children : (
        <div className="flex items-center justify-center gap-2 p-4 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading chart...</span>
        </div>
      )}
    </RechartsContext.Provider>
  )
}

// Hook to get chart components
const useCharts = () => {
  const charts = useContext(RechartsContext)
  if (!charts) throw new Error('Charts not loaded')
  return charts
}

// Loading skeleton for charts
const ChartSkeleton: React.FC<{ height?: number | string }> = ({ height = 200 }) => (
  <div className="w-full flex items-center justify-center gap-2" style={{ height: typeof height === 'number' ? `${height}px` : height }}>
    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
    <span className="text-sm text-gray-400">Loading chart...</span>
  </div>
)

// Chart components that use the shared context
const ResponsiveContainerImpl: React.FC<ResponsiveContainerProps> = (props) => {
  const charts = useCharts()
  return <charts.ResponsiveContainer {...props} />
}
ResponsiveContainerImpl.displayName = 'ResponsiveContainer'

const ComposedChartImpl: React.FC<ComposedChartProps> = (props) => {
  const charts = useCharts()
  return <charts.ComposedChart {...props} />
}
ComposedChartImpl.displayName = 'ComposedChart'

const LineImpl: React.FC<LineProps> = (props) => {
  const charts = useCharts()
  return <charts.Line {...props} />
}
LineImpl.displayName = 'Line'

const AreaImpl: React.FC<AreaProps> = (props) => {
  const charts = useCharts()
  return <charts.Area {...props} />
}
AreaImpl.displayName = 'Area'

const CartesianGridImpl: React.FC<CartesianGridProps> = (props) => {
  const charts = useCharts()
  return <charts.CartesianGrid {...props} />
}
CartesianGridImpl.displayName = 'CartesianGrid'

const XAxisImpl: React.FC<XAxisProps> = (props) => {
  const charts = useCharts()
  return <charts.XAxis {...props} />
}
XAxisImpl.displayName = 'XAxis'

const YAxisImpl: React.FC<YAxisProps> = (props) => {
  const charts = useCharts()
  return <charts.YAxis {...props} />
}
YAxisImpl.displayName = 'YAxis'

const TooltipImpl = <TValue extends number | string | Array<number | string>, TName extends string>(props: TooltipProps<TValue, TName>) => {
  const charts = useCharts()
  return <charts.Tooltip {...props} />
}

const ReferenceLineImpl: React.FC<ReferenceLineProps> = (props) => {
  const charts = useCharts()
  return <charts.ReferenceLine {...props} />
}
ReferenceLineImpl.displayName = 'ReferenceLine'

const PieChartImpl: React.FC<{ children?: React.ReactNode; width?: number; height?: number }> = (props) => {
  const charts = useCharts()
  return <charts.PieChart {...props} />
}
PieChartImpl.displayName = 'PieChart'

const PieImpl: React.FC<PieProps> = (props) => {
  const charts = useCharts()
  return <charts.Pie {...props} />
}
PieImpl.displayName = 'Pie'

const CellImpl: React.FC<CellProps> = (props) => {
  const charts = useCharts()
  return <charts.Cell {...props} />
}
CellImpl.displayName = 'Cell'

const BarChartImpl: React.FC<{ children?: React.ReactNode; data?: unknown[]; width?: number; height?: number }> = (props) => {
  const charts = useCharts()
  return <charts.BarChart {...props} />
}
BarChartImpl.displayName = 'BarChart'

const BarImpl: React.FC<BarProps> = (props) => {
  const charts = useCharts()
  return <charts.Bar {...props} />
}
BarImpl.displayName = 'Bar'

const RadialBarChartImpl: React.FC<{ children?: React.ReactNode; data?: unknown[]; width?: number; height?: number; innerRadius?: string | number; outerRadius?: string | number; startAngle?: number; endAngle?: number }> = (props) => {
  const charts = useCharts()
  return <charts.RadialBarChart {...props} />
}
RadialBarChartImpl.displayName = 'RadialBarChart'

const RadialBarImpl: React.FC<RadialBarProps> = (props) => {
  const charts = useCharts()
  return <charts.RadialBar {...props} />
}
RadialBarImpl.displayName = 'RadialBar'

const PolarAngleAxisImpl: React.FC<PolarAngleAxisProps> = (props) => {
  const charts = useCharts()
  return <charts.PolarAngleAxis {...props} />
}
PolarAngleAxisImpl.displayName = 'PolarAngleAxis'

// Export chart components wrapped in provider
export const LazyCharts = {
  ResponsiveContainer: (props: ResponsiveContainerProps) => (
    <Suspense fallback={<ChartSkeleton height={props.height} />}>
      <RechartsProvider>
        <ResponsiveContainerImpl {...props} />
      </RechartsProvider>
    </Suspense>
  ),
  ComposedChart: ComposedChartImpl,
  Line: LineImpl,
  Area: AreaImpl,
  CartesianGrid: CartesianGridImpl,
  XAxis: XAxisImpl,
  YAxis: YAxisImpl,
  Tooltip: TooltipImpl,
  ReferenceLine: ReferenceLineImpl,
  PieChart: PieChartImpl,
  Pie: PieImpl,
  Cell: CellImpl,
  BarChart: BarChartImpl,
  Bar: BarImpl,
  RadialBarChart: RadialBarChartImpl,
  RadialBar: RadialBarImpl,
  PolarAngleAxis: PolarAngleAxisImpl,
}

// Helper to wrap chart sections in Suspense with provider
export const ChartSuspense: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback = <ChartSkeleton /> 
}) => (
  <Suspense fallback={fallback}>
    <RechartsProvider>
      {children}
    </RechartsProvider>
  </Suspense>
)
