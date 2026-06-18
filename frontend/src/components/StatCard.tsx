'use client';

interface StatCardProps {
  title: string;
  value: number;
  subtitle: string;
  isLoading: boolean;
  accent: 'cyan' | 'emerald' | 'zinc';
}

export default function StatCard({ title, value, subtitle, isLoading, accent }: StatCardProps) {
  const getAccentColors = () => {
    if (accent === 'cyan') return {
      text: 'text-cyan-400',
      border: 'border-cyan-950',
      bg: 'bg-cyan-950/10',
      glow: 'shadow-[0_0_15px_rgba(34,211,238,0.02)]'
    };
    if (accent === 'emerald') return {
      text: 'text-emerald-400',
      border: 'border-emerald-950',
      bg: 'bg-emerald-950/10',
      glow: 'shadow-[0_0_15px_rgba(52,211,153,0.02)]'
    };
    return {
      text: 'text-zinc-300',
      border: 'border-zinc-900',
      bg: 'bg-zinc-900/10',
      glow: ''
    };
  };

  const colors = getAccentColors();

  return (
    <div className={`border rounded-xl p-5 ${colors.bg} ${colors.border} ${colors.glow} flex flex-col justify-between min-h-[120px]`}>
      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
        {title}
      </span>

      {isLoading ? (
        <div className="h-8 w-16 bg-zinc-800 rounded animate-pulse my-2"></div>
      ) : (
        <span className={`text-3xl font-bold leading-none my-1 tracking-tight ${colors.text}`}>
          {value}
        </span>
      )}

      <span className="text-xs text-zinc-500 font-normal mt-1">
        {subtitle}
      </span>
    </div>
  );
}
