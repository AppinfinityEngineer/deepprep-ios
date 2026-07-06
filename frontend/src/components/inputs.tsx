import React from "react";
import { Text, View, TextInput, StyleSheet, TextInputProps } from "react-native";
import { colors, spacing, radius, font } from "../theme";

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  testID,
  ...rest
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  testID?: string;
} & TextInputProps) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        {...rest}
      />
    </View>
  );
}

export function TextArea({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength = 12000,
  testID,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  maxLength?: number;
  testID?: string;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={maxLength}
        style={[styles.input, styles.area]}
        textAlignVertical="top"
      />
      <Text style={styles.counter}>
        {value.length}/{maxLength} chars
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textSecondary, fontSize: font.small, marginBottom: spacing.sm, fontWeight: font.medium },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: font.body,
    minHeight: 52,
  },
  area: { minHeight: 140, paddingTop: spacing.md },
  counter: { color: colors.textMuted, fontSize: font.tiny, marginTop: spacing.xs, textAlign: "right" },
});
