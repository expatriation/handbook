import { describe, expect, it } from 'vitest';
import { filterOutgoingTransactions } from './usePubKeyTxs';
import { Transaction } from '../utils/appTypes';

describe('filterOutgoingTransactions', () => {
  const pubKey = 'sender-key';
  const transactions: Transaction[] = [
    {
      from: 'sender-key',
      to: 'memo-key-a',
      amount: 1,
      fee: 0,
      memo: 'outgoing memo',
      time: 1,
    },
    {
      from: 'other-key',
      to: 'sender-key',
      amount: 1,
      fee: 0,
      memo: 'incoming should be hidden',
      time: 2,
    },
    {
      to: 'sender-key',
      amount: 1,
      fee: 0,
      memo: 'coinbase should be hidden',
      time: 3,
    },
  ];

  it('keeps only outgoing transactions for the key', () => {
    expect(filterOutgoingTransactions(pubKey, transactions)).toEqual([
      transactions[0],
    ]);
  });

  it('returns all transactions when the key is empty', () => {
    expect(filterOutgoingTransactions('', transactions)).toEqual(transactions);
  });
});
