import { IonApp, setupIonicReact } from '@ionic/react';
import Explorer from './modals';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Theme variables */
import './theme/variables.css';
import { useState, useEffect } from 'react';

import { AppContext } from './utils/appContext';
import {
  Transaction,
  GraphLink,
  GraphNode,
  Block,
  BlockIdHeaderPair,
} from './utils/appTypes';
import { usePersistentState } from './useCases/usePersistentState';

import { useCallback } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { signTransaction } from './useCases/useAgent';
import {
  transactionID,
  socketEventListener,
} from './utils/compat';
import { DEFAULT_CRUZBIT_NODE } from './utils/constants';

setupIonicReact({ mode: 'md' });

interface InvBlockMessage {
  type: 'inv_block';
  body: { block_ids: string[] };
}

interface TipHeaderMessage {
  type: 'tip_header';
  body: BlockIdHeaderPair;
}

interface BlockMessage {
  type: 'block';
  body: { block: Block };
}

interface TransactionMessage {
  type: 'transaction';
  body: { transaction_id: string; transaction: Transaction };
}

interface PushTransactionResultMessage {
  type: 'push_transaction_result';
  body: { transaction_id: string; error: string };
}

interface PublicKeyTransactionsMessage {
  type: 'public_key_transactions';
  body: {
    public_key: string;
    filter_blocks?: Array<{ transactions: Transaction[] }>;
  };
}

interface FilterTransactionQueueMessage {
  type: 'filter_transaction_queue';
  body: { transactions: Transaction[] };
}

type SocketMessage =
  | InvBlockMessage
  | TipHeaderMessage
  | BlockMessage
  | TransactionMessage
  | PushTransactionResultMessage
  | PublicKeyTransactionsMessage
  | FilterTransactionQueueMessage;

const isSocketMessage = (value: unknown): value is SocketMessage => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as { type?: unknown; body?: unknown };
  return typeof message.type === 'string' && message.body !== undefined;
};

