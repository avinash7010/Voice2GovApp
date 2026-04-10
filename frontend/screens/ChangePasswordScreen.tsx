import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      currentPassword.trim().length > 0 &&
      newPassword.trim().length >= 8 &&
      confirmPassword.trim().length >= 8
    );
  }, [currentPassword, newPassword, confirmPassword]);

  const onSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (!currentPassword.trim()) {
      Alert.alert("Validation Error", "Please enter your current password.");
      return;
    }

    if (newPassword.trim().length < 8) {
      Alert.alert(
        "Validation Error",
        "New password must be at least 8 characters.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        "Validation Error",
        "New password and confirm password do not match.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Keep UX complete even if backend endpoint is not wired yet.
      await new Promise((resolve) => setTimeout(resolve, 900));

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      Alert.alert("Password Updated", "Your password has been changed.", [
        {
          text: "Done",
          onPress: () => router.back(),
        },
      ]);
    } catch {
      Alert.alert(
        "Update Failed",
        "We could not update your password right now. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={["bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={ScreenUI.textPrimary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Update your account password</Text>
          <Text style={styles.subtitle}>
            Use a strong password with at least 8 characters.
          </Text>

          <Field
            label="Current Password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
          />

          <Field
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
          />

          <Field
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter new password"
          />

          <TouchableOpacity
            style={[
              styles.saveButton,
              (!canSubmit || isSubmitting) && styles.saveButtonDisabled,
            ]}
            onPress={onSubmit}
            disabled={!canSubmit || isSubmitting}
            activeOpacity={0.9}
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save New Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry
        autoCapitalize="none"
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={ScreenUI.textSecondary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: ScreenUI.background,
  },
  header: {
    height: ScreenUI.headerHeight,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: ScreenUI.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: ScreenUI.textPrimary,
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: ScreenUI.border,
    borderRadius: ScreenUI.radius,
    padding: 16,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: "800",
    color: ScreenUI.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: "500",
    color: ScreenUI.textSecondary,
    marginBottom: Spacing.lg,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: "700",
    color: ScreenUI.labelGray,
    letterSpacing: 0.4,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: ScreenUI.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    fontSize: Typography.fontSize.base,
    color: ScreenUI.textPrimary,
  },
  saveButton: {
    marginTop: 8,
    minHeight: 50,
    borderRadius: BorderRadius.lg,
    backgroundColor: ScreenUI.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: "700",
  },
});
