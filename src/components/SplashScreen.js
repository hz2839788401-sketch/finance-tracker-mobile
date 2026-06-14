import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function SplashScreen() {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.72)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(ring, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(ring, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
        ])
      )
    ]).start();
  }, [fade, ring, scale, slide]);

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View style={styles.root}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />
      <Animated.View style={[styles.hero, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={styles.iconWrap}>
          <Animated.View style={[styles.pulseRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
          <Animated.View style={[styles.iconCircle, { transform: [{ scale }] }]}>
            <Ionicons name="wallet" size={42} color="#ffffff" />
          </Animated.View>
        </View>
        <Text style={styles.title}>Finance Tracker</Text>
        <Text style={styles.subtitle}>本地记账 · 通知解析 · 待确认入账</Text>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  opacity: ring.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: index === 0 ? [0.35, 1, 0.35] : index === 1 ? [0.6, 0.35, 1] : [1, 0.6, 0.35]
                  })
                }
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Platform.OS === "android" ? 24 : 0
  },
  bgOrbTop: {
    position: "absolute",
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#2563eb",
    opacity: 0.22
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -60,
    left: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#059669",
    opacity: 0.18
  },
  hero: { alignItems: "center", paddingHorizontal: 24 },
  iconWrap: { width: 120, height: 120, alignItems: "center", justifyContent: "center", marginBottom: 22 },
  pulseRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#93c5fd"
  },
  iconCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563eb",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8
  },
  title: { color: "#f8fafc", fontSize: 30, fontWeight: "900", letterSpacing: 0.3 },
  subtitle: { color: "#cbd5e1", fontSize: 14, marginTop: 8, fontWeight: "600" },
  dotsRow: { flexDirection: "row", gap: 8, marginTop: 28 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#93c5fd" }
});
