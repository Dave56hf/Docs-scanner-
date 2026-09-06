import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * The native scanner (ML Kit on Android, VisionKit on iOS) is a TurboModule, so
 * importing it eagerly throws in Expo Go where the native side isn't linked.
 * Resolving it lazily lets the app fall back to the photo library instead of
 * crashing on launch.
 */
type NativeScanner = {
  scanDocument: (options: {
    croppedImageQuality?: number;
    maxNumDocuments?: number;
  }) => Promise<{ scannedImages?: string[]; status?: string }>;
};

let cached: NativeScanner | null | undefined;

function nativeScanner(): NativeScanner | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('react-native-document-scanner-plugin');
    cached = (module?.default ?? module) as NativeScanner;
  } catch {
    cached = null;
  }
  return cached;
}

export function isNativeScannerAvailable(): boolean {
  return nativeScanner() !== null;
}

/** Android and iOS hand back bare paths in some versions; normalise to a URI. */
function toUri(path: string): string {
  if (path.startsWith('file://') || path.startsWith('content://')) return path;
  return `file://${path}`;
}

export type CaptureResult =
  | { status: 'success'; uris: string[] }
  | { status: 'cancelled' }
  | { status: 'unavailable' };

/**
 * Opens the platform document scanner: live edge detection, perspective
 * correction and multi-page capture, all handled natively.
 */
export async function scanWithCamera(maxNumDocuments?: number): Promise<CaptureResult> {
  const scanner = nativeScanner();
  if (!scanner) return { status: 'unavailable' };

  const response = await scanner.scanDocument({
    croppedImageQuality: 100,
    // The option is Android-only; passing it on iOS is harmless but pointless.
    ...(Platform.OS === 'android' && maxNumDocuments ? { maxNumDocuments } : {}),
  });

  const uris = (response.scannedImages ?? []).map(toUri);
  if (response.status === 'cancel' || uris.length === 0) return { status: 'cancelled' };
  return { status: 'success', uris };
}

/** Import existing photos — the fallback path, and useful in its own right. */
export async function pickFromLibrary(): Promise<CaptureResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'unavailable' };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 1,
    exif: false,
  });

  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  return { status: 'success', uris: result.assets.map((asset) => asset.uri) };
}

/** Plain camera capture, used when the native scanner isn't linked in. */
export async function captureWithSystemCamera(): Promise<CaptureResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: 'unavailable' };

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
  });

  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  return { status: 'success', uris: result.assets.map((asset) => asset.uri) };
}
