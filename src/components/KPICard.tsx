import React from "react";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import "./KPICard.css";

type Trend = {
  value: number;
  label?: string;
};

type Props = {
  icon: LucideIcon;
  label: string;
  value: number | string;
  variant?: "emerald" | "blue" | "amber" | "violet" | "rose" | "teal";
  trend?: Trend;
  subtitle?: string;
  onClick?: () => void;
};

const KPICard: React.FC<Props> = ({
  icon: Icon,
  label,
  value,
  variant = "emerald",
  trend,
  subtitle,
  onClick,
}) => {
  const trendIcon =
    trend && trend.value > 0 ? (
      <TrendingUp size={12} />
    ) : trend && trend.value < 0 ? (
      <TrendingDown size={12} />
    ) : (
      <Minus size={12} />
    );

  const trendClass =
    trend && trend.value > 0
      ? "up"
      : trend && trend.value < 0
      ? "down"
      : "flat";

  return (
    <div
      className={`kpi-card kpi-${variant} ${onClick ? "clickable" : ""}`}
      onClick={onClick}
    >
      <div className="kpi-card-glow" />

      <div className="kpi-card-top">
        <div className="kpi-card-icon">
          <Icon size={20} />
        </div>
        {trend && (
          <div className={`kpi-card-trend trend-${trendClass}`}>
            {trendIcon}
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>

      <div className="kpi-card-value">{value}</div>

      <div className="kpi-card-label">{label}</div>

      {subtitle && <div className="kpi-card-subtitle">{subtitle}</div>}

      <svg className="kpi-card-pattern" viewBox="0 0 100 100">
        <defs>
          <pattern
            id={`dots-${variant}`}
            x="0"
            y="0"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1" fill="currentColor" opacity="0.15" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={`url(#dots-${variant})`} />
      </svg>
    </div>
  );
};

export default KPICard;
