import React from "react";
import { StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import {
    BorderRadius,
    Colors,
    Spacing
} from "../../constants/theme";

interface BadgeProps {
  label: string;
  variant?: "primary" | "success" | "warning" | "error" | "info" | "default";
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Badge({
  label,
  variant = "default",
  icon,
  style,
  textStyle,
}: BadgeProps) {
  const getColors = () => {
    switch (variant) {
      case "primary":
        return {
          bg: Colors.primary,
          text: Colors.white,
          border: Colors.primary,
        };
      case "success":
        return {
          bg: "#DCFCE7",
          text: Colors.success || "#10B981",
          border: Colors.success || "#10B981",
        };
      case "warning":
        return {
          bg: "#FEF3C7",
          text: Colors.warning || "#F59E0B",
          border: Colors.warning || "#F59E0B",
        };
      case "error":
        return {
          bg: "#FEE2E2",
          text: Colors.error || "#DC2626",
          border: Colors.error || "#DC2626",
        };
      case "info":
        return {
          bg: Colors.chipBlueBg,
          text: Colors.primary,
          border: Colors.border,
        };
      case "default":
        return {
          bg: Colors.surface,
          text: Colors.textSecondary,
          border: Colors.border,
        };
    }
  };

  const colors = getColors();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, borderColor: colors.border },
        style,
      ]}
    >
      {icon && icon}
      <Text style={[styles.text, { color: colors.text }, textStyle]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
  },
});
