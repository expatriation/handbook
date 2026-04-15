import { PageShell } from '../components/pageShell';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../utils/appContext';
import DirTree, { LeafSelection } from '../components/dirTree';
import MemoFeed, { FeedHandoff } from '../components/memoFeed';
import { IonIcon, useIonModal } from '@ionic/react';
import { addCircleOutline } from 'ionicons/icons';
import Send from './send';
import { indexTransactionsToGraph } from '../utils/indexer';
import { Transaction } from '../utils/appTypes';

const toDisplayPath = (value: string) => {
  const trimmedValue = value.replace(/0+=+$/g, '');
  return trimmedValue || '/';
};

const buildPathSegments = (value: string) => {
  const normalized = toDisplayPath(value);
  if (normalized === '/') {
    return [];
  }

  const parts = normalized.split('/').filter(Boolean);
  let currentPath = '/';

  return parts.map((segment) => {
    currentPath = `${currentPath}${segment}/`;
    return {
      label: segment,
      value: currentPath,
    };
  });
};

const Explore = () => {
  const {
    graph,
    setGraph,
    tipHeader,
    navigatorPublicKey,
    setNavigatorPublicKey,
    transactionRange,
    requestPkTransactions,
  } =
    useContext(AppContext);

  const [mode, setMode] = useState<'feed' | 'tree'>('feed');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fetchStartHeight, setFetchStartHeight] = useState<number>(0);
  const [canLoadMore, setCanLoadMore] = useState<boolean>(true);
  const [focusHandoff, setFocusHandoff] = useState<FeedHandoff | null>(null);
  const [treeSubFeedContext, setTreeSubFeedContext] = useState<LeafSelection | null>(null);
  const [peekGraphKey, setPeekGraphKey] = useState<string>('/');
  const whichKey = useMemo(() => toDisplayPath(peekGraphKey), [peekGraphKey]);
  const clickableSegments = useMemo(() => buildPathSegments(whichKey), [whichKey]);

  const [presentSendModal, dismissSend] = useIonModal(Send, {
    onDismiss: (data: string, role: string) => dismissSend(data, role),
    forKey: whichKey,
  });

  const fetchTransactions = useCallback((
    startHeight: number,
    endHeight: number,
    replace: boolean,
  ) => {
    if (!navigatorPublicKey) {
      return;
    }

    requestPkTransactions(
      navigatorPublicKey,
      (nextTransactions) => {
        setTransactions((previous) =>
          replace ? nextTransactions : [...previous, ...nextTransactions],
        );
        setCanLoadMore(nextTransactions.length >= transactionRange.limit);
      },
      {
        startHeight,
        endHeight,
        limit: transactionRange.limit,
      },
    );
  }, [navigatorPublicKey, requestPkTransactions, transactionRange.limit]);

  useEffect(() => {
    let cleanup = () => {};
    const timeoutId = window.setTimeout(() => {
      if (!navigatorPublicKey) {
        setGraph(null);
        setTransactions([]);
        setCanLoadMore(false);
        return;
      }

      const latestStartHeight = tipHeader?.header.height
        ? tipHeader.header.height + 1
        : transactionRange.startHeight;
      setFetchStartHeight(latestStartHeight);
      cleanup =
        requestPkTransactions(
          navigatorPublicKey,
          (transactions) => {
            setTransactions(transactions);
            setCanLoadMore(transactions.length >= transactionRange.limit);
          },
          {
            startHeight: latestStartHeight,
            endHeight: 0,
            limit: transactionRange.limit,
          },
        ) ?? cleanup;
    }, 0);

    return () => {
      cleanup();
      window.clearTimeout(timeoutId);
    };
  }, [
    navigatorPublicKey,
    requestPkTransactions,
    setGraph,
    tipHeader?.header.height,
    transactionRange.endHeight,
    transactionRange.limit,
    transactionRange.startHeight,
  ]);

  useEffect(() => {
    const resultHandler = (data: any) => {
      if (whichKey && data.detail) {
        if (!navigatorPublicKey) {
          return;
        }
        requestPkTransactions(
          navigatorPublicKey,
          (transactions) => {
            setTransactions(transactions);
            setCanLoadMore(transactions.length >= transactionRange.limit);
          },
          {
            startHeight: tipHeader?.header.height ? tipHeader.header.height + 1 : transactionRange.startHeight,
            endHeight: 0,
            limit: transactionRange.limit,
          },
        );
      }
    };

    document.addEventListener('inv_block', resultHandler);

    return () => {
      document.removeEventListener('inv_block', resultHandler);
    };
  }, [
    navigatorPublicKey,
    requestPkTransactions,
    tipHeader?.header.height,
    transactionRange.endHeight,
    transactionRange.limit,
    transactionRange.startHeight,
    whichKey,
  ]);

  useEffect(() => {
    if (!navigatorPublicKey) {
      setGraph(null);
      return;
    }

    setGraph(indexTransactionsToGraph(transactions, navigatorPublicKey));
  }, [navigatorPublicKey, setGraph, transactions]);

  const loadMore = useCallback(() => {
    if (!canLoadMore) {
      return;
    }

    const nextEndHeight = fetchStartHeight - 1;
    const nextStartHeight = Math.max(1, nextEndHeight - transactionRange.limit + 1);
    setFetchStartHeight(nextStartHeight);
    fetchTransactions(nextStartHeight, nextEndHeight, false);
  }, [canLoadMore, fetchStartHeight, fetchTransactions, transactionRange.limit]);

  return (
    <PageShell
      tools={[
        {
          label: 'Send',
          renderIcon: () => <IonIcon
            slot="icon-only"
            icon={addCircleOutline}
          />,
          action: () => presentSendModal(),
        },
      ]}
      renderBody={() => (
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          {!!whichKey && (
            <>
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                  background: 'var(--ion-background-color)',
                  borderBottom: '1px solid var(--ion-color-step-150)',
                  padding: '8px 0',
                  marginBottom: 8,
                }}
              >
                <div style={{ fontFamily: 'monospace, monospace', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => {
                    setPeekGraphKey('/');
                    setTreeSubFeedContext(null);
                    if (mode === 'feed') {
                      setMode('tree');
                    }
                  }} style={{ border: 'none', background: 'transparent', color: 'var(--ion-color-primary)', textDecoration: 'underline' }}>
                    ..
                  </button>
                  <code>/</code>
                  {clickableSegments.map((segment, index) => (
                    <div key={segment.value} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button type="button" onClick={() => {
                        setPeekGraphKey(segment.value);
                        setTreeSubFeedContext(null);
                        if (mode === 'feed') {
                          setMode('tree');
                        }
                      }} style={{ border: 'none', background: 'transparent', color: 'var(--ion-color-primary)', textDecoration: 'underline' }}>
                        {segment.label}
                      </button>
                      {index < clickableSegments.length - 1 && <code>/</code>}
                    </div>
                  ))}
                </div>
              </div>
              {!!graph && (
                <div style={{ flex: 1, minHeight: 0 }}>
                  {mode === 'tree' && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        height: '100%',
                      }}
                    >
                      <div style={{ flex: treeSubFeedContext ? '0 0 45%' : '1 1 auto', minHeight: 0 }}>
                        <DirTree
                          forKey={whichKey}
                          nodes={graph.nodes ?? []}
                          links={graph.links ?? []}
                          setForKey={setPeekGraphKey}
                          onLeafOpen={(selection) => {
                            setMode('feed');
                            setFocusHandoff({
                              txId: selection.txId,
                              path: selection.path,
                              source: 'tree-leaf',
                            });
                            setPeekGraphKey(selection.path);
                            setTreeSubFeedContext(null);
                          }}
                          onOpenSubFeed={(selection) => {
                            setTreeSubFeedContext(selection);
                          }}
                        />
                      </div>
                      {treeSubFeedContext && (
                        <div style={{ flex: '1 1 55%', minHeight: 0 }}>
                          <MemoFeed
                            transactions={transactions}
                            onLoadMore={loadMore}
                            canLoadMore={canLoadMore}
                            focusHandoff={{
                              txId: treeSubFeedContext.txId,
                              path: treeSubFeedContext.path,
                              source: 'tree-leaf',
                            }}
                            filterPath={treeSubFeedContext.path}
                            onBackToMainFeed={(handoff) => {
                              setMode('feed');
                              setPeekGraphKey(handoff.path);
                              setFocusHandoff(handoff);
                              setTreeSubFeedContext(null);
                            }}
                            onSwitchNavigator={(nextKey) => {
                              setNavigatorPublicKey(nextKey);
                              setPeekGraphKey('/');
                              setMode('feed');
                              setTreeSubFeedContext(null);
                            }}
                            onActivePathChange={() => {}}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {mode === 'feed' && (
                    <MemoFeed
                      transactions={transactions}
                      onLoadMore={loadMore}
                      canLoadMore={canLoadMore}
                      focusHandoff={focusHandoff}
                      onFocusConsumed={() => setFocusHandoff(null)}
                      onSwitchNavigator={(nextKey) => {
                        setNavigatorPublicKey(nextKey);
                        setPeekGraphKey('/');
                        setMode('feed');
                        setTreeSubFeedContext(null);
                      }}
                      onActivePathChange={(path) => {
                        if (mode === 'feed') {
                          setPeekGraphKey(path ?? '/');
                        }
                      }}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    />
  );
};

export default Explore;
