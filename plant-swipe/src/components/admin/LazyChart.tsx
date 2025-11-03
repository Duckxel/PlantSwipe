import React, { lazy, Suspense, createContext, useContext, useState, useEffect } from 'react'

// Lazy load the entire recharts module at once
const loadRecharts = () => import('recharts')

// Context to share loaded recharts module across all chart components
const RechartsContext = createContext<typeof import('recharts') | null>(null)

// Provider component that loads recharts once
const RechartsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [charts, setCharts] = useState<typeof import('recharts') | null>(null)
  
  useEffect(() => {
    loadRecharts().then(mod => setCharts(mod as any))
  }, [])
  
  return (
    <RechartsContext.Provider value={charts}>
      {charts ? children : <div className="animate-pulse text-sm text-gray-400 p-4">Loading chart...</div>}
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
  <div className="w-full flex items-center justify-center" style={{ height: typeof height === 'number' ? `${height}px` : height }}>
    <div className="animate-pulse text-sm text-gray-400">Loading chart...</div>
  </div>
)

// Chart components that use the shared context
const ResponsiveContainerImpl: React.FC<any> = (props) => {
  const charts = useCharts()
  return <charts.ResponsiveContainer {...props} />
}

const ComposedChartImpl: React.FC<any> = (props) => {
  const charts = useCharts()
  return <charts.ComposedChart {...props} />
}

const LineImpl: React.FC<any> = (props) => {
  const charts = useCharts()
  return <charts.Line {...props} />
}

const AreaImpl: React.FC<any> = (props) => {
  const charts = useCharts()
  return <charts.Area {...props} />
}

const CartesianGridImpl: React.FC<any> = (props) => {
  const charts = useCharts()
  return <charts.CartesianGrid {...props} />
}

const XAxisImpl: React.FC<any> = (props) => {
  const charts = useCharts()
  return <charts.XAxis {...props} />
}

const YAxisImpl: React.FC<any> = (props) => {
  const charts = useCharts()
  return <charts.YAxis {...props} />
}

const TooltipImpl: React.FC<any> = (props) => {
  const charts = useCharts()
  return <charts.Tooltip {...props} />
}

const ReferenceLineImpl: React.FC<any> = (props) => {
  const charts = useCharts()
  return <charts.ReferenceLine {...props} />
}

const PieChartImpl: React.FC<any> = (props) => {
  const charts = useCharts()
  return <charts.PieChart {...props} />
}

const PieImpl: React.FC<any> = (props) => {
  const charts = useCharts()
  return <charts.Pie {...props} />
}

const CellImpl: React.FC<any> = (props) => {
  const charts = useCharts()
  return <charts.Cell {...props} />
}

// Export chart components wrapped in provider
export const LazyCharts = {
  ResponsiveContainer: (props: any) => (
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
