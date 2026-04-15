import { GraphLink, GraphNode, Transaction } from './appTypes';
import { transactionID } from './compat';

const BASE64_KEY_LENGTH = 44;

const pad44 = (input: string) => {
  if (input.length >= BASE64_KEY_LENGTH) {
    return input;
  }

  let normalized = input;
  if (normalized !== '0' && !normalized.includes('/')) {
    normalized = `${normalized}/`;
  }

  const padLength = BASE64_KEY_LENGTH - normalized.length - 1;
  return `${normalized}${'0'.repeat(Math.max(0, padLength))}=`;
};

export const inflateNodes = (pubKey: string) => {
  let trimmed = pubKey.replace(/^[/+0=]+|[/+0=]+$/g, '');
  let splitPK = trimmed.split('/');

  if (!splitPK.length || !splitPK[0]) {
    return { ok: false, paths: [] as string[], isSpatial: false };
  }

  for (let i = 0; i < splitPK.length; i += 1) {
    if (!splitPK[i]) {
      return { ok: false, paths: [pubKey], isSpatial: false };
    }
  }

  trimmed = pubKey.replace(/[0=]+$/g, '');
  splitPK = trimmed.split('/');

  let nodes = [...splitPK];
  if (nodes.length) {
    const last = nodes[nodes.length - 1];
    if (last.replace(/\+/g, '') === '') {
      nodes = nodes.slice(0, -1);
    }
  }

  const paths: string[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    let node = nodes[i];
    const next = nodes[i + 1];
    if (next?.startsWith('+')) {
      const stripped = next.replace(/\+/g, '');
      const prefix = next.split(stripped)[0];
      node = `${node}/${prefix}`;
    }
    nodes[i] = node;
    paths.push(`${nodes.slice(0, i + 1).join('/')}/`);
  }

  return { ok: true, paths, isSpatial: pubKey.startsWith('/') };
};

type InternalNode = {
  id: number;
  pubkey: string;
  balance: number;
  memo?: string;
  memoTransactionId?: string;
  memoSeries?: number;
  memoTime?: number;
};

type LinkKind = 'spatial' | 'temporal' | 'verbal';

type InternalLink = GraphLink & { kind: LinkKind };

export const indexTransactionsToGraph = (
  transactions: Transaction[],
  selectedPublicKey: string,
): { nodes: GraphNode[]; links: GraphLink[] } => {
  const nodeIndex = new Map<string, number>();
  const nodes = new Map<number, InternalNode>();
  const links = new Map<string, InternalLink>();

  const getNodeId = (pubkey: string) => {
    const padded = pad44(pubkey);
    const existing = nodeIndex.get(padded);
    if (existing !== undefined) {
      return existing;
    }

    const id = nodeIndex.size;
    nodeIndex.set(padded, id);
    nodes.set(id, {
      id,
      pubkey: padded,
      balance: 0,
    });
    return id;
  };

  const linkNodes = (
    source: string,
    target: string,
    weight: number,
    time: number,
    kind: LinkKind,
  ) => {
    const sourceId = getNodeId(source);
    const targetId = getNodeId(target);
    const key = `${sourceId}:${targetId}:${kind}`;
    const previous = links.get(key);

    if (previous) {
      previous.value += weight;
      previous.time = time;
      return;
    }

    links.set(key, {
      source: sourceId,
      target: targetId,
      value: weight,
      time,
      kind,
    });
  };

  getNodeId('0');

  const selected = pad44(selectedPublicKey);

  transactions.forEach((txn, index) => {
    const txnFrom = txn.from ? pad44(txn.from) : pad44('0');
    const txnTo = pad44(txn.to);
    const txnMemo = txn.memo?.trim() ?? '';

    if (txnFrom !== selected && txnTo !== selected) {
      return;
    }

    const inflated = inflateNodes(txn.to);
    if (!inflated.ok) {
      return;
    }

    const kind: LinkKind = inflated.isSpatial ? 'spatial' : 'verbal';
    const dimensionWeight = txn.amount / 3;

    for (let i = 0; i < inflated.paths.length; i += 1) {
      const path = inflated.paths[i];
      const additive = 10 + i;

      if (i === 0) {
        linkNodes('0', path, dimensionWeight, txn.time + additive, kind);
      }

      if (i + 1 < inflated.paths.length) {
        const next = inflated.paths[i + 1];
        linkNodes(
          path,
          next,
          dimensionWeight,
          txn.time + additive + i + 1,
          kind,
        );
      }

      if (i === inflated.paths.length - 1) {
        linkNodes(
          path,
          txn.to,
          dimensionWeight,
          txn.time + additive + i + 1,
          kind,
        );
      }
    }

    const timestamp = new Date(txn.time * 1000);
    const year = `${timestamp.getUTCFullYear()}`;
    const month = `${year}+${`${timestamp.getUTCMonth() + 1}`.padStart(2, '0')}`;
    const day = `${month}+${`${timestamp.getUTCDate()}`.padStart(2, '0')}`;

    linkNodes('0', year, dimensionWeight, txn.time + 20, 'temporal');
    linkNodes(year, month, dimensionWeight, txn.time + 21, 'temporal');
    linkNodes(month, day, dimensionWeight, txn.time + 22, 'temporal');
    linkNodes(day, txn.to, dimensionWeight, txn.time + 23, 'temporal');


    const targetNode = nodes.get(getNodeId(txn.to));
    if (targetNode) {
      const txId = transactionID(txn);
      const txnSeries = txn.series ?? 0;
      const previousSeries = targetNode.memoSeries ?? Number.NEGATIVE_INFINITY;
      const previousTime = targetNode.memoTime ?? Number.NEGATIVE_INFINITY;
      const previousId = targetNode.memoTransactionId ?? '';
      const shouldReplace =
        txnSeries > previousSeries ||
        (txnSeries === previousSeries && txn.time > previousTime) ||
        (txnSeries === previousSeries && txn.time === previousTime && txId > previousId);

      if (shouldReplace) {
        targetNode.memo = txnMemo;
        targetNode.memoTransactionId = txId;
        targetNode.memoSeries = txnSeries;
        targetNode.memoTime = txn.time;
      }
    }
  });

  const graphNodes: GraphNode[] = Array.from(nodes.values()).map((node) => ({
    id: node.id,
    label: node.pubkey.replace(/[0=]+$/g, ''),
    pubkey: node.pubkey,
    balance: node.balance,
    memo: node.memo,
    memoTransactionId: node.memoTransactionId,
    group: 1,
  }));

  const graphLinks = Array.from(links.values()).filter((link) => link.kind === 'spatial');

  return { nodes: graphNodes, links: graphLinks };
};
