import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BorderRadius, Colors, Spacing, Typography } from "../constants/theme";
import { ScreenUI } from "../constants/ui";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSendOTP = async () => {
    if (!email) {
      Alert.alert("Validation Error", "Please enter your email address.");
      return;
    }

    if (!isValidEmail) {
      Alert.alert("Validation Error", "Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert("Success", "OTP sent to your email!");
      router.push("/(auth)/login" as Href);
    } catch {
      Alert.alert("Error", "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.push("/(auth)/login" as Href);
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="lock-reset"
                size={32}
                color={Colors.white}
              />
            </View>
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>Enter your email to receive OTP</Text>
          </View>

          {/* Email Input */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons
                name="email"
                size={20}
                color={ScreenUI.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. name@agency.gov"
                placeholderTextColor={ScreenUI.textSecondary}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Send OTP Button */}
          <TouchableOpacity
            style={[
              styles.sendOTPButton,
              loading && styles.sendOTPButtonDisabled,
            ]}
            onPress={handleSendOTP}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.sendOTPButtonText}>Send OTP</Text>
            )}
          </TouchableOpacity>

          {/* Back to Login Link */}
          <View style={styles.backSection}>
            <TouchableOpacity onPress={handleBackToLogin}>
              <Text style={styles.backLink}>← Back to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: ScreenUI.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: ScreenUI.border,
    width: "100%",
    alignSelf: "center",
    shadowColor: ScreenUI.shadowColor,
    shadowOpacity: ScreenUI.shadowOpacity,
    shadowRadius: ScreenUI.shadowRadius,
    shadowOffset: ScreenUI.shadowOffset,
    elevation: ScreenUI.elevation,
  },

  // Header Section
  headerSection: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xl,
    backgroundColor: ScreenUI.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize["2xl"],
    fontWeight: "700",
    letterSpacing: -0.5,
    color: ScreenUI.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: "500",
    color: ScreenUI.textSecondary,
    textAlign: "center",
    lineHeight: 1.5,
  },

  // Form Group
  formGroup: {
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: ScreenUI.textPrimary,
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: ScreenUI.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: Spacing.md,
    fontSize: Typography.fontSize.sm,
    color: ScreenUI.textPrimary,
  },

  // Send OTP Button
  sendOTPButton: {
    paddingVertical: 16,
    backgroundColor: ScreenUI.primary,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  sendOTPButtonDisabled: {
    opacity: 0.6,
  },
  sendOTPButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: "700",
    color: Colors.white,
  },

  // Back Section
  backSection: {
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  backLink: {
    fontSize: Typography.fontSize.sm,
    fontWeight: "700",
    color: ScreenUI.primary,
    textDecorationLine: "none",
  },
});
