import * as Haptics from "expo-haptics";
import React from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextStyle,
    ViewStyle,
} from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";
import {
    BorderRadius,
    Colors,
    Spacing,
    Typography,
} from "../../constants/theme";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "text";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const getBackgroundColor = () => {
    if (disabled) return Colors.border;
    switch (variant) {
      case "primary":
        return Colors.primary;
      case "secondary":
        return Colors.background;
      case "outline":
        return Colors.transparent;
      case "text":
        return Colors.transparent;
    }
  };

  const getTextColor = () => {
    if (disabled) return Colors.textDisabled;
    switch (variant) {
      case "primary":
        return Colors.white;
      case "secondary":
        return Colors.primary;
      case "outline":
        return Colors.primary;
      case "text":
        return Colors.primary;
    }
  };

  const getBorderColor = () => {
    if (disabled) return Colors.transparent;
    if (variant === "outline") return Colors.primary;
    return Colors.transparent;
  };

  const getHeight = () => {
    switch (size) {
      case "small":
        return 36;
      case "medium":
        return 48;
      case "large":
        return 56;
    }
  };

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return { transform: [{ scale: scale.value }] };
  });

  const handlePressIn = () => {
    if (disabled || loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.97, { damping: 12, stiffness: 260 });
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    scale.value = withSpring(1, { damping: 12, stiffness: 260 });
  };

  const handlePress = () => {
    if (disabled || loading) return;
    void Haptics.selectionAsync();
    onPress();
  };

  const currentBg = getBackgroundColor();
  const currentBorder = getBorderColor();
  const currentText = getTextColor();
  const currentHeight = getHeight();

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          backgroundColor: currentBg,
          borderColor: currentBorder,
          borderWidth: variant === "outline" ? 1 : 0,
          height: currentHeight,
        },
        style,
        animatedStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={currentText} />
      ) : (
        <>
          {icon && icon}
          <Text style={[styles.text, { color: currentText }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  text: {
    fontSize: Typography.fontSize.md,
    fontWeight: "700",
  },
});
