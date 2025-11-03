import React, { lazy, Suspense } from 'react'

// Lazy load recharts components to reduce initial bundle size
const ResponsiveContainer = lazy(() => import('recharts').then(mod => ({ default: mod.ResponsiveContainer })))
const ComposedChart = lazy(() => import('recharts').then(mod => ({ default: mod.ComposedChart })))
const Line = lazy(() => import('recharts').then(mod => ({ default: mod.Line })))
const Area = lazy(() => import('recharts').then(mod => ({ default: mod.Area })))
const CartesianGrid = lazy(() => import('recharts').then(mod => ({ default: mod.CartesianGrid })))
const XAxis = lazy(() => import('recharts').then(mod => ({ default: mod.XAxis })))
const YAxis = lazy(() => import('recharts').then(mod => ({ default: mod.YAxis })))
const Tooltip = lazy(() => import('recharts').then(mod => ({ default: mod.Tooltip })))
const ReferenceLine = lazy(() => import('recharts').then(mod => ({ default: mod.ReferenceLine })))
const PieChart = lazy(() => import('recharts').then(mod => ({ default: mod.PieChart })))
const Pie = lazy(() => import('recharts').then(mod => ({ default: mod.Pie })))
const Cell = lazy(() => import('recharts').then(mod => ({ default: mod.Cell })))

// Loading skeleton for charts
const ChartSkeleton: React.FC<{ height?: number | string }> = ({ height = 200 }) => (
  <div className="w-full flex items-center justify-center" style={{ height: typeof height === 'number' ? `${height}px` : height }}>
    <div className="animate-pulse text-sm text-gray-400">Loading chart...</div>
  </div>
)

// Wrapper component that provides lazy-loaded chart components
// Wrap chart trees in Suspense externally, not here
export const LazyCharts = {
  ResponsiveContainer: ResponsiveContainer,
  ComposedChart: ComposedChart,
  Line: Line,
  Area: Area,
  CartesianGrid: CartesianGrid,
  XAxis: XAxis,
  YAxis: YAxis,
  Tooltip: Tooltip,
  ReferenceLine: ReferenceLine,
  PieChart: PieChart,
  Pie: Pie,
  Cell: Cell,
}

// Helper to wrap chart sections in Suspense
export const ChartSuspense: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ 
  children, 
  fallback = <ChartSkeleton /> 
}) => (
  <Suspense fallback={fallback}>
    {children}
  </Suspense>
)
