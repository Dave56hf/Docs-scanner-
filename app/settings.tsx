import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { AppBar } from '@/components/AppBar';
import { Touchable } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { ActionSheet, type SheetAction } from '@/components/Sheet';
import { FILTERS, filterLabel } from '@/lib/filters';
import { formatBytes, usedBytes } from '@/lib/files';
import { isOcrAvailable } from '@/lib/ocr';
import { isNativeScannerAvailable } from '@/lib/scanner';
import { lockCapability } from '@/lib/lock';
import { PDF_QUALITY, type FilterId, type PageSize, type PdfQuality } from '@/lib/types';
import { useDocuments } from '@/store/documents';
import { useSettings, type ThemePreference } from '@/store/settings';
import { font, radius, space, useTheme } from '@/theme';

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Match device',
  light: 'Light',
  dark: 'Dark',
};

const PAGE_SIZE_LABELS: Record<PageSize, string> = {
  fit: 'Fit to scan',
  a4: 'A4',
  letter: 'US Letter',
};

type Sheet = 'theme' | 'filter' | 'pageSize' | 'quality' | null;

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const settings = useSettings();
  const documents = useDocuments((state) => state.documents);
  const folders = useDocuments((state) => state.folders);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [lock, setLock] = useState<{ available: boolean; label: string } | null>(null);

  // Asked once on mount: whether a screen lock exists is a device fact, not
  // something that changes while this screen is open.
  useEffect(() => {
    let cancelled = false;
    lockCapability().then((result) => {
      if (!cancelled) setLock(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const pageCount = documents.reduce((total, document) => total + document.pages.length, 0);
  // Read once per render rather than watching the filesystem; it only changes
  // as a result of actions taken on other screens.
  const storage = formatBytes(usedBytes());

  const sheets: Record<Exclude<Sheet, null>, { title: string; actions: SheetAction[] }> = {
    theme: {
      title: 'Appearance',
      actions: (Object.keys(THEME_LABELS) as ThemePreference[]).map((key) => ({
        icon: settings.theme === key ? 'radio-button-on' : 'radio-button-off',
        label: THEME_LABELS[key],
        onPress: () => settings.setTheme(key),
      })),
    },
    filter: {
      title: 'Filter for new scans',
      actions: FILTERS.map((entry) => ({
        icon: settings.defaultFilter === entry.id ? 'radio-button-on' : 'radio-button-off',
        label: entry.label,
        onPress: () => settings.setDefaultFilter(entry.id as FilterId),
      })),
    },
    quality: {
      title: 'PDF quality',
      actions: (Object.keys(PDF_QUALITY) as PdfQuality[]).map((key) => ({
        icon: settings.pdfQuality === key ? 'radio-button-on' : 'radio-button-off',
        label: PDF_QUALITY[key].label,
        hint: PDF_QUALITY[key].hint,
        onPress: () => settings.setPdfQuality(key),
      })),
    },
    pageSize: {
      title: 'PDF page size',
      actions: (Object.keys(PAGE_SIZE_LABELS) as PageSize[]).map((key) => ({
        icon: settings.pageSize === key ? 'radio-button-on' : 'radio-button-off',
        label: PAGE_SIZE_LABELS[key],
        hint: key === 'fit' ? 'Each PDF matches the shape of the first page' : undefined,
        onPress: () => settings.setPageSize(key),
      })),
    },
  };

  const active = sheet ? sheets[sheet] : null;

  return (
    <Screen>
      <AppBar title="Settings" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Scanning">
          <Row
            icon="color-filter-outline"
            label="Filter for new scans"
            value={filterLabel(settings.defaultFilter)}
            onPress={() => setSheet('filter')}
          />
          <Row
            icon="document-outline"
            label="PDF page size"
            value={PAGE_SIZE_LABELS[settings.pageSize]}
            onPress={() => setSheet('pageSize')}
          />
          <Row
            icon="resize-outline"
            label="PDF quality"
            value={PDF_QUALITY[settings.pdfQuality].label}
            onPress={() => setSheet('quality')}
          />
          <Toggle
            icon="text-outline"
            label="Read text automatically"
            hint="Makes new scans searchable by their contents"
            value={settings.autoRecognizeText}
            onChange={settings.setAutoRecognizeText}
          />
          <Toggle
            icon="sparkles-outline"
            label="Name scans from their content"
            hint="Uses the document's own heading instead of the date"
            value={settings.smartNaming}
            onChange={settings.setSmartNaming}
          />
        </Section>

        <Section title="Privacy">
          <Toggle
            icon="lock-closed-outline"
            label="Require unlock"
            hint={lock?.available ? lock.label : (lock?.label ?? 'Checking…')}
            value={settings.appLock}
            disabled={lock !== null && !lock.available}
            onChange={(next) => {
              if (next && lock && !lock.available) {
                Alert.alert(
                  'No screen lock',
                  'Set up a fingerprint, face unlock or passcode on this device first.'
                );
                return;
              }
              settings.setAppLock(next);
            }}
          />
        </Section>

        <Section title="Appearance">
          <Row
            icon="contrast-outline"
            label="Theme"
            value={THEME_LABELS[settings.theme]}
            onPress={() => setSheet('theme')}
          />
        </Section>

        <Section title="On this device">
          <Row icon="albums-outline" label="Documents" value={String(documents.length)} />
          <Row icon="folder-outline" label="Folders" value={String(folders.length)} />
          <Row icon="layers-outline" label="Pages" value={String(pageCount)} />
          <Row icon="save-outline" label="Storage used" value={storage} />
          <Row
            icon={isNativeScannerAvailable() ? 'scan-outline' : 'warning-outline'}
            label="Edge detection"
            value={isNativeScannerAvailable() ? 'Available' : 'Camera only'}
          />
          <Row
            icon={isOcrAvailable() ? 'text-outline' : 'warning-outline'}
            label="Text recognition"
            value={isOcrAvailable() ? 'Available' : 'Unavailable'}
          />
        </Section>

        <Text style={[font.caption, styles.footnote, { color: theme.textFaint }]}>
          {isNativeScannerAvailable()
            ? 'Scans never leave this device. There is no account and no upload.'
            : 'The native document scanner is not linked in this build, so scanning falls back to the plain camera. Run a development or production build to enable automatic edge detection.'}
        </Text>

        <Text style={[font.caption, styles.footnote, { color: theme.textFaint }]}>
          Scanly {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>

      <ActionSheet
        visible={active !== null}
        title={active?.title ?? ''}
        actions={active?.actions ?? []}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[font.label, { color: theme.textMuted }]}>{title.toUpperCase()}</Text>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>{children}</View>
    </View>
  );
}

function Toggle({
  icon,
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={19} color={theme.textMuted} />
      <View style={styles.rowLabel}>
        <Text style={[font.body, { color: disabled ? theme.textFaint : theme.text }]}>{label}</Text>
        {!!hint && <Text style={[font.caption, { color: theme.textFaint }]}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        // Without an explicit thumb colour Android falls back to its own
        // accent, which reads as a second brand colour sitting in our UI.
        trackColor={{ true: theme.accent, false: theme.border }}
        thumbColor={theme.surface}
        ios_backgroundColor={theme.border}
        accessibilityLabel={label}
      />
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  /** Omit to render a read-only informational row. */
  onPress?: () => void;
}) {
  const theme = useTheme();
  const body = (
    <>
      <Ionicons name={icon} size={19} color={theme.textMuted} />
      <Text style={[font.body, styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[font.body, { color: theme.textMuted }]}>{value}</Text>
      {onPress && <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />}
    </>
  );

  if (!onPress) return <View style={styles.row}>{body}</View>;

  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      onPress={onPress}
      style={styles.row}>
      {body}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl, paddingBottom: space.xxl },
  section: { gap: space.sm },
  card: { borderRadius: radius.md, paddingHorizontal: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  rowLabel: { flex: 1, gap: 2 },
  footnote: { lineHeight: 18 },
});
