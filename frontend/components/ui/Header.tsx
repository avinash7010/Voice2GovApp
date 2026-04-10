import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Colors, Spacing } from "../../constants/theme";

interface HeaderProps {
  title: string;
  leftComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  style?: ViewStyle;
  titleStyle?: TextStyle;
}

export function Header({ title, leftComponent, rightComponent, style, titleStyle }: HeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftContent}>
        {leftComponent}
        <Text style={[styles.title, titleStyle]}>{title}</Text>
      </View>
      <View style={styles.rightContent}>
        {rightComponent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  rightContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: -0.2,
  },
});
