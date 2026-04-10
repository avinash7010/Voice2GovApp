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
import { registerUser } from "../services/api";

export default function RegistrationScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert("Validation Error", "Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        name: fullName.trim(),
        email: email.trim(),
        password,
      });
      Alert.alert(
        "Account Created",
        "Your account has been created successfully! Please log in.",
        [{ text: "OK", onPress: () => router.push("/(auth)/login" as Href) }],
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Registration failed";
      Alert.alert(
        "Registration Error",
        errorMessage || "Failed to create account. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLoginLink = () => {
    router.push("/(auth)/login" as Href);
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

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons
                name="account"
                size={22}
                color={ScreenUI.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor={ScreenUI.textSecondary}
                value={fullName}
                onChangeText={setFullName}
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons
                name="email"
                size={22}
                color={ScreenUI.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="name@company.com"
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
            <Text style={styles.inputLabel}>Password</Text>
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

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons
                name="shield-check"
                size={22}
                color={ScreenUI.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={ScreenUI.textSecondary}
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={22}
                  color={ScreenUI.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color={ScreenUI.card} />
            ) : (
              <View style={styles.registerButtonContent}>
                <Text style={styles.registerButtonText}>Register</Text>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={22}
                  color={ScreenUI.card}
                />
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.termsText}>
            By registering, you agree to our{" "}
            <Text style={styles.termsLink}>Terms and Conditions</Text> and{" "}
            <Text style={styles.termsLink}>Privacy Policy</Text>.
          </Text>

          <View style={styles.loginSection}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={handleLoginLink} activeOpacity={0.8}>
              <Text style={styles.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.verifiedSection}>
          <View style={styles.avatarsRow}>
            <Image
              source={{ uri: "https://i.pravatar.cc/60?img=12" }}
              style={[styles.avatar, styles.avatarFirst]}
            />
            <Image
              source={{ uri: "https://i.pravatar.cc/60?img=32" }}
              style={[styles.avatar, styles.avatarSecond]}
            />
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>10k+</Text>
            </View>
          </View>
          <View>
            <Text style={styles.verifiedLabel}>VERIFIED CITIZENS</Text>
            <Text style={styles.verifiedValue}>Active in your region</Text>
          </View>
        </View>

        <View style={styles.bottomFooter}>
          <Text style={styles.footerCopyright}>
            © 2026 Voice2Gov Civic Engagement Platform. All rights reserved.
          </Text>
          <View style={styles.footerLinkRow}>
            <Text style={styles.footerLink}>Security</Text>
            <Text style={styles.footerLink}>Help Center</Text>
            <Text style={styles.footerLink}>Status</Text>
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
    maxWidth: 440,
    alignSelf: "center",
    backgroundColor: ScreenUI.card,
    borderRadius: ScreenUI.radiusLg,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
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
    marginBottom: 14,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: ScreenUI.radius,
    backgroundColor: ScreenUI.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
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
  formGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: ScreenUI.textPrimary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: ScreenUI.border,
    borderRadius: ScreenUI.radius,
    paddingHorizontal: 12,
    minHeight: ScreenUI.buttonHeight,
    backgroundColor: "#F8FAFD",
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: ScreenUI.textPrimary,
    paddingVertical: 8,
  },
  registerButton: {
    marginTop: 6,
    minHeight: 52,
    borderRadius: ScreenUI.radius,
    backgroundColor: ScreenUI.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  registerButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  registerButtonText: {
    color: ScreenUI.card,
    fontSize: 16,
    fontWeight: "700",
  },
  termsText: {
    fontSize: 14,
    lineHeight: 20,
    color: ScreenUI.textPrimary,
    textAlign: "center",
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  termsLink: {
    color: ScreenUI.primary,
    fontWeight: "700",
  },
  loginSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  loginText: {
    fontSize: 14,
    color: ScreenUI.textPrimary,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: "700",
    color: ScreenUI.primary,
  },
  verifiedSection: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatarsRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    width: 132,
    height: 52,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: ScreenUI.background,
    position: "absolute",
  },
  avatarFirst: {
    left: 0,
  },
  avatarSecond: {
    left: 30,
  },
  avatarBadge: {
    position: "absolute",
    left: 60,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ScreenUI.primary,
    borderWidth: 2,
    borderColor: ScreenUI.background,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadgeText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  verifiedLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    color: ScreenUI.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  verifiedValue: {
    fontSize: 12,
    color: ScreenUI.textPrimary,
    fontWeight: "700",
  },
  bottomFooter: {
    borderTopWidth: 1,
    borderTopColor: ScreenUI.border,
    paddingTop: 10,
    alignItems: "center",
  },
  footerCopyright: {
    fontSize: 10,
    color: ScreenUI.textSecondary,
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  footerLinkRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
  },
  footerLink: {
    fontSize: 10,
    color: ScreenUI.textSecondary,
  },
});