const App: React.FC = () => {
  const [selectedNode, setSelectedNode] = usePersistentState(
    'selected-node',
    DEFAULT_CRUZBIT_NODE,
  );

  const [publicKeys, setPublicKeys] = usePersistentState<string[][]>(
    'public-keys',
    [[]],
  );

  const [selectedKeyIndex, setSelectedKeyIndex] = usePersistentState<
    [number, number]
  >('selected-key-index', [0, 0]);

  const [tipHeader, setTipHeader] = useState<BlockIdHeaderPair>();
  const [currentBlock, setCurrentBlock] =
    usePersistentState<Block | null>('current-block', null);

  const [genesisBlock, setGenesisBlock] =
    usePersistentState<Block | null>('genesis-block', null);

  const [graph, setGraph] = usePersistentState<{
    nodes: GraphNode[];
    links: GraphLink[];
  } | null>('flow-graph', null);

  const [navigatorPublicKey, setNavigatorPublicKey] = usePersistentState(
    'navigator-public-key',
    '',
  );
  const [transactionRange, setTransactionRange] = usePersistentState(
    'navigator-transaction-range',
    {
      startHeight: 0,
      endHeight: 0,
      limit: 500,
    },
  );
  const [latestSocketResponse, setLatestSocketResponse] = useState<{
    receivedAt: string;
    payload: unknown;
    raw: string;
  } | null>(null);

  const { sendJsonMessage, readyState } = useWebSocket(
    `wss://${selectedNode}`,
    {
      protocols: ['cruzbit.1'],
      onOpen: () => console.log('opened', selectedNode),
      onError: () => console.log('errored', selectedNode),
      shouldReconnect: () => true,
      share: true,
      onMessage: (event) => {
        let parsedData: unknown;

        try {
          parsedData = JSON.parse(event.data);
        } catch {
          setLatestSocketResponse({
            receivedAt: new Date().toISOString(),
            payload: null,
            raw: event.data,
          });
          return;
        }

        if (!isSocketMessage(parsedData)) {
          setLatestSocketResponse({
            receivedAt: new Date().toISOString(),
            payload: parsedData,
            raw: event.data,
          });
          return;
        }

        const { type, body } = parsedData;

        setLatestSocketResponse({
          receivedAt: new Date().toISOString(),
          payload: parsedData,
          raw: event.data,
        });

        switch (type) {
          case 'inv_block':
            document.dispatchEvent(
              new CustomEvent<string[]>('inv_block', { detail: body.block_ids }),
            );
            requestTipHeader();
            break;
          case 'tip_header':
            setTipHeader(body);
            break;
          case 'block':
            if (body.block.header.height === 0) {
              setGenesisBlock(body.block);
            }
            setCurrentBlock(body.block);
            break;
          case 'transaction':
            document.dispatchEvent(
              new CustomEvent<{
                transaction_id: string;
                transaction: Transaction;
              }>('transaction', {
                detail: {
                  transaction_id: body.transaction_id,
                  transaction: body.transaction,
                },
              }),
            );

            break;
          case 'push_transaction_result':
            document.dispatchEvent(
              new CustomEvent<{
                transaction_id: string;
                error: string;
              }>('push_transaction_result', { detail: body }),
            );
            break;
          case 'public_key_transactions':
            document.dispatchEvent(
              new CustomEvent<{
                public_key: string;
                transactions: Transaction[];
              }>('public_key_transactions', {
                detail: {
                  public_key: body.public_key,
                  transactions: body.filter_blocks?.flatMap((i) => i.transactions) ?? [],
                },
              }),
            );
            break;
          case 'filter_transaction_queue':
            document.dispatchEvent(
              new CustomEvent<Transaction[]>('filter_transaction_queue', {
                detail: body.transactions,
              }),
            );
            break;
        }
      },
    },
  );

  const requestPeers = useCallback(() => {
    if (readyState !== ReadyState.OPEN) return;
    sendJsonMessage({
      type: 'get_peer_addresses',
    });
  }, [readyState, sendJsonMessage]);

  const requestBlockById = useCallback(
    (block_id: string) => {
      if (readyState !== ReadyState.OPEN) return;
      sendJsonMessage({
        type: 'get_block',
        body: { block_id },
      });
    },
    [readyState, sendJsonMessage],
  );

  const requestBlockByHeight = useCallback(
    (height: number) => {
      if (readyState !== ReadyState.OPEN) return;
      sendJsonMessage({
        type: 'get_block_by_height',
        body: { height },
      });
    },
    [readyState, sendJsonMessage],
  );

  const requestTipHeader = useCallback(() => {
    if (readyState !== ReadyState.OPEN) return;
    sendJsonMessage({ type: 'get_tip_header' });
  }, [readyState, sendJsonMessage]);

  const requestGraph = useCallback(
    (publicKeyB64: string = '') => {
      if (readyState !== ReadyState.OPEN) return;

      sendJsonMessage({
        type: 'get_graph',
        body: {
          public_key: publicKeyB64,
        },
      });
    },
    [readyState, sendJsonMessage],
  );

  const pushTransaction = async (
    to: string,
    memo: string,
    passphrase: string,
    selectedKeyIndex: [number, number],
    resultHandler: (data: { transaction_id: string; error: string }) => void,
  ) => {
    if (readyState !== ReadyState.OPEN) return;
    if (to && memo && tipHeader?.header.height && publicKeys.length) {
      const transaction = await signTransaction(
        to,
        memo,
        tipHeader?.header.height,
        selectedKeyIndex,
        passphrase,
      );

      if (!transaction) return;

      sendJsonMessage({
        type: 'push_transaction',
        body: {
          transaction,
        },
      });

      return socketEventListener<{
        transaction_id: string;
        error: string;
      }>('push_transaction_result', (data) => {
        if (transactionID(transaction) === data.transaction_id) {
          resultHandler(data);
        }
      });
    }
  };

  const requestTransaction = useCallback(
    (transaction_id: string, resultHandler: (transaction: Transaction) => void) => {
      if (readyState !== ReadyState.OPEN) return;
      sendJsonMessage({
        type: 'get_transaction',
        body: { transaction_id },
      });

      return socketEventListener<{
        transaction_id: string;
        transaction: Transaction;
      }>('transaction', (data) => {
        if (transactionID(data.transaction) === transaction_id) {
          resultHandler(data.transaction);
        }
      });
    },
    [readyState, sendJsonMessage],
  );

  const requestPkTransactions = useCallback(
    (
      publicKeyB64: string,
      resultHandler: (transactions: Transaction[]) => void,
      options?: {
        startHeight?: number;
        endHeight?: number;
        limit?: number;
      },
    ) => {
      if (readyState !== ReadyState.OPEN) return () => {};
      if (!publicKeyB64) return () => {};
      if (!tipHeader?.header.height && options?.startHeight === undefined) return () => {};

      const defaultStartHeight = tipHeader?.header.height
        ? tipHeader.header.height + 1
        : 1;

      sendJsonMessage({
        type: 'get_public_key_transactions',
        body: {
          public_key: publicKeyB64,
          start_height: options?.startHeight ?? defaultStartHeight,
          end_height: options?.endHeight ?? 0,
          limit: options?.limit ?? 10,
        },
      });

      return socketEventListener<{
        public_key: string;
        transactions: Transaction[];
      }>('public_key_transactions', (data) => {
        if (data.public_key === publicKeyB64) {
          resultHandler(data.transactions);
        }
      });
    },
    [readyState, sendJsonMessage, tipHeader],
  );

  const applyFilter = useCallback(
    (publicKeysB64: string[]) => {
      if (readyState !== ReadyState.OPEN) return;
      if (publicKeysB64.length) {
        sendJsonMessage({
          type: 'filter_add',
          body: {
            public_keys: publicKeysB64,
          },
        });
      }
    },
    [readyState, sendJsonMessage],
  );

  const requestPendingTransactions = useCallback(
    (
      publicKeyB64: string,
      resultHandler: (transactions: Transaction[]) => void,
    ) => {
      if (readyState !== ReadyState.OPEN) return;
      //applyFilter must be called first with a public key
      applyFilter([publicKeyB64]);
      sendJsonMessage({
        type: 'get_filter_transaction_queue',
      });

      return socketEventListener<Transaction[]>(
        'filter_transaction_queue',
        (data) => {
          resultHandler(data);
        },
      );
    },
    [readyState, applyFilter, sendJsonMessage],
  );

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(
    prefersDark.matches ? 'dark' : 'light',
  );

  useEffect(() => {
    const eventHandler = (mediaQuery: MediaQueryListEvent) =>
      setColorScheme(mediaQuery.matches ? 'dark' : 'light');

    prefersDark.addEventListener('change', eventHandler);

    return () => {
      prefersDark.removeEventListener('change', eventHandler);
    };
  }, [prefersDark, setColorScheme]);

  const appState = {
    publicKeys,
    setPublicKeys,
    selectedKeyIndex,
    setSelectedKeyIndex,
    requestTipHeader,
    tipHeader,
    setTipHeader,
    requestBlockById,
    requestBlockByHeight,
    currentBlock,
    setCurrentBlock,
    genesisBlock,
    setGenesisBlock,
    requestGraph,
    graph,
    setGraph,
    navigatorPublicKey,
    setNavigatorPublicKey,
    transactionRange,
    setTransactionRange,
    pushTransaction,
    requestTransaction,
    requestPkTransactions,
    requestPendingTransactions,
    selectedNode,
    setSelectedNode,
    colorScheme,
    latestSocketResponse,
  };

  useEffect(() => {
    //First load
    if (!!selectedNode) {
      requestPeers();
      requestTipHeader();
      requestBlockByHeight(0);
    }
  }, [selectedNode, requestTipHeader, requestPeers, requestBlockByHeight]);

  return (
    <AppContext.Provider value={appState}>
      <IonApp>
        <Explorer />
      </IonApp>
    </AppContext.Provider>
  );
};

export default App;
