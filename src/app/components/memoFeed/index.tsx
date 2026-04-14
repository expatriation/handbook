import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonText,
} from '@ionic/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Transaction } from '../../utils/appTypes';
import { getMemoContent } from '../../utils/memoContent';
import { transactionID } from '../../utils/compat';
import { inflateNodes } from '../../utils/indexer';

type FeedItem = Transaction & {
  txId: string;
};

type FeedEntry = {
  entryId: string;
  tx: FeedItem;
  kind: 'memo' | 'drill_in' | 'drill_out';
  path: string | null;
};

const normalizePath = (value?: string) => {
  if (!value?.startsWith('/')) {
    return null;
  }

  const compact = `${value.replace(/0+=+$/g, '').replace(/\/{2,}/g, '/')}`;
  if (compact === '/') {
    return '/';
  }

  return compact.endsWith('/') ? compact : `${compact}/`;
};

const isSpatialKey = (value?: string) => inflateNodes(value ?? "").isSpatial;

const byNewest = (a: FeedItem, b: FeedItem) => {
  const aSeries = a.series ?? 0;
  const bSeries = b.series ?? 0;

  if (aSeries !== bSeries) {
    return bSeries - aSeries;
  }

  if (a.time !== b.time) {
    return b.time - a.time;
  }

  return a.txId < b.txId ? 1 : -1;
};

const byEntryOrder = (a: FeedEntry, b: FeedEntry) => {
  const txnComparison = byNewest(a.tx, b.tx);
  if (txnComparison !== 0) {
    return txnComparison;
  }

  const rank = {
    memo: 0,
    drill_in: 1,
    drill_out: 2,
  } as const;

  return rank[a.kind] - rank[b.kind];
};

export const normalizeFeedTransactions = (transactions: Transaction[]) => {
  const unique = new Map<string, FeedItem>();

  transactions.forEach((transaction) => {
    const txId = transactionID(transaction);
    unique.set(txId, {
      ...transaction,
      txId,
    });
  });

  return Array.from(unique.values()).sort(byNewest).slice(0, 500);
};

const buildEntries = (transactions: Transaction[]) => {
  const entries: FeedEntry[] = [];

  normalizeFeedTransactions(transactions).forEach((tx) => {

    if (isSpatialKey(tx.to)) {
      
      entries.push({
        entryId: `${tx.txId}:memo`,
        tx,
        kind: 'memo',
        path: normalizePath(tx.to),
      });
    
    }else{

      if (tx.from && tx.to) {
        entries.push({
          entryId: `${tx.txId}:drill-in`,
          tx,
          kind: 'drill_in',
          path: null,
        });        
      }else if (tx.from) {

        entries.push({
          entryId: `${tx.txId}:drill-out`,
          tx,
          kind: 'drill_out',
          path: null,
        });

      }
    
    }
  });

  return entries.sort(byEntryOrder);
};

