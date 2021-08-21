import { compileString } from './compiler';

// const code = `
// contract N(string s) {
//     function test(/*string s*/){
//         // int z = 5;
//         string x, y = (s+s).split(s.length);
//         // string x = (s+"iii").split(1)[0];
//         // string y = (s+"iii").split(1)[1];
//         // x = x + y;
//         // string x = s.split(15)[0];
//         // string y = "What is Bitcoin Cash?".split(15)[1];
//         // string h = 'asd';
//         int x1 = int(bytes(x));
//         int y1 = int(bytes(y));
//         require(x1 == y1);
//         // require(s == "asdasdas");
//     }
// }
// `;

const code = `
contract N() {
    function test(){
        int  m = 5;
        m = m + 5;
        int y = m+1;
        require(y > 2);
    }
}
`;

const art = compileString(code);
console.log(art);
