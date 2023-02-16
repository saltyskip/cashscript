import {
  hexToBin,
  binToHex,
  encodeTransaction,
  addressContentsToLockingBytecode,
  decodeTransaction,
  Transaction as LibauthTransaction,
  LockingBytecodeType,
} from '@bitauth/libauth';
import delay from 'delay';
import {
  AbiFunction,
  hash160,
  hash256,
  placeholder,
  Script,
  scriptToBytecode,
} from '@cashscript/utils';
import {
  Utxo,
  Output,
  Recipient,
  TokenDetails,
  isSignableUtxo,
  TransactionDetails,
} from './interfaces.js';
import {
  meep,
  createInputScript,
  getInputSize,
  createOpReturnOutput,
  getTxSizeWithoutInputs,
  getPreimageSize,
  buildError,
  addressToLockScript,
  createSighashPreimage,
  validateRecipient,
  utxoComparator,
} from './utils.js';
import { P2SH20_OUTPUT_SIZE, MINIMUM_CHANGE_P2SH20 } from './constants.js';
import NetworkProvider from './network/NetworkProvider.js';
import SignatureTemplate from './SignatureTemplate.js';

const bip68 = await import('bip68');

export class Transaction {
  private inputs: Utxo[] = [];
  private outputs: Output[] = [];

  private sequence = 0xfffffffe;
  private locktime: number;
  private feePerByte: number = 1.0;
  private hardcodedFee: bigint;
  private minChange: bigint = MINIMUM_CHANGE_P2SH20;

  constructor(
    private address: string,
    private provider: NetworkProvider,
    private redeemScript: Script,
    private abiFunction: AbiFunction,
    private args: (Uint8Array | SignatureTemplate)[],
    private selector?: number,
  ) {}

  from(input: Utxo): this;
  from(inputs: Utxo[]): this;

  from(inputOrInputs: Utxo | Utxo[]): this {
    if (!Array.isArray(inputOrInputs)) {
      inputOrInputs = [inputOrInputs];
    }

    this.inputs = this.inputs.concat(inputOrInputs);

    return this;
  }

  experimentalFromP2PKH(input: Utxo, template: SignatureTemplate): this;
  experimentalFromP2PKH(inputs: Utxo[], template: SignatureTemplate): this;

  experimentalFromP2PKH(inputOrInputs: Utxo | Utxo[], template: SignatureTemplate): this {
    if (!Array.isArray(inputOrInputs)) {
      inputOrInputs = [inputOrInputs];
    }

    inputOrInputs = inputOrInputs.map((input) => ({ ...input, template }));

    this.inputs = this.inputs.concat(inputOrInputs);

    return this;
  }

  to(to: string, amount: bigint, tokenDetails: TokenDetails): this;
  to(outputs: Recipient[]): this;

  to(toOrOutputs: string | Recipient[], amount?: bigint, tokenDetails?: TokenDetails): this {
    if (typeof toOrOutputs === 'string' && typeof amount === 'bigint') {
      const recipient = { to: toOrOutputs, amount, token: tokenDetails };
      if(typeof tokenDetails != "undefined") recipient.token = tokenDetails;
      validateRecipient(recipient);
      return this.to([recipient]);
    }

    if (Array.isArray(toOrOutputs) && amount === undefined) {
      toOrOutputs.forEach(validateRecipient);
      this.outputs = this.outputs.concat(toOrOutputs);
      return this;
    }

    throw new Error('Incorrect arguments passed to function \'to\'');
  }

  withOpReturn(chunks: string[]): this {
    this.outputs.push(createOpReturnOutput(chunks));
    return this;
  }

  withAge(age: number): this {
    this.sequence = bip68.encode({ blocks: age });
    return this;
  }

  withTime(time: number): this {
    this.locktime = time;
    return this;
  }

  withHardcodedFee(hardcodedFee: bigint): this {
    this.hardcodedFee = hardcodedFee;
    return this;
  }

  withFeePerByte(feePerByte: number): this {
    this.feePerByte = feePerByte;
    return this;
  }

  withMinChange(minChange: bigint): this {
    this.minChange = minChange;
    return this;
  }

