/**
 * TalkieGenZ audio: the microphone, and how loudly it is being heard.
 *
 * Nothing here records. There is no MediaRecorder, no buffer kept around
 * and nowhere for audio to go except straight out of the WebRTC connection
 * to the other people in the room.
 */

/**
 * Voice, not music. One channel is half the bytes of two and carries a
 * person perfectly well, and the three processing flags are the ones that
 * make a phone speaker in a noisy room bearable to listen to.
 */
export const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  },
  video: false,
};

/**
 * Opus sounds fine for speech well below what WebRTC would use by default,
 * and in a mesh this number is paid once per listener. 24 kbps keeps a full
 * room inside roughly 120 kbps of upload for whoever is talking.
 */
export const MAX_AUDIO_BITRATE = 24_000;

/** Is there a microphone and a peer connection to be had at all? */
export function supportsVoiceChat(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof window !== "undefined" &&
    typeof window.RTCPeerConnection === "function"
  );
}

/**
 * Loudness of a slice of the waveform, 0 to 1.
 *
 * Browsers hand back time-domain samples as bytes centred on 128, so the
 * distance from that centre is the signal.
 */
export function rmsLevel(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const deviation = (samples[i] - 128) / 128;
    sum += deviation * deviation;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Turns a raw level into something worth drawing. Speech sits low in the
 * range, so it is lifted; otherwise the meter barely twitches while someone
 * is talking perfectly audibly.
 */
export function meterValue(level: number, gain = 3.2): number {
  return Math.max(0, Math.min(1, level * gain));
}

/**
 * Meters that follow the waveform exactly look like static. Rising fast and
 * falling slowly is what makes a level meter readable.
 */
export function smoothLevel(previous: number, next: number): number {
  return next > previous ? next : previous * 0.82 + next * 0.18;
}

/** Whether a level is loud enough to call "they are actually saying something". */
export function isAudible(level: number): boolean {
  return level > 0.045;
}

/**
 * Caps what the microphone costs to send.
 *
 * Safari has been known to refuse setParameters outright, and a room that
 * works at a higher bitrate is better than no room, so a failure here is
 * deliberately not an error.
 */
export async function capBitrate(
  connection: RTCPeerConnection,
  maxBitrate = MAX_AUDIO_BITRATE,
): Promise<boolean> {
  try {
    const sender = connection.getSenders().find((s) => s.track?.kind === "audio");
    if (!sender) return false;
    const parameters = sender.getParameters();
    parameters.encodings = parameters.encodings?.length
      ? parameters.encodings.map((encoding) => ({ ...encoding, maxBitrate }))
      : [{ maxBitrate }];
    await sender.setParameters(parameters);
    return true;
  } catch {
    return false;
  }
}

/** Opens the microphone muted, so joining a room never puts you on air. */
export async function openMicrophone(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
  setTransmitting(stream, false);
  return stream;
}

/**
 * The push-to-talk switch itself.
 *
 * A disabled track stays connected but carries silence, which is why
 * letting go of the button is instant and why holding it again does not
 * have to renegotiate anything.
 */
export function setTransmitting(stream: MediaStream | null, on: boolean): void {
  stream?.getAudioTracks().forEach((track) => {
    track.enabled = on;
  });
}

export function isTransmitting(stream: MediaStream | null): boolean {
  return stream?.getAudioTracks().some((track) => track.enabled) ?? false;
}

/** Stops the microphone for real, so the browser's recording light goes out. */
export function closeMicrophone(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Plain language for the ways a browser refuses a microphone. */
export function describeMicError(error: unknown): string {
  const name = (error as { name?: string })?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Your browser blocked the microphone. Allow it for this site — usually the padlock or camera icon in the address bar — then try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone was found. Plug one in, or check that another app has not taken it over.";
    case "NotReadableError":
      return "Another app is holding the microphone. Close it — a call or a recorder is the usual culprit — and try again.";
    case "AbortError":
      return "The microphone stopped responding. Try again.";
    default:
      return "The microphone could not be opened, so there is nothing to transmit. Check your browser's site permissions and try again.";
  }
}
