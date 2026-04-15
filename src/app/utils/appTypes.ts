export interface GraphNode {
  id: number;
  group?: number;
  neighbors?: GraphNode[];
  links?: GraphLink[];
  pubkey: string;
  label: string;
  memo?: string;
  memoTransactionId?: string;
  balance: number;
}

export interface GraphLink {
  source: number;
  target: number;
  value: number;
  time: number;
  memo?: string;
}

export interface BlockHeader {
  previous: string;
  hash_list_root: string;
  time: number;
  target: string;
  chain_work: string;
  nonce: number;
  height: number;
  transaction_count: number;
}

export interface BlockIdHeaderPair {
  block_id: string;
  header: BlockHeader;
}

export interface Block {
  header: BlockHeader;
  transactions: Transaction[];
}

export interface Transaction {
  time: number;
  nonce?: number;
  from?: string;
  to: string;
  amount: number;
  fee: number;
  memo: string;
  series?: number;
  signature?: string;
}
