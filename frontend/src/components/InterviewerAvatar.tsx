import React, { useMemo, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { colors, font, spacing } from "@/src/theme";

type AnyPerson = {
  name?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  profileImageUrl?: string | null;
  avatarUrl?: string | null;
  photoUrl?: string | null;
};

function clean(v?: string | null): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

export function getPersonImageUrl(person?: AnyPerson | null): string | undefined {
  return clean(person?.profileImageUrl) || clean(person?.imageUrl) || clean(person?.avatarUrl) || clean(person?.photoUrl);
}

function initials(name?: string | null): string {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

export function InterviewerAvatar({ person, size = 48, label = "Open interviewer image" }: { person?: AnyPerson | null; size?: number; label?: string }) {
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getPersonImageUrl(person);
  const showImage = Boolean(imageUrl && !imageFailed);
  const letters = useMemo(() => initials(person?.name), [person?.name]);
  const radius = size / 2;

  return (
    <>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={[styles.avatar, { width: size, height: size, borderRadius: radius }]}
        testID="interviewer-avatar"
      >
        {showImage ? (
          <Image source={{ uri: imageUrl }} style={[styles.image, { width: size, height: size, borderRadius: radius }]} onError={() => setImageFailed(true)} />
        ) : (
          <View style={[styles.placeholder, { width: size, height: size, borderRadius: radius }]}> 
            {letters !== "?" ? <Text style={[styles.initials, { fontSize: Math.max(13, size * 0.34) }]}>{letters}</Text> : <Feather name="user" size={Math.max(18, size * 0.45)} color={colors.textSecondary} />}
          </View>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.modalCard}>
            <Pressable onPress={() => setOpen(false)} hitSlop={12} style={styles.close} testID="interviewer-avatar-close">
              <Feather name="x" size={22} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.largeWrap}>
              {showImage ? (
                <Image source={{ uri: imageUrl }} style={styles.largeImage} resizeMode="cover" onError={() => setImageFailed(true)} />
              ) : (
                <View style={styles.largePlaceholder}>
                  {letters !== "?" ? <Text style={styles.largeInitials}>{letters}</Text> : <Feather name="user" size={54} color={colors.textSecondary} />}
                </View>
              )}
            </View>
            {person?.name ? <Text style={styles.name}>{person.name}</Text> : null}
            {person?.title ? <Text style={styles.title}>{person.title}</Text> : null}
            <Text style={styles.note}>{showImage ? "Public profile image preview" : "Profile image unavailable — using safe initials placeholder"}</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: { overflow: "hidden", backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  image: { backgroundColor: colors.surfaceRaised },
  placeholder: { backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  initials: { color: colors.textPrimary, fontWeight: font.bold, letterSpacing: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.78)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  modalCard: { width: "100%", maxWidth: 360, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 24, padding: spacing.xl, alignItems: "center" },
  close: { position: "absolute", top: spacing.md, right: spacing.md, zIndex: 2, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  largeWrap: { width: 168, height: 168, borderRadius: 84, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, marginTop: spacing.md },
  largeImage: { width: 168, height: 168 },
  largePlaceholder: { width: 168, height: 168, borderRadius: 84, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  largeInitials: { color: colors.textPrimary, fontSize: 54, fontWeight: font.bold, letterSpacing: 1 },
  name: { color: colors.textPrimary, fontSize: font.h3, fontWeight: font.bold, textAlign: "center", marginTop: spacing.lg },
  title: { color: colors.textSecondary, fontSize: font.small, textAlign: "center", marginTop: 4 },
  note: { color: colors.textMuted, fontSize: font.tiny, textAlign: "center", marginTop: spacing.md },
});
