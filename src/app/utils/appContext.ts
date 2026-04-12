import { createContext } from 'react';
import { Dispatch, SetStateAction } from 'react';
import {
  Block,
  BlockIdHeaderPair,
  Transaction,
  GraphNode,
  GraphLink,
} from '../utils/appTypes';

interface AppState {
  publicKeys: string[][];
  setPublicKeys: Dispatch<SetStateAction<string[][]>>;
  selectedKeyIndex: [number, number];
  setSelectedKeyIndex: Dispatch<SetStateAction<[number, number]>>;
  requestTipHeader: () => void;
  tipHeader?: BlockIdHeaderPair;
  setTipHeader: Dispatch<SetStateAction<BlockIdHeaderPair | undefined>>;
  requestBlockByHeight: (height: number) => void;
  requestBlockById: (block_id: string) => void;
  currentBlock?: Block | null;
  setCurrentBlock: Dispatch<SetStateAction<Block | null>>;
  genesisBlock?: Block | null;
  setGenesisBlock: Dispatch<SetStateAction<Block | null>>;
  requestGraph: (publicKeyB64: string) => void;
  graph: {
    nodes: GraphNode[];
    links: GraphLink[];
  } | null;
  setGraph: Dispatch<
    SetStateAction<{ nodes: GraphNode[]; links: GraphLink[] } | null>
  >;
  navigatorPublicKey: string;
  setNavigatorPublicKey: Dispatch<SetStateAction<string>>;
  transactionRange: {
    startHeight: number;
    endHeight: number;
    limit: number;
  };
  setTransactionRange: Dispatch<
    SetStateAction<{
      startHeight: number;
      endHeight: number;
      limit: number;
    }>
  >;
  requestTransaction: (
    transaction_id: string,
    resultHandler: (transaction: Transaction) => void,
  ) => (() => void) | undefined;
  requestPkTransactions: (
    publicKeyB64: string,
    resultHandler: (transactions: Transaction[]) => void,
    options?: {
      startHeight?: number;
      endHeight?: number;
      limit?: number;
    },
  ) => (() => void) | undefined;
  pushTransaction: (
    to: string,
    memo: string,
    passphrase: string,
    selectedKeyIndex: [number, number],
    resultHandler: (data: { transaction_id: string; error: string }) => void,
  ) => Promise<(() => void) | undefined>;

  requestPendingTransactions: (
    publicKeyB64: string,
    resultHandler: (transactions: Transaction[]) => void,
  ) => (() => void) | undefined;
  selectedNode: string;
  setSelectedNode: Dispatch<SetStateAction<string>>;
  colorScheme: 'light' | 'dark';
  latestSocketResponse: {
    receivedAt: string;
    payload: unknown;
    raw: string;
  } | null;
}

export const AppContext = createContext<AppState>({
  publicKeys: [],
  setPublicKeys: () => {},
  selectedKeyIndex: [0, 0],
  setSelectedKeyIndex: (index: [number, number]) => {},
  tipHeader: undefined,
  requestTipHeader: () => {},
  setTipHeader: () => {},
  requestBlockById: (block_id: string) => {},
  requestBlockByHeight: (height: number) => {},
  currentBlock: undefined,
  setCurrentBlock: (currentBlock: Block) => {},
  genesisBlock: undefined,
  setGenesisBlock: (genesisBlock: Block) => {},
  requestGraph: (publicKeyB64: string) => {},
  graph: null,
  setGraph: () => {},
  navigatorPublicKey: '',
  setNavigatorPublicKey: () => {},
  transactionRange: {
    startHeight: 0,
    endHeight: 0,
    limit: 500,
  },
  setTransactionRange: () => {},
  requestTransaction:
    (transaction_id: string, resultHandler: (transaction: Transaction) => void) =>
    () => {},
  requestPkTransactions:
    (
      publicKeyB64: string,
      resultHandler: (transactions: Transaction[]) => void,
      options?: {
        startHeight?: number;
        endHeight?: number;
        limit?: number;
      },
    ) =>
    () => {},
  requestPendingTransactions:
    (publicKeyB64: string, resultHandler: (transactions: Transaction[]) => void) =>
    () => {},
  selectedNode: '',
  setSelectedNode: () => {},
  colorScheme: 'light',
  latestSocketResponse: null,
  pushTransaction: (
    to: string,
    memo: string,
    passphrase: string,
    selectedKeyIndex: [number, number],
    resultHandler: (data: { transaction_id: string; error: string }) => void,
  ) => Promise.resolve(undefined),
});