  withoutChange(): this {
    return this.withMinChange(BigInt(Number.MAX_VALUE));
  }

  async build(): Promise<string> {
    this.locktime = this.locktime ?? await this.provider.getBlockHeight();
    await this.setInputsAndOutputs();

    const bytecode = scriptToBytecode(this.redeemScript);

    const inputs = this.inputs.map((utxo) => ({
      outpointIndex: utxo.vout,
      outpointTransactionHash: hexToBin(utxo.txid),
      sequenceNumber: this.sequence,
      unlockingBytecode: new Uint8Array(),
    }));

    const outputs = this.outputs.map((output) => {
      const lockingBytecode = typeof output.to === 'string'
        ? addressToLockScript(output.to)
        : output.to;

      const valueSatoshis = output.amount;

      return { lockingBytecode, valueSatoshis };
    });

    const transaction = {
      inputs,
      locktime: this.locktime,
      outputs,
      version: 2,
    };

    const inputScripts: Uint8Array[] = [];

    this.inputs.forEach((utxo, i) => {
      // UTXO's with signature templates are signed using P2PKH
      if (isSignableUtxo(utxo)) {
        const pubkey = utxo.template.getPublicKey();
        const pubkeyHash = hash160(pubkey);

        const addressContents = { payload: pubkeyHash, type: LockingBytecodeType.p2pkh };
        const prevOutScript = addressContentsToLockingBytecode(addressContents);

        const hashtype = utxo.template.getHashType();
        const preimage = createSighashPreimage(transaction, utxo, i, prevOutScript, hashtype);
        const sighash = hash256(preimage);

        const signature = utxo.template.generateSignature(sighash);

        const inputScript = scriptToBytecode([signature, pubkey]);
        inputScripts.push(inputScript);

        return;
      }

      let covenantHashType = -1;
      const completeArgs = this.args.map((arg) => {
        if (!(arg instanceof SignatureTemplate)) return arg;

        // First signature is used for sighash preimage (maybe not the best way)
        if (covenantHashType < 0) covenantHashType = arg.getHashType();

        const preimage = createSighashPreimage(transaction, utxo, i, bytecode, arg.getHashType());
        const sighash = hash256(preimage);

        return arg.generateSignature(sighash);
      });

      const preimage = this.abiFunction.covenant
        ? createSighashPreimage(transaction, utxo, i, bytecode, covenantHashType)
        : undefined;

      const inputScript = createInputScript(
        this.redeemScript, completeArgs, this.selector, preimage,
      );

      inputScripts.push(inputScript);
    });

    inputScripts.forEach((script, i) => {
      transaction.inputs[i].unlockingBytecode = script;
    });

    return binToHex(encodeTransaction(transaction));
  }

  async send(): Promise<TransactionDetails>;
  async send(raw: true): Promise<string>;

  async send(raw?: true): Promise<TransactionDetails | string> {
    const tx = await this.build();
    try {
      const txid = await this.provider.sendRawTransaction(tx);
      return raw ? await this.getTxDetails(txid, raw) : await this.getTxDetails(txid);
    } catch (e: any) {
      const reason = e.error ?? e.message;
      throw buildError(reason, meep(tx, this.inputs, this.redeemScript));
    }
  }

  private async getTxDetails(txid: string): Promise<TransactionDetails>
  private async getTxDetails(txid: string, raw: true): Promise<string>;

  private async getTxDetails(txid: string, raw?: true): Promise<TransactionDetails | string> {
    for (let retries = 0; retries < 1200; retries += 1) {
      await delay(500);
      try {
        const hex = await this.provider.getRawTransaction(txid);

        if (raw) return hex;

        const libauthTransaction = decodeTransaction(hexToBin(hex)) as LibauthTransaction;
        return { ...libauthTransaction, txid, hex };
      } catch (ignored) {
        // ignored
      }
    }

    // Should not happen
    throw new Error('Could not retrieve transaction details for over 10 minutes');
  }

  async meep(): Promise<string> {
    const tx = await this.build();
    return meep(tx, this.inputs, this.redeemScript);
  }

