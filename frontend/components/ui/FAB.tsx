import React from "react";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import { Colors, Shadows } from "../../constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface FABProps {
  onPress: () => void;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  color?: string;
  style?: ViewStyle;
}

export function FAB({ onPress, iconName = "plus", color = Colors.primary, style }: FABProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.fab,
        { backgroundColor: color },
        Shadows.medium,
        style,
      ]}
    >
      <MaterialCommunityIcons name={iconName} size={24} color={Colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
