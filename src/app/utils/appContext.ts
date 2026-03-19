import { createContext } from 'react';
import {
  Block,
  BlockIdHeaderPair,
  Transaction,
  Profile,
  GraphNode,
  GraphLink,
} from '../utils/appTypes';

interface AppState {
  publicKeys: string[][];
  setPublicKeys: (keys: string[][]) => void;
  selectedKeyIndex: [number, number];
  setSelectedKeyIndex: (index: [number, number]) => void;
  requestTipHeader: () => void;
  tipHeader?: BlockIdHeaderPair;
  setTipHeader: (tipHeader: BlockIdHeaderPair) => void;
  requestBlockByHeight: (height: number) => void;
  requestBlockById: (block_id: string) => void;
  currentBlock?: Block | null;
  setCurrentBlock: (currentBlock: Block) => void;
  genesisBlock?: Block | null;
  setGenesisBlock: (genesisBlock: Block) => void;
  requestProfile: (
    publicKeyB64: string,
    resultHandler: (profile: Profile) => void,
  ) => (() => void) | undefined;
  requestGraph: (publicKeyB64: string) => void;
  graph: {
    nodes: GraphNode[];
    links: GraphLink[];
  } | null;
  rankingFilter: number;
  setRankingFilter: (rankingFilter: number) => void;
  requestTransaction: (
    transaction_id: string,
    resultHandler: (transaction: Transaction) => void,
  ) => (() => void) | undefined;
  requestPkTransactions: (
    publicKeyB64: string,
    resultHandler: (transactions: Transaction[]) => void,
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
  setSelectedNode: (node: string) => void;
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
  requestProfile:
    (publicKeyB64: string, resultHandler: (profile: Profile) => void) =>
    () => {},
  requestGraph: (publicKeyB64: string) => {},
  graph: null,
  rankingFilter: 0,
  setRankingFilter: () => {},
  requestTransaction:
    (transaction_id: string, resultHandler: (transaction: Transaction) => void) =>
    () => {},
  requestPkTransactions:
    (publicKeyB64: string, resultHandler: (transactions: Transaction[]) => void) =>
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
