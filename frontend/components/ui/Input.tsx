import React from "react";
import { View, Text, TextInput, TextInputProps, StyleSheet, TextStyle, ViewStyle } from "react-native";
import { Colors, Spacing, BorderRadius, Typography } from "../../constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  inputStyle?: TextStyle;
}

export function Input({ label, error, containerStyle, labelStyle, inputStyle, ...props }: InputProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          props.multiline && styles.multiline,
          error ? styles.inputError : null,
          inputStyle,
        ]}
        placeholderTextColor={Colors.textTertiary}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.labelGray,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.base,
  },
  multiline: {
    minHeight: 112,
    paddingTop: Spacing.md,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.xs,
  },
});
