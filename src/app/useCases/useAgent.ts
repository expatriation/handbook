import naclUtil from 'tweetnacl-util';
import nacl from 'tweetnacl';
import * as bip39 from 'bip39';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha2';
import { utf8ToBytes } from '@noble/hashes/utils';
import { sha3_256 } from 'js-sha3';
import { BLOCKS_UNTIL_NEW_SERIES } from '../utils/constants';
import { Transaction } from '../utils/appTypes';
import { useContext } from 'react';
import { AppContext } from '../utils/appContext';
import { MinFeeCruzbits, MinAmountCruzbits } from '../utils/constants';
import { Buffer } from 'buffer';

/**
 * Converts a user-supplied passphrase into a 24-word BIP39 mnemonic
 * using SHA-512 and 256 bits of entropy (first 32 bytes).
 */
function generateMnemonic(passphrase: string): string {
  const hash = sha512(utf8ToBytes(passphrase)); // Returns Uint8Array of 64 bytes
  const entropy = hash.slice(0, 32); // 32 bytes = 256 bits = 24 words
  return bip39.entropyToMnemonic(Buffer.from(entropy).toString('hex'));
}

// Simple HMAC-SHA512 HD key derivation
function deriveHDSeed(
  seed: Uint8Array,
  account: number,
  address: number,
): Uint8Array {
  const label = new TextEncoder().encode('necessitated');
  const indexBytes = new Uint8Array([account, address]);
  const input = new Uint8Array([...seed, ...indexBytes]);
  const digest = hmac(sha512, label, input);
  return digest.slice(0, 32); // Ed25519 seeds must be 32 bytes
}

function generateHDKeypair(
  mnemonic: string,
  account: number,
  address: number,
  readOnly: boolean = true,
) {
  const masterSeed = bip39.mnemonicToSeedSync(mnemonic);

  const derivedSeed = deriveHDSeed(
    new Uint8Array(masterSeed),
    account,
    address,
  );
  const keypair = nacl.sign.keyPair.fromSeed(derivedSeed);

  return {
    path: `m/${account}/${address}`,
    publicKey: Buffer.from(keypair.publicKey).toString('base64'),
    privateKey: readOnly ? null : keypair.secretKey,
  };
}

const getPersonas = (
  passphrase: string,
  numAccounts: number = 1,
  numAddressesPerAccount: number = 7,
) => {
  const mnemonic = generateMnemonic(passphrase);

  const keypairs = [] as {
    path: string;
    publicKey: string;
  }[][];

  for (let acct = 0; acct < numAccounts; acct++) {
    keypairs.push([]);
    for (let addr = 0; addr < numAddressesPerAccount; addr++) {
      keypairs[acct].push(generateHDKeypair(mnemonic, acct, addr));
    }
  }

  return keypairs;
};

export const signTransaction = async (
  to: string,
  memo: string,
  tipHeight: number,
  agentIndex: [number, number],
  passPhrase: string,
) => {
  //Prompt -> Sign -> Forget
  //We never persist the passphrase or private keys in state or anywhere else.
  //Any usage of the private keys must require a user prompt for their passphrase.
  const mnemonic = generateMnemonic(passPhrase);
  const keyPair = generateHDKeypair(mnemonic, ...agentIndex, false);

  const transaction: Transaction = {
    time: Math.floor(Date.now() / 1000),
    nonce: Math.floor(Math.random() * (2 ** 31 - 1)),
    from: keyPair.publicKey,
    to: to,
    amount: MinAmountCruzbits,
    fee: MinFeeCruzbits,
    memo,
    series: Math.floor(tipHeight / BLOCKS_UNTIL_NEW_SERIES) + 1,
  };

  const tx_hash = sha3_256(JSON.stringify(transaction));

  const tx_byte = new Uint8Array(
    (tx_hash.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16)),
  );

  transaction.signature = naclUtil.encodeBase64(
    nacl.sign.detached(tx_byte, keyPair.privateKey!),
  );
  return transaction;
};

export const useAgent = () => {
  const { publicKeys, setPublicKeys, selectedKeyIndex, setSelectedKeyIndex } =
    useContext(AppContext);

  const importAgent = (passphrase: string) => {
    const keys = getPersonas(passphrase, 7).map((o) =>
      o.map((p) => p.publicKey),
    );

    setPublicKeys(keys);
  };

  const deleteAgent = () => {
    setPublicKeys([[]]);
  };

  const selectedKey = publicKeys[selectedKeyIndex[0]][selectedKeyIndex[1]];

  return {
    selectedKey,
    selectedKeyIndex,
    setSelectedKeyIndex,
    publicKeys,
    importAgent,
    deleteAgent,
  };
};
