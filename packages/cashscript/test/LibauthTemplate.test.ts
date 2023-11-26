import { compileString } from 'cashc';
import { Contract, MockNetworkProvider, SignatureTemplate } from '../src/index.js';
import {
  alicePriv, alicePub, bobPriv, bobPub,
} from './fixture/vars.js';
import './JestExtensions.js';
import { randomUtxo } from '../src/utils.js';

describe('Libauth template generation tests', () => {
  it('should log console statements', async () => {
    const code = `
contract Example(string cash) {
  function test(string script) {
    require(
      cash +
      script ==
      "cashscript"
    );
  }
}
`;
    const artifact = compileString(code);

    const provider = new MockNetworkProvider();
    const contract = new Contract(artifact, ["cash"], { provider });
    provider.addUtxo(contract.address, randomUtxo());

    const transaction = contract.functions.test("script").to(contract.address, 10000n);
    await transaction.debug()
  });

  it('should log console statements', async () => {
    const code = `
    pragma cashscript ^0.9.0;

    contract TransferWithTimeout(
        pubkey sender,
        pubkey recipient,
        int timeout
    ) {
        // Require recipient's signature to match
        function transfer(sig recipientSig) {
            bytes2 beef = 0xbeef;
            console.log(recipientSig, timeout, recipient, sender, beef, 1, "test", true);
            require(beef != 0xfeed);
            require(checkSig(recipientSig, recipient));
        }

        // Require timeout time to be reached and sender's signature to match
        function timeout(sig senderSig) {
            require(checkSig(senderSig, sender));
            require(tx.time >= timeout);
        }
    }
    `;
    const artifact = compileString(code);

    const provider = new MockNetworkProvider();
    const contract = new Contract(artifact, [alicePub, bobPub, 100000n], { provider });
    provider.addUtxo(contract.address, randomUtxo());

    const transaction = contract.functions.transfer(new SignatureTemplate(bobPriv)).to(contract.address, 10000n);

    await (expect(transaction)).toLog(/0x[0-9a-f]{130} 100000 0x[0-9a-f]{66} 0x[0-9a-f]{66} 0xbeef 1 test true/);
    await (expect(transaction)).toLog('beef');
  });

  it('should check for failed requires', async () => {
    const code = `
    pragma cashscript ^0.9.0;

    contract TransferWithTimeout(
        pubkey sender,
        pubkey recipient,
        int timeout
    ) {
        // Require recipient's signature to match
        function transfer(sig recipientSig) {
            require(checkSig(recipientSig, recipient));
        }

        // Require timeout time to be reached and sender's signature to match
        function timeout(sig senderSig) {
            require(checkSig(senderSig, sender), "sigcheck custom fail");
            require(tx.time >= timeout);
        }

        function timeout2(sig senderSig) {
            require(tx.time >= timeout, "timecheck custom fail");
            require(checkSig(senderSig, sender));
        }
    }
    `;

    const artifact = compileString(code);

    const provider = new MockNetworkProvider();
    {
      const contract = new Contract(artifact, [alicePub, bobPub, 2000000n], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.timeout(new SignatureTemplate(bobPriv)).to(contract.address, 1000n);
      await expect(transaction).toFailRequireWith(/sigcheck custom fail/);
    }

    {
      const contract = new Contract(artifact, [alicePub, bobPub, 1000000n], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.timeout2(new SignatureTemplate(alicePriv)).to(contract.address, 1000n);
      await expect(transaction).toFailRequireWith(/timecheck custom fail/);
    }

    {
      const contract = new Contract(artifact, [alicePub, bobPub, 2000000n], { provider });
      provider.addUtxo(contract.address, randomUtxo());

      const transaction = contract.functions.transfer(new SignatureTemplate(bobPriv)).to(contract.address, 1000n);
      await expect(transaction).not.toFailRequireWith(/timecheck custom fail/);
    }
  });
});
