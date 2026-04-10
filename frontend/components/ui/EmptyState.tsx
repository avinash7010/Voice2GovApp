import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Typography, Spacing } from "../../constants/theme";
import { Button } from "./Button";

interface EmptyStateProps {
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description?: string;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function EmptyState({ iconName = "inbox-remove-outline", title, description, actionTitle, onAction, style }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <MaterialCommunityIcons name={iconName} size={64} color={Colors.textDisabled} />
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionTitle && onAction && (
        <Button title={actionTitle} onPress={onAction} style={styles.actionButton} />
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
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    textAlign: "center",
  },
  description: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.sm,
    maxWidth: "80%",
  },
  actionButton: {
    marginTop: Spacing.lg,
  },
});
