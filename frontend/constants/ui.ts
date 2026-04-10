import { TextStyle, ViewStyle } from "react-native";

import { Spacing, Typography } from "./theme";

export const ScreenUI = {
  background: "#F4F6F9",
  card: "#FFFFFF",
  border: "#E6EBF2",
  primary: "#1C4980",
  textPrimary: "#172033",
  textSecondary: "#667085",
  labelGray: "#5C6B82",
  chipBlueBg: "#EBF3FF",
  chipGreenBg: "#DDF4E6",
  chipGreenText: "#15803D",
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radius: 14,
  impactRadius: 16,
  shadowColor: "#000000",
  shadowOpacity: 0.05,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
  headerHeight: 60,
  headerPaddingHorizontal: 16,
  headerPaddingVertical: 8,
  pagePaddingHorizontal: 16,
  pagePaddingTop: 16,
  pagePaddingBottom: 36,
  cardPadding: 16,
  pageTitleSize: 22,
  sectionTitleSize: 16,
  bodySize: 14,
  buttonHeight: 50,
  inputHeight: 50,
  iconSm: 20,
  iconMd: 22,
  iconLg: 24,
} as const;

export const UI = {
  screen: {
    flex: 1,
    backgroundColor: ScreenUI.background,
  } satisfies ViewStyle,

  header: {
    height: ScreenUI.headerHeight,
    backgroundColor: ScreenUI.card,
    borderBottomWidth: 1,
    borderBottomColor: ScreenUI.border,
    paddingHorizontal: ScreenUI.headerPaddingHorizontal,
    paddingVertical: ScreenUI.headerPaddingVertical,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  } satisfies ViewStyle,

  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: ScreenUI.textPrimary,
    letterSpacing: -0.2,
  } satisfies TextStyle,

  pageTitle: {
    fontSize: ScreenUI.pageTitleSize,
    fontWeight: "800",
    color: ScreenUI.textPrimary,
    letterSpacing: -0.3,
  } satisfies TextStyle,

  sectionTitle: {
    fontSize: ScreenUI.sectionTitleSize,
    fontWeight: "700",
    color: ScreenUI.textPrimary,
    letterSpacing: -0.1,
  } satisfies TextStyle,

  body: {
    fontSize: ScreenUI.bodySize,
    lineHeight: 20,
    color: ScreenUI.textSecondary,
  } satisfies TextStyle,

  caption: {
    fontSize: 12,
    lineHeight: 16,
    color: ScreenUI.textSecondary,
  } satisfies TextStyle,

  screenContent: {
    padding: ScreenUI.pagePaddingHorizontal,
    paddingBottom: ScreenUI.pagePaddingBottom,
  } satisfies ViewStyle,

  heading: {
    fontSize: ScreenUI.pageTitleSize,
    fontWeight: "800",
  } satisfies TextStyle,

  subheading: {
    fontSize: Typography.fontSize.base,
    lineHeight: 20,
    color: ScreenUI.textSecondary,
  } satisfies TextStyle,

  card: {
    backgroundColor: ScreenUI.card,
    borderRadius: ScreenUI.radius,
    padding: ScreenUI.cardPadding,
    marginBottom: Spacing.md,
    shadowColor: ScreenUI.shadowColor,
    shadowOffset: ScreenUI.shadowOffset,
    shadowOpacity: ScreenUI.shadowOpacity,
    shadowRadius: ScreenUI.shadowRadius,
    elevation: ScreenUI.elevation,
  } satisfies ViewStyle,

  cardOutline: {
    borderWidth: 1,
    borderColor: ScreenUI.border,
  } satisfies ViewStyle,

  button: {
    minHeight: ScreenUI.buttonHeight,
    borderRadius: ScreenUI.radius,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  } satisfies ViewStyle,

  primaryButton: {
    minHeight: ScreenUI.buttonHeight,
    borderRadius: ScreenUI.radius,
    backgroundColor: ScreenUI.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  } satisfies ViewStyle,

  secondaryButton: {
    minHeight: ScreenUI.buttonHeight,
    borderRadius: ScreenUI.radius,
    backgroundColor: "#F2F6FC",
    borderWidth: 1,
    borderColor: ScreenUI.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  } satisfies ViewStyle,

  buttonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: "700",
  } satisfies TextStyle,

  input: {
    minHeight: ScreenUI.inputHeight,
    borderWidth: 1,
    borderColor: ScreenUI.border,
    borderRadius: ScreenUI.radius,
    backgroundColor: ScreenUI.card,
    paddingHorizontal: Spacing.md,
    color: ScreenUI.textPrimary,
  } satisfies TextStyle & ViewStyle,

  inputText: {
    fontSize: Typography.fontSize.base,
    color: ScreenUI.textPrimary,
  } satisfies TextStyle,

  shadow: {
    shadowColor: ScreenUI.shadowColor,
    shadowOffset: ScreenUI.shadowOffset,
    shadowOpacity: ScreenUI.shadowOpacity,
    shadowRadius: ScreenUI.shadowRadius,
    elevation: ScreenUI.elevation,
  } satisfies ViewStyle,

  stateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ScreenUI.pagePaddingHorizontal,
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  } satisfies ViewStyle,

  centeredState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: ScreenUI.pagePaddingHorizontal,
  } satisfies ViewStyle,
};
