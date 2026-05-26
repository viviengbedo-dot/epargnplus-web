import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  sub?: string
  icon: LucideIcon
  trend?: number
  color?: 'lime' | 'blue' | 'purple' | 'orange'
}

const colorMap = {
  lime:   { bg: 'bg-lime/10',   icon: 'text-navy',      badge: 'bg-lime/10 text-navy' },
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',  badge: 'bg-blue-50 text-blue-600' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600',badge: 'bg-purple-50 text-purple-600' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-500',badge: 'bg-orange-50 text-orange-500' },
}

export default function StatsCard({
  title, value, sub, icon: Icon, trend, color = 'lime'
}: StatsCardProps) {
  const c = colorMap[color]
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.bg}`}>
          <Icon size={20} className={c.icon} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            trend >= 0
              ? 'bg-green-50 text-green-600'
              : 'bg-red-50 text-red-500'
          }`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-navy mb-0.5">{value}</p>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}
