import React, { useMemo, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { colors, font, radius, spacing } from "@/src/theme";

type PersonLike = {
  name?: string | null;
  profileImageUrl?: string | null;
  imageUrl?: string | null;
  avatarUrl?: string | null;
  photoUrl?: string | null;
  matchConfidence?: string | null;
  roleFreshness?: string | null;
  currentRoleStatus?: string | null;
};

type Props = {
  person?: PersonLike | null;
  name?: string | null;
  profileImageUrl?: string | null;
  imageUrl?: string | null;
  avatarUrl?: string | null;
  photoUrl?: string | null;
  matchConfidence?: string | null;
  roleFreshness?: string | null;
  currentRoleStatus?: string | null;
  size?: number;
  label?: string;
  testID?: string;
};

function clean(value?: string | null): string {
  return (value || "").trim();
}

function initialsFor(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((p) => p[0]?.toUpperCase()).join("");
  return initials || "?";
}

function confidencePass(value?: string | null): boolean {
  const v = clean(value).toLowerCase();
  return v.includes("high") || v.includes("medium");
}

function freshnessPass(value?: string | null): boolean {
  const v = clean(value).toLowerCase();
  return v.includes("high") || v.includes("medium");
}

function statusPass(value?: string | null): boolean {
  const v = clean(value).toLowerCase();
  if (!v) return false;
  return !v.includes("unknown") && !v.includes("conflict");
}

function safeImageUrl(value?: string | null): string {
  const url = clean(value);
  if (!/^https:\/\//i.test(url)) return "";
  return url;
}

export function shouldShowInterviewerImage(person?: PersonLike | null): boolean {
  if (!person) return false;
  const image = safeImageUrl(person.profileImageUrl || person.imageUrl || person.avatarUrl || person.photoUrl);
  return Boolean(image) && confidencePass(person.matchConfidence) && freshnessPass(person.roleFreshness) && statusPass(person.currentRoleStatus);
}

export function InterviewerAvatar({ person, size = 48, testID, label, ...explicit }: Props) {
  const merged: PersonLike = { ...(person || {}), ...explicit };
  const name = clean(merged.name) || "Interviewer";
  const imageUrl = safeImageUrl(merged.profileImageUrl || merged.imageUrl || merged.avatarUrl || merged.photoUrl);
  const showImage = shouldShowInterviewerImage(merged);
  const [open, setOpen] = useState(false);

  const avatarStyle = useMemo(
    () => [styles.avatar, { width: size, height: size, borderRadius: size / 2 }],
    [size]
  );
  const initialsStyle = useMemo(
    () => [styles.initials, { fontSize: Math.max(13, Math.round(size * 0.32)) }],
    [size]
  );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label || `Open ${name} image`}
        onPress={() => setOpen(true)}
        style={avatarStyle}
        testID={testID || "interviewer-avatar"}
      >
        {showImage ? (
          <Image source={{ uri: imageUrl }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />
        ) : (
          <Text style={initialsStyle}>{initialsFor(name)}</Text>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.close} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close image">
            <Feather name="x" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.modalCard}>
            {showImage ? (
              <Image source={{ uri: imageUrl }} style={styles.largeImage} resizeMode="cover" />
            ) : (
              <View style={styles.largePlaceholder}>
                <Text style={styles.largeInitials}>{initialsFor(name)}</Text>
              </View>
            )}
            <Text style={styles.name}>{name}</Text>
            {!showImage ? <Text style={styles.note}>Image withheld until the public match is strong enough.</Text> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { backgroundColor: colors.surfaceRaised },
  initials: { color: colors.textPrimary, fontWeight: font.bold },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  close: {
    position: "absolute",
    top: spacing.xxxl,
    right: spacing.xl,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  modalCard: { alignItems: "center", gap: spacing.md },
  largeImage: { width: 220, height: 220, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised },
  largePlaceholder: {
    width: 220,
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  largeInitials: { color: colors.textPrimary, fontSize: 64, fontWeight: font.bold },
  name: { color: colors.textPrimary, fontSize: font.h3, fontWeight: font.bold, textAlign: "center" },
  note: { color: colors.textMuted, fontSize: font.small, textAlign: "center", maxWidth: 260, lineHeight: 20 },
});
