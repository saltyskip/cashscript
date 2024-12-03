export default {
  contractName: 'BigInt',
  constructorInputs: [],
  abi: [
    {
      name: 'proofOfBigInt',
      inputs: [
        {
          name: 'x',
          type: 'int',
        },
        {
          name: 'y',
          type: 'int',
        },
      ],
    },
  ],
  bytecode: '0000008000 OP_2DUP OP_GREATERTHANOREQUAL OP_VERIFY OP_SWAP OP_ROT OP_MUL OP_LESSTHANOREQUAL',
  source: 'contract BigInt() {\n    function proofOfBigInt(int x, int y) {\n        int maxInt32PlusOne = 2147483648;\n        require(x >= maxInt32PlusOne);\n        require(x * y >= maxInt32PlusOne);\n    }\n}\n',
  debug: {
    bytecode: '05000000800051795179a269517a527a95517aa2',
    sourceMap: '3:30:3:40;4:16:4:17;;:21::36;;:16:::1;:8::38;5:16:5:17:0;;:20::21;;:16:::1;:25::40:0;;:16:::1',
    logs: [],
    requires: [
      {
        ip: 6,
        line: 4,
      },
      {
        ip: 15,
        line: 5,
      },
    ],
  },
  compiler: {
    name: 'cashc',
    version: '0.10.4',
  },
  updatedAt: '2024-12-03T13:57:07.265Z',
} as const;
