import React from "react";
import { View, ActivityIndicator, StyleSheet, ViewStyle } from "react-native";
import { Colors } from "../../constants/theme";

interface LoaderProps {
  size?: "small" | "large" | number;
  color?: string;
  style?: ViewStyle;
  fullScreen?: boolean;
}

export function Loader({ size = "large", color = Colors.primary, style, fullScreen = false }: LoaderProps) {
  return (
    <View style={[fullScreen ? styles.fullScreen : styles.container, style]}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  fullScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
});
