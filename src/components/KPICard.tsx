import React from "react";
import { Box, Typography, Paper } from "@mui/material";
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as MinusIcon,
} from "@mui/icons-material";
import type { LucideIcon } from "lucide-react";

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

const VARIANT_COLORS: Record<string, { main: string; light: string; bg: string }> = {
  emerald: { main: "#10b981", light: "#34d399", bg: "#ecfdf5" },
  blue: { main: "#3b82f6", light: "#60a5fa", bg: "#eff6ff" },
  amber: { main: "#f59e0b", light: "#fbbf24", bg: "#fffbeb" },
  violet: { main: "#8b5cf6", light: "#a78bfa", bg: "#f5f3ff" },
  rose: { main: "#ec4899", light: "#f472b6", bg: "#fdf2f8" },
  teal: { main: "#14b8a6", light: "#2dd4bf", bg: "#f0fdfa" },
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
  const colors = VARIANT_COLORS[variant] || VARIANT_COLORS.emerald;

  const trendIcon =
    trend && trend.value > 0 ? (
      <TrendingUpIcon sx={{ fontSize: 14 }} />
    ) : trend && trend.value < 0 ? (
      <TrendingDownIcon sx={{ fontSize: 14 }} />
    ) : (
      <MinusIcon sx={{ fontSize: 14 }} />
    );

  const trendColor =
    trend && trend.value > 0
      ? "#10b981"
      : trend && trend.value < 0
      ? "#ef4444"
      : "#6b7280";

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        position: "relative",
        overflow: "hidden",
        p: 2,
        borderRadius: 3,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease",
        "&:hover": onClick
          ? {
              transform: "translateY(-2px)",
              boxShadow: `0 8px 24px ${colors.main}20`,
              borderColor: colors.main,
            }
          : {},
      }}
    >
      {/* Top row - Icon & Trend */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          mb: 1.5,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: `${colors.main}15`,
            color: colors.main,
          }}
        >
          <Icon size={20} />
        </Box>

        {trend && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: 10,
              bgcolor: `${trendColor}10`,
              color: trendColor,
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            {trendIcon}
            <span>{Math.abs(trend.value)}%</span>
          </Box>
        )}
      </Box>

      {/* Value */}
      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          color: "text.primary",
          lineHeight: 1.2,
          mb: 0.5,
        }}
      >
        {value}
      </Typography>

      {/* Label */}
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          color: colors.main,
          mb: subtitle ? 0.5 : 0,
        }}
      >
        {label}
      </Typography>

      {/* Subtitle */}
      {subtitle && (
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            display: "block",
          }}
        >
          {subtitle}
        </Typography>
      )}

      {/* Decorative gradient line */}
      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${colors.main}, ${colors.light})`,
          opacity: 0.6,
        }}
      />
    </Paper>
  );
};

export default KPICard;
