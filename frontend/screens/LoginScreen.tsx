import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenUI } from "../constants/ui";
import { loginUser } from "../services/api";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Validation Error", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      await loginUser({ email: email.trim(), password });
      Alert.alert("Success", "Logged in successfully!");
      router.replace("/(tabs)/dashboard" as Href);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Login failed";

      // Determine error type and show appropriate alert
      if (
        errorMessage.toLowerCase().includes("user") ||
        errorMessage.toLowerCase().includes("not found")
      ) {
        Alert.alert(
          "User Not Found",
          "No account exists with this email. Would you like to create one?",
          [
            { text: "Cancel", onPress: () => {} },
            { text: "Register Now", onPress: handleRegister },
          ],
        );
      } else if (
        errorMessage.toLowerCase().includes("password") ||
        errorMessage.toLowerCase().includes("invalid")
      ) {
        Alert.alert(
          "Incorrect Password",
          "The password you entered is incorrect. Please try again.",
        );
      } else {
        Alert.alert(
          "Login Error",
          errorMessage || "Failed to login. Please try again",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    router.push("/(auth)/register" as Href);
  };

  const handleForgotPassword = () => {
    router.push("/(auth)/forgot-password" as Href);
  };

  const handleGoogleLogin = () => {
    Alert.alert("Google Login", "Google SSO integration would go here");
  };

  const handleAgencySSOLogin = () => {
    Alert.alert("Agency SSO", "Agency SSO login would go here");
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.brandingSection}>
            <View style={styles.logoContainer}>
              <MaterialCommunityIcons
                name="equalizer"
                size={32}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.appTitle}>Voice2Gov</Text>
            <Text style={styles.appSubtitle}>
              Digital Concierge for Civic Change
            </Text>
          </View>

          <View style={styles.ssoSection}>
            <TouchableOpacity
              style={styles.ssoButton}
              onPress={handleGoogleLogin}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: "https://www.google.com/favicon.ico" }}
                style={styles.ssoIcon}
              />
              <Text style={styles.ssoButtonText}>Login with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ssoButton}
              onPress={handleAgencySSOLogin}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons
                name="bank"
                size={20}
                color={ScreenUI.primary}
              />
              <Text style={styles.ssoButtonText}>Login via Agency SSO</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerSection}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons
                name="email"
                size={22}
                color={ScreenUI.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. name@agency.gov"
                placeholderTextColor={ScreenUI.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={styles.forgotPasswordLink}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons
                name="lock"
                size={22}
                color={ScreenUI.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={ScreenUI.textSecondary}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={showPassword ? "eye-off" : "eye"}
                  size={22}
                  color={ScreenUI.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color={ScreenUI.card} />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerSection}>
            <Text style={styles.registerText}>
              Don&apos;t have an account?{" "}
            </Text>
            <TouchableOpacity onPress={handleRegister} activeOpacity={0.8}>
              <Text style={styles.registerLink}>Register Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footerLinks}>
          <Text style={styles.footerLinkText}>PRIVACY POLICY</Text>
          <Text style={styles.footerLinkText}>CIVIC STANDARDS</Text>
          <Text style={styles.footerLinkText}>SUPPORT</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: ScreenUI.background,
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: ScreenUI.pagePaddingHorizontal,
    paddingTop: 16,
    paddingBottom: 24,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    backgroundColor: ScreenUI.card,
    borderRadius: ScreenUI.radiusLg,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: ScreenUI.border,
    shadowColor: ScreenUI.shadowColor,
    shadowOpacity: ScreenUI.shadowOpacity,
    shadowRadius: ScreenUI.shadowRadius,
    shadowOffset: ScreenUI.shadowOffset,
    elevation: ScreenUI.elevation,
  },
  brandingSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: ScreenUI.radius,
    backgroundColor: ScreenUI.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: ScreenUI.textPrimary,
    marginBottom: 4,
    maxWidth: "100%",
    textAlign: "center",
    flexShrink: 1,
  },
  appSubtitle: {
    fontSize: 14,
    lineHeight: 18,
    color: ScreenUI.textSecondary,
    fontWeight: "500",
    textAlign: "center",
  },
  ssoSection: {
    gap: 10,
    marginBottom: 16,
  },
  ssoButton: {
    minHeight: ScreenUI.buttonHeight,
    borderWidth: 1,
    borderColor: ScreenUI.border,
    borderRadius: ScreenUI.radius,
    backgroundColor: ScreenUI.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ssoIcon: {
    width: 20,
    height: 20,
  },
  ssoButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: ScreenUI.textPrimary,
  },
  dividerSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: ScreenUI.border,
  },
  dividerText: {
    fontSize: 13,
    color: ScreenUI.textSecondary,
    fontWeight: "600",
  },
  formGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: ScreenUI.textPrimary,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  passwordLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  forgotPasswordLink: {
    fontSize: 14,
    fontWeight: "700",
    color: ScreenUI.primary,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: ScreenUI.border,
    borderRadius: ScreenUI.radius,
    paddingHorizontal: 14,
    minHeight: ScreenUI.buttonHeight,
    backgroundColor: ScreenUI.card,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: ScreenUI.textPrimary,
    backgroundColor: ScreenUI.card,
    paddingVertical: 10,
  },
  loginButton: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: ScreenUI.radius,
    backgroundColor: ScreenUI.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  loginButtonText: {
    color: ScreenUI.card,
    fontSize: 16,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  registerSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  registerText: {
    fontSize: 14,
    color: ScreenUI.textPrimary,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: "700",
    color: ScreenUI.primary,
  },
  footerLinks: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 14,
  },
  footerLinkText: {
    fontSize: 10,
    color: ScreenUI.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
