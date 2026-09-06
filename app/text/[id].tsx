import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppBar, AppBarAction } from '@/components/AppBar';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { isOcrAvailable, joinPages, recognizeDocument, type PageText } from '@/lib/ocr';
import { useDocuments } from '@/store/documents';
import { font, radius, space, useTheme } from '@/theme';

export default function TextScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();

  const document = useDocuments((state) => state.documents.find((entry) => entry.id === id));
  const setPageTexts = useDocuments((state) => state.setPageTexts);

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const available = isOcrAvailable();
  // `undefined` text means the page has never been read. Once every page has
  // been read the store itself tells us we're done — there is no separate
  // "finished" flag to keep in sync.
  const pending = (document?.pages ?? []).some((page) => page.text === undefined);
  const working = pending && available && error === null;

  const cached: PageText[] = (document?.pages ?? []).map((page, index) => ({
    pageId: page.id,
    index,
    text: page.text ?? '',
  }));
  const body = joinPages(cached);

  const documentId = document?.id;

  useEffect(() => {
    if (!documentId || !pending || !available) return;

    let cancelled = false;
    const target = useDocuments.getState().documents.find((entry) => entry.id === documentId);
    if (!target) return;

    recognizeDocument(target, (done, total) => {
      if (!cancelled) setProgress({ done, total });
    })
      .then((results) => {
        if (cancelled) return;
        setPageTexts(
          documentId,
          results.map(({ pageId, text }) => ({ pageId, text }))
        );
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
      });

    return () => {
      cancelled = true;
    };
  }, [documentId, pending, available, setPageTexts]);

  if (!document) {
    return (
      <Screen>
        <AppBar title="Text" onBack={() => router.back()} />
        <EmptyState
          icon="document-outline"
          title="Document not found"
          message="It may have been deleted."
        />
      </Screen>
    );
  }

  const copy = async () => {
    await Clipboard.setStringAsync(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const renderBody = () => {
    if (error !== null) {
      return (
        <EmptyState icon="alert-circle-outline" title="Couldn't read this" message={error} />
      );
    }

    if (pending && !available) {
      return (
        <EmptyState
          icon="warning-outline"
          title="Text recognition unavailable"
          message="This feature needs the native module, which isn't in this build. Run a development or production build to use it."
        />
      );
    }

    if (working) {
      return (
        <View style={styles.centre}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[font.body, { color: theme.textMuted }]}>
            Reading page {Math.min((progress?.done ?? 0) + 1, document.pages.length)} of{' '}
            {document.pages.length}…
          </Text>
        </View>
      );
    }

    if (body.length === 0) {
      return (
        <EmptyState
          icon="text-outline"
          title="No text found"
          message="Nothing readable was recognised on these pages. A sharper, better-lit scan usually helps."
        />
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text selectable style={[font.body, styles.body, { color: theme.text }]}>
          {body}
        </Text>
        <Text style={[font.caption, { color: theme.textFaint }]}>
          Recognised on this device. Accuracy depends on the scan — check anything important.
        </Text>
      </ScrollView>
    );
  };

  return (
    <Screen>
      <AppBar
        title="Extracted text"
        subtitle={document.name}
        onBack={() => router.back()}
        right={
          !working && body.length > 0 ? (
            <AppBarAction
              icon={copied ? 'checkmark' : 'copy-outline'}
              label="Copy text"
              tint={copied ? theme.accent : undefined}
              onPress={copy}
            />
          ) : undefined
        }
      />
      {renderBody()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  body: { lineHeight: 23, padding: space.md, borderRadius: radius.md },
});
