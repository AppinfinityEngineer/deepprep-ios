import React, { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { colors, font, spacing } from "@/src/theme";

type ImageLike = {
  profileImageUrl?: string | null;
  imageUrl?: string | null;
  avatarUrl?: string | null;
  photoUrl?: string | null;
};

type PersonLike = ImageLike & {
  name?: string | null;
};

type Props = ImageLike & {
  name?: string;
  person?: PersonLike | null;
  size?: number;
  testID?: string;
  label?: string;
};

export function resolveInterviewerImageUrl(input?: ImageLike | null): string | undefined {
  const raw = input?.profileImageUrl || input?.imageUrl || input?.avatarUrl || input?.photoUrl || "";
  const clean = raw.trim();
  if (!clean || !/^https?:\/\//i.test(clean)) return undefined;
  return clean;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
}

export function InterviewerAvatar({ name, person, size = 48, testID, label, ...imageFields }: Props) {
  const [open, setOpen] = useState(false);
  const displayName = (name || person?.name || "Interviewer").trim() || "Interviewer";
  const imageUrl = resolveInterviewerImageUrl(person || imageFields);
  const radius = size / 2;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        testID={testID || "interviewer-avatar"}
        accessibilityRole="imagebutton"
        accessibilityLabel={label || `Open profile image for ${displayName}`}
        style={[styles.avatar, { width: size, height: size, borderRadius: radius }]}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={{ width: size, height: size, borderRadius: radius }} resizeMode="cover" />
        ) : (
          <Text style={[styles.initials, { fontSize: size <= 50 ? font.small : font.h3 }]}>{initials(displayName)}</Text>
        )}
      </Pressable>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.close} onPress={() => setOpen(false)} testID="avatar-modal-close">
            <Feather name="x" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.modalCard}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.largeImage} resizeMode="cover" />
            ) : (
              <View style={styles.largePlaceholder}>
                <Text style={styles.largeInitials}>{initials(displayName)}</Text>
              </View>
            )}
            <Text style={styles.modalName}>{displayName}</Text>
            <Text style={styles.modalHint}>{imageUrl ? "Public profile image preview" : "Image not available yet"}</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default InterviewerAvatar;

const styles = StyleSheet.create({
  avatar: {
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: colors.textPrimary, fontWeight: font.bold },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.86)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  close: {
    position: "absolute",
    top: 54,
    right: 24,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: { alignItems: "center", gap: spacing.md },
  largeImage: { width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: colors.border },
  largePlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  largeInitials: { color: colors.textPrimary, fontSize: 64, fontWeight: font.bold },
  modalName: { color: colors.textPrimary, fontSize: font.h3, fontWeight: font.bold, textAlign: "center" },
  modalHint: { color: colors.textSecondary, fontSize: font.small, textAlign: "center" },
});