  private async setInputsAndOutputs(): Promise<void> {
    if (this.outputs.length === 0) {
      throw Error('Attempted to build a transaction without outputs');
    }

    // Replace all SignatureTemplate with 65-length placeholder Uint8Arrays
    const placeholderArgs = this.args.map((arg) => (
      arg instanceof SignatureTemplate ? placeholder(65) : arg
    ));

    // Create a placeholder preimage of the correct size
    const placeholderPreimage = this.abiFunction.covenant
      ? placeholder(getPreimageSize(scriptToBytecode(this.redeemScript)))
      : undefined;

    // Create a placeholder input script for size calculation using the placeholder
    // arguments and correctly sized placeholder preimage
    const placeholderScript = createInputScript(
      this.redeemScript,
      placeholderArgs,
      this.selector,
      placeholderPreimage,
    );

    // Add one extra byte per input to over-estimate tx-in count
    const inputSize = getInputSize(placeholderScript) + 1;

    // Note that we use the addPrecision function to add "decimal points" to BigInt numbers

    // Calculate amount to send and base fee (excluding additional fees per UTXO)
    let amount = addPrecision(this.outputs.reduce((acc, output) => acc + output.amount, 0n));
    let fee = addPrecision(this.hardcodedFee ?? getTxSizeWithoutInputs(this.outputs) * this.feePerByte);

    // Select and gather UTXOs and calculate fees and available funds
    let satsAvailable = 0n;
    if (this.inputs.length > 0) {
      // If inputs are already defined, the user provided the UTXOs and we perform no further UTXO selection
      if (!this.hardcodedFee) fee += addPrecision(this.inputs.length * inputSize * this.feePerByte);
      satsAvailable = addPrecision(this.inputs.reduce((acc, input) => acc + input.satoshis, 0n));
    } else {
      // If inputs are not defined yet, we retrieve the contract's UTXOs and perform selection
      const utxos = await this.provider.getUtxos(this.address);

      // We sort the UTXOs mainly so there is consistent behaviour between network providers
      // even if they report UTXOs in a different order
      utxos.sort(utxoComparator).reverse();

      for (const utxo of utxos) {
        this.inputs.push(utxo);
        satsAvailable += addPrecision(utxo.satoshis);
        if (!this.hardcodedFee) fee += addPrecision(inputSize * this.feePerByte);
        if (satsAvailable > amount + fee) break;
      }
    }

    // Remove "decimal points" from BigInt numbers (rounding up for fee, down for others)
    satsAvailable = removePrecisionFloor(satsAvailable);
    amount = removePrecisionFloor(amount);
    fee = removePrecisionCeil(fee);

    // Calculate change and check available funds
    let change = satsAvailable - amount - fee;

    if (change < 0) {
      throw new Error(`Insufficient funds: available (${satsAvailable}) < needed (${amount + fee}).`);
    }

    // Account for the fee of adding a change output
    if (!this.hardcodedFee) {
      change -= BigInt(P2SH20_OUTPUT_SIZE * this.feePerByte);
    }

    // Add a change output if applicable
    if (change >= this.minChange) {
      this.outputs.push({ to: this.address, amount: change });
    }
  }
}

// Note: the below is a very simple implementation of a "decimal point" system for BigInt numbers
// It is safe to use for UTXO fee calculations due to its low numbers, but should not be used for other purposes
// Also note that multiplication and division between two "decimal" bigints is not supported

// High precision may not work with some 'number' inputs, so we set the default to 6 "decimal places"
const addPrecision = (amount: number | bigint, precision: number = 6): bigint => {
  if (typeof amount === 'number') {
    return BigInt(Math.ceil(amount * 10 ** precision));
  }

  return amount * BigInt(10 ** precision);
};

const removePrecisionFloor = (amount: bigint, precision: number = 6): bigint => (
  amount / (10n ** BigInt(precision))
);

const removePrecisionCeil = (amount: bigint, precision: number = 6): bigint => {
  const multiplier = 10n ** BigInt(precision);
  return (amount + multiplier - 1n) / multiplier;
};
