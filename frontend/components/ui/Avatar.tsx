import React from "react";
import { Image, View, StyleSheet, ImageSourcePropType, ViewStyle } from "react-native";
import { Colors } from "../../constants/theme";

interface AvatarProps {
  source: ImageSourcePropType;
  size?: number;
  style?: ViewStyle;
}

export function Avatar({ source, size = 40, style }: AvatarProps) {
  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Image source={source} style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    backgroundColor: Colors.surface,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
