import { useContext, useEffect, useState } from 'react';
import { AppContext } from '../utils/appContext';
import { Transaction } from '../utils/appTypes';

export const filterOutgoingTransactions = (
  pubKey: string,
  transactions: Transaction[],
): Transaction[] => {
  if (!pubKey) {
    return transactions;
  }

  return transactions.filter((tx) => tx.from === pubKey);
};

export const usePubKeyTransactions = (pubKey: string) => {
  const { requestPkTransactions } = useContext(AppContext);
  const [pkTransactions, setPKTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    let cleanup = () => {};
    const timeoutId = window.setTimeout(() => {
      if (pubKey) {
        cleanup =
          requestPkTransactions(pubKey, (pkx) => {
            setPKTransactions(filterOutgoingTransactions(pubKey, pkx));
          }) ?? cleanup;
      }
    }, 0);
    return () => {
      cleanup();
      window.clearTimeout(timeoutId);
    };
  }, [pubKey, requestPkTransactions]);

  return pkTransactions;
};
