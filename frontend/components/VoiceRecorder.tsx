import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { BorderRadius, Colors, Typography } from "../constants/theme";

type VoiceRecorderProps = {
  onRecorded: (uri: string) => void;
  disabled?: boolean;
};

export function VoiceRecorder({
  onRecorded,
  disabled = false,
}: VoiceRecorderProps) {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isStoppingRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestAudioPermission = useCallback(async () => {
    const current = await Audio.getPermissionsAsync();
    if (current.granted) {
      return true;
    }

    const requested = await Audio.requestPermissionsAsync();
    return requested.granted;
  }, []);

  const startRecording = useCallback(async () => {
    if (isBusy || isRecording || disabled || isStoppingRef.current) {
      return;
    }

    try {
      setIsBusy(true);
      setError(null);

      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        setError("Microphone permission is required.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      await nextRecording.startAsync();

      setRecordedUri(null);
      recordingRef.current = nextRecording;
      setRecording(nextRecording);
      setIsRecording(true);
    } catch {
      setError("Could not start recording. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }, [disabled, isBusy, isRecording, requestAudioPermission]);

  const stopRecording = useCallback(
    async (fromUnmount = false) => {
      const activeRecording = recordingRef.current;
      if (!activeRecording || isStoppingRef.current) {
        return;
      }

      isStoppingRef.current = true;

      try {
        if (!fromUnmount) {
          setIsBusy(true);
          setError(null);
        }

        if (activeRecording) {
          try {
            await activeRecording.stopAndUnloadAsync();
          } catch {
            console.log("Already stopped");
          }
        }

        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
          });
        } catch {
          // Ignore audio mode reset issues during teardown.
        }

        const uri = activeRecording.getURI();
        recordingRef.current = null;
        setRecording(null);
        setIsRecording(false);

        if (!fromUnmount && uri) {
          // Expo returns a local file URI from the device cache.
          setRecordedUri(uri);
          onRecorded(uri);
        } else if (!fromUnmount) {
          setError("Recording finished but no file URI was generated.");
        }
      } catch {
        if (!fromUnmount && !isUnmountedRef.current) {
          setError("Could not stop recording. Please try again.");
        }
      } finally {
        isStoppingRef.current = false;
        if (!fromUnmount && !isUnmountedRef.current) {
          setIsBusy(false);
        }
      }
    },
    [onRecorded],
  );

  useEffect(() => {
    isUnmountedRef.current = false;

    return () => {
      isUnmountedRef.current = true;
      void stopRecording(true);
    };
  }, [stopRecording]);

  const buttonLabel = useMemo(() => {
    if (isBusy) {
      return "Working...";
    }

    return isRecording ? "Stop Recording" : "Start Recording";
  }, [isBusy, isRecording]);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => {
          if (isRecording) {
            void stopRecording();
            return;
          }

          void startRecording();
        }}
        disabled={disabled || isBusy || isStoppingRef.current}
        style={[
          styles.micButton,
          isRecording && styles.micButtonRecording,
          (disabled || isBusy || isStoppingRef.current) &&
            styles.disabledButton,
        ]}
      >
        {isBusy ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <MaterialCommunityIcons
            name={isRecording ? "stop-circle-outline" : "microphone"}
            size={20}
            color={isRecording ? "#FFFFFF" : Colors.primary}
          />
        )}
        <Text
          style={[
            styles.micButtonText,
            isRecording && styles.micButtonTextRecording,
          ]}
        >
          {buttonLabel}
        </Text>
      </Pressable>

      <View style={styles.statusRow}>
        <View style={[styles.statusDot, isRecording && styles.statusDotLive]} />
        <Text style={styles.statusText}>
          {isRecording ? "Recording in progress" : "Recorder idle"}
        </Text>
      </View>

      {recordedUri ? (
        <Text style={styles.uriText}>Saved audio URI: {recordedUri}</Text>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    gap: 8,
  },
  micButton: {
    minHeight: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#F2F6FC",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
  },
  micButtonRecording: {
    backgroundColor: "#D92D20",
    borderColor: "#D92D20",
  },
  micButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: "700",
    color: Colors.primary,
  },
  micButtonTextRecording: {
    color: "#FFFFFF",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#98A2B3",
  },
  statusDotLive: {
    backgroundColor: "#D92D20",
  },
  statusText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  uriText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    color: "#B42318",
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.7,
  },
});
