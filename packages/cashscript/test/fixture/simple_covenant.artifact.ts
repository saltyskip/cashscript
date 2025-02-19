export default {
  contractName: 'Covenant',
  constructorInputs: [],
  abi: [
    {
      name: 'spend',
      inputs: [],
    },
  ],
  bytecode: 'OP_TXVERSION OP_2 OP_GREATERTHANOREQUAL OP_VERIFY OP_TXINPUTCOUNT OP_1 OP_GREATERTHANOREQUAL OP_VERIFY OP_TXOUTPUTCOUNT OP_1 OP_GREATERTHANOREQUAL OP_VERIFY OP_ACTIVEBYTECODE OP_SIZE OP_NIP 0802 OP_LESSTHAN OP_VERIFY OP_0 OP_UTXOVALUE 2202 OP_GREATERTHANOREQUAL OP_VERIFY OP_0 OP_OUTPUTVALUE 2202 OP_GREATERTHANOREQUAL',
  source: 'contract Covenant() {\n    function spend() {\n        require(tx.version >= 2);\n        require(tx.inputs.length >= 1);\n        require(tx.outputs.length >= 1);\n        require(this.activeBytecode.length < 520);\n        require(tx.inputs[0].value >= 546);\n        require(tx.outputs[0].value >= 546);\n    }\n}\n',
  debug: {
    bytecode: 'c252a269c351a269c451a269c182770208029f6900c6022202a26900cc022202a2',
    sourceMap: '3:16:3:26;:30::31;:16:::1;:8::33;4:16:4:32:0;:36::37;:16:::1;:8::39;5:16:5:33:0;:37::38;:16:::1;:8::40;6:16:6:35:0;:::42:1;;:45::48:0;:16:::1;:8::50;7:26:7:27:0;:16::34:1;:38::41:0;:16:::1;:8::43;8:27:8:28:0;:16::35:1;:39::42:0;:16:::1',
    logs: [],
    requires: [
      {
        ip: 3,
        line: 3,
      },
      {
        ip: 7,
        line: 4,
      },
      {
        ip: 11,
        line: 5,
      },
      {
        ip: 17,
        line: 6,
      },
      {
        ip: 22,
        line: 7,
      },
      {
        ip: 27,
        line: 8,
      },
    ],
  },
  compiler: {
    name: 'cashc',
    version: '0.10.4',
  },
  updatedAt: '2024-12-03T13:57:09.639Z',
} as const;
