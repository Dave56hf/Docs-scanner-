import * as LocalAuthentication from 'expo-local-authentication';

export type LockCapability = {
  available: boolean;
  /** What the device will actually prompt with, for honest setting copy. */
  label: string;
};

/**
 * Reports whether the device can gate the app at all. Enrolment matters as much
 * as hardware: a phone with a fingerprint reader and no enrolled finger would
 * otherwise let the user switch on a lock that never engages.
 */
export async function lockCapability(): Promise<LockCapability> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      return { available: false, label: 'No screen lock set up on this device' };
    }

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return { available: true, label: 'Face recognition' };
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return { available: true, label: 'Fingerprint' };
    }
    return { available: true, label: 'Device passcode' };
  } catch {
    return { available: false, label: 'Unavailable' };
  }
}

/** Prompts for biometrics, falling back to the device passcode. */
export async function authenticate(reason = 'Unlock Scanly'): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      // Never silently let someone in because biometrics failed — the passcode
      // is the fallback, not an open door.
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