const MemoFeed = ({
  transactions,
  canLoadMore,
  onLoadMore,
  focusTransactionId,
  onSwitchNavigator,
  onActivePathChange,
}: {
  transactions: Transaction[];
  canLoadMore: boolean;
  onLoadMore: () => void;
  focusTransactionId?: string | null;
  onSwitchNavigator: (publicKey: string) => void;
  onActivePathChange: (path: string | null) => void;
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const loadRequestedForLengthRef = useRef<number>(-1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [renderedCount, setRenderedCount] = useState(1);

  const feedEntries = useMemo(() => buildEntries(transactions), [transactions]);

  useEffect(() => {
    setActiveIndex(0);
    setRenderedCount(1);
    loadRequestedForLengthRef.current = -1;
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [transactions]);

  useEffect(() => {
    const activeEntry = feedEntries[activeIndex];
    onActivePathChange(activeEntry?.path ?? null);
  }, [activeIndex, feedEntries, onActivePathChange]);

  useEffect(() => {
    if (!focusTransactionId || !scrollRef.current) {
      return;
    }

    const index = feedEntries.findIndex(
      (entry) => entry.tx.txId === focusTransactionId && entry.kind === 'memo',
    );
    if (index < 0) {
      return;
    }

    setRenderedCount((previous) => Math.max(previous, index + 1));
    const viewportHeight = scrollRef.current.clientHeight;
    scrollRef.current.scrollTo({ top: viewportHeight * index, behavior: 'smooth' });
    setActiveIndex(index);
  }, [feedEntries, focusTransactionId]);

  useEffect(() => {
    if (activeIndex >= renderedCount - 1 && renderedCount < feedEntries.length) {
      setRenderedCount((previous) => Math.min(feedEntries.length, previous + 1));
      return;
    }

    if (
      activeIndex >= feedEntries.length - 1 &&
      canLoadMore &&
      loadRequestedForLengthRef.current !== feedEntries.length
    ) {
      loadRequestedForLengthRef.current = feedEntries.length;
      onLoadMore();
    }
  }, [activeIndex, renderedCount, feedEntries.length, canLoadMore, onLoadMore]);

  const visibleEntries = feedEntries.slice(0, renderedCount);

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        const viewportHeight = event.currentTarget.clientHeight || 1;
        const index = Math.round(event.currentTarget.scrollTop / viewportHeight);
        if (index !== activeIndex) {
          setActiveIndex(index);
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        height: '100%',
        scrollSnapType: 'y mandatory',
      }}
    >
      {visibleEntries.map((entry, index) => {
        const { tx } = entry;
        const content = getMemoContent(tx.memo);
        const isFocused = index === activeIndex;

        return (
          <div
            key={entry.entryId}
            id={`feed-item-${entry.entryId}`}
            style={{
              scrollSnapAlign: 'start',
              minHeight: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <IonCard
              style={{
                margin: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
                <IonCardHeader>
                  <IonCardSubtitle><code>{tx.txId}</code></IonCardSubtitle>
                  {entry.kind !== 'memo' && (
                    <IonCardTitle>
                      <code>
                        from: {tx.from || 'n/a'}
                        <br /><br />
                        to: {tx.to || 'n/a'}
                        <br /> <br />time: {tx.time}
                        <br /><br />
                        series: {tx.series ?? 'n/a'}
                      </code>
                    </IonCardTitle>
                  )}
                </IonCardHeader>              
              <IonCardContent
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {entry.kind === 'drill_in' && (
                  <>
                    <IonText>
                      <p style={{ marginTop: 0 }}>Drill-in entry: switch to destination navigator key.</p>
                    </IonText>
                    <IonButton size="small" fill="outline" onClick={() => onSwitchNavigator(tx.to)}>
                      Drill in
                    </IonButton>
                  </>
                )}

                {entry.kind === 'drill_out' && (
                  <>
                    <IonText>
                      <p style={{ marginTop: 0 }}>Drill-out entry: switch to source navigator key.</p>
                    </IonText>
                    <IonButton
                      size="small"
                      fill="outline"
                      onClick={() => onSwitchNavigator(tx.from as string)}
                    >
                      Drill out
                    </IonButton>
                  </>
                )}

                {entry.kind === 'memo' && (
                  <>
                    {content.type === 'empty' && (
                      <IonText color="medium">
                        <p style={{ margin: 0, fontSize: 12 }}>{content.text}</p>
                      </IonText>
                    )}

                    {content.type === 'text' && (
                      <IonText>
                        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{content.text}</p>
                      </IonText>
                    )}

                    {content.type === 'url' &&
                      (isFocused ? (
                        <iframe
                          title="Memo web content"
                          src={content.url}
                          style={{
                            width: '100%',
                            height: '100%',
                            flex: 1,
                            minHeight: 0,
                            border: 'none',
                            borderRadius: 8,
                          }}
                          referrerPolicy="strict-origin-when-cross-origin"
                          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                        />
                      ) : (
                        <IonText color="medium">
                          <p style={{ margin: 0, fontSize: 12 }}>Focus this card to load remote content.</p>
                        </IonText>
                      ))}

                    {content.type === 'youtube' &&
                      (isFocused ? (
                        <div
                          style={{
                            position: 'relative',
                            width: '100%',
                            paddingBottom: '177.78%',
                          }}
                        >
                          <iframe
                            title="Memo YouTube short"
                            src={`https://www.youtube.com/embed/${content.videoId}?autoplay=1&mute=1&playsinline=1`}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              border: 'none',
                            }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <IonText color="medium">
                          <p style={{ margin: 0, fontSize: 12 }}>Focus this card to load video content.</p>
                        </IonText>
                      ))}
                  </>
                )}
              </IonCardContent>
            </IonCard>
          </div>
        );
      })}
    </div>
  );
};

export default MemoFeed;
