/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React, { Suspense, createContext, useContext, useState, useEffect, useRef } from 'react'
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

// Hook to safely measure container dimensions before rendering chart.
// This prevents the recharts warning about negative dimensions (-1, -1)
// by deferring the initial measurement to requestAnimationFrame — at
// that point the browser has completed layout and dimensions are valid.
const useSafeContainerDimensions = (minWidth = 1, minHeight = 1) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    // Defer first measurement to after browser paint so the container
    // has been laid out with valid (non-negative) dimensions.
    const rafId = requestAnimationFrame(() => {
      const { width, height } = container.getBoundingClientRect()
      if (width >= minWidth && height >= minHeight) {
        setDimensions({ width, height })
      }
    })
    
    // Use ResizeObserver for subsequent dimension changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width >= minWidth && height >= minHeight) {
          setDimensions({ width, height })
        }
      }
    })
    
    resizeObserver.observe(container)
    
    return () => {
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
    }
  }, [minWidth, minHeight])
  
  return { containerRef, dimensions, isReady: dimensions !== null }
}

// Chart components that use the shared context
// SafeResponsiveContainer waits for valid dimensions before rendering
const ResponsiveContainerImpl: React.FC<ResponsiveContainerProps> = ({ minWidth, minHeight, ...restProps }) => {
  const charts = useCharts()
  const { containerRef, isReady } = useSafeContainerDimensions(1, 1)
  
  // Enforce a floor of 1 so recharts never sees 0 or negative dimensions
  const safeMinWidth = Math.max(Number(minWidth) || 1, 1)
  const safeMinHeight = Math.max(Number(minHeight) || 1, 1)
  
  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: restProps.width ?? '100%', 
        height: restProps.height ?? '100%',
        minWidth: safeMinWidth,
        minHeight: safeMinHeight,
      }}
    >
      {isReady ? (
        <charts.ResponsiveContainer 
          debounce={50}
          {...restProps}
          width="100%"
          height="100%"
          minWidth={safeMinWidth}
          minHeight={safeMinHeight}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  )
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

// Standalone SafeResponsiveContainer for use with direct recharts imports
// This prevents the negative dimensions (-1, -1) warning by waiting for valid measurements
export const SafeResponsiveContainer: React.FC<
  ResponsiveContainerProps & { 
    loadingFallback?: React.ReactNode 
  }
> = ({ loadingFallback, children, minWidth, minHeight, ...restProps }) => {
  const { containerRef, isReady } = useSafeContainerDimensions(1, 1)
  // Dynamically import ResponsiveContainer from recharts
  const [RechartResponsiveContainer, setRechartResponsiveContainer] = useState<
    typeof import('recharts').ResponsiveContainer | null
  >(null)
  
  // Enforce a floor of 1 so recharts never sees 0 or negative dimensions
  const safeMinWidth = Math.max(Number(minWidth) || 1, 1)
  const safeMinHeight = Math.max(Number(minHeight) || 1, 1)
  
  useEffect(() => {
    import('recharts').then((mod) => {
      setRechartResponsiveContainer(() => mod.ResponsiveContainer)
    })
  }, [])
  
  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: restProps.width ?? '100%', 
        height: restProps.height ?? '100%',
        minWidth: safeMinWidth,
        minHeight: safeMinHeight,
      }}
    >
      {isReady && RechartResponsiveContainer ? (
        <RechartResponsiveContainer 
          debounce={50}
          {...restProps}
          width="100%"
          height="100%"
          minWidth={safeMinWidth}
          minHeight={safeMinHeight}
        >
          {children}
        </RechartResponsiveContainer>
      ) : (
        loadingFallback ?? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        )
      )}
    </div>
  )
}
SafeResponsiveContainer.displayName = 'SafeResponsiveContainer'

// Export the hook for custom implementations
export { useSafeContainerDimensions }
