import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Typography, Spacing } from "../../constants/theme";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  error?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function ErrorState({ title = "Oops! Something went wrong", error, onRetry, style }: ErrorStateProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Colors.error} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {error && <Text style={styles.description}>{error}</Text>}
      {onRetry && (
        <Button title="Try Again" variant="outline" onPress={onRetry} style={styles.button} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  iconContainer: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: 50,
    backgroundColor: "#FEE2E2",
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  description: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  button: {
    marginTop: Spacing.lg,
  },
});
