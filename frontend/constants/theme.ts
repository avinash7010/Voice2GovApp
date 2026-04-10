import { Platform } from "react-native";

export const Colors = {
  primary: "#1C4980",
  darkBlue: "#003263",
  background: "#F4F6F9",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  border: "#E6EBF2",
  divider: "#E5E7EB",
  text: "#1B1C1C",
  textPrimary: "#172033",
  textSecondary: "#667085",
  textTertiary: "#6B7280",
  textDisabled: "#9CA3AF",
  labelGray: "#5C6B82",
  chipBlueBg: "#EBF3FF",
  chipGreenBg: "#DDF4E6",
  chipGreenText: "#15803D",
  error: "#DC2626",
  success: "#10B981",
  warning: "#F59E0B",
  info: "#3B82F6",
  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",
};

export const Typography = {
  fontSize: { xs: 11, sm: 12, base: 14, md: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30 },
  fontWeight: { light: "300", normal: "400", medium: "500", semibold: "600", bold: "700", extraBold: "800" },
  lineHeight: { tight: 1.2, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2 },
};

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24, "3xl": 32 };

export const BorderRadius = { sm: 4, md: 8, lg: 12, xl: 16, "2xl": 20, full: 9999 };

export const Shadows = {
  soft: { shadowColor: Colors.black, shadowOpacity: 0.04, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  medium: { shadowColor: Colors.black, shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
};

