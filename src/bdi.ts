
type Word = number & { __brand: 'word' };
type Time = number & { __brand: 'time' };
type LineNo = number & { __brand: 'lineNo' };
type RegAddr = number & { __brand: 'RegAddr' };

const ZERO = 0 as Word;
const wONE = ~ZERO as Word;

class Drum {
    time: number = 0;
    lines: Word[][];
    constructor(lineCount: number, wordCount: number) {
        this.lines = new Array(lineCount).fill(null).map(() => Array(wordCount).fill(0 as Word));
    }

    read(line: LineNo): Word {
        //console.log("R", line, this.time, this.lines[line][this.time]);
        return this.lines[line][this.time];
    }

    write(line: LineNo, value: Word) {
        //console.log("W", line, this.time, value);
        this.lines[line][this.time] = value;
    }

    step() {
        this.time = (this.time + 1) % (this.lines[0].length);
    }

    //Non-Physical, used for testing
    poke(line: LineNo, time: Time, value: Word) {
        this.lines[line][time] = value;
    }
}

enum Phase {
    Fetch,
    Memory,
    Transfer
}
enum OpType {
    Transfer = 0,
    Memory = 1
}
enum MemoryOp {
    Load = 0,
    Store = 1
}

class BDI {

    //Magnetic Drum Memory
    drum = new Drum(32, 32);

    //Full word normal registers, stored on drum
    A: Word = ZERO;
    B: Word = ZERO;
    C: Word = ZERO;
    D: Word = ZERO;

    //Tube Registers & FFs
    instruction: Word = ZERO;
    halt: boolean = false;
    branch: boolean = false;

    registers = [
        //Accumulator
        { name: "A", read: () => this.A, write: (v: Word) => this.A = v },
        { name: "A+", read: () => this.A, write: (v: Word) => this.A = this.A + v as Word },

        //General register
        { name: "B", read: () => this.B, write: (v: Word) => this.B = v },

        //Counter and Decrementor
        { name: "C", read: () => this.C, write: (v: Word) => this.C = v },
        { name: "D", read: () => this.D, write: (v: Word) => this.D = v },
        { name: "C+D", read: () => this.C + this.D as Word, write: (v: Word) => {/**NOOP*/ } },


        //Write to serial terminal.. imagine it sending an ascii byte, now it just
        //prints the value
        //TODO Read count be CTS?
        { name: "OUT", read: () => ZERO, write: (v: Word) => console.log("OUT: ", v) },

        //Write non-zero to BRA and next instruction will be taking from N+1
        { name: "BRA", read: () => this.branch ? wONE : ZERO, write: (v: Word) => this.branch = v != 0 },

        //Write non-zero to HLT to halt computer
        { name: "HLT", read: () => this.halt ? wONE : ZERO, write: (v: Word) => this.halt = v != 0 },
    ];

    //Helper function for assembler
    registerNameToAddress(name: string): RegAddr {
        return this.registers.findIndex(r => r.name == name) as RegAddr;
    }

    //Helper functions for accessing certain parts of the instruction
    get opType() { return this.instruction & 0b1 as OpType; };
    get memoryOp() { return (this.instruction & 0b1_0) >> 1 as MemoryOp };

    get dst() { return (this.instruction & 0b11111_0_0) >> 2 as RegAddr };
    get src() { return (this.instruction & 0b11111_00000_0_0) >> 7 as RegAddr };

    get memoryReg() { return this.dst; }//Same bits for LD and ST
    get memoryTime() { return (this.instruction & 0b11111_00000_0_0) >> 7 as Time };
    get memoryLine() { return (this.instruction & 0b11111_00000_00000_0_0) >> 12 as LineNo };

    get nextTime() { return (this.instruction & 0b11111_00000_00000_00000_0_0) >> 17 as Time };
    get nextLine() { return (this.instruction & 0b11111_00000_00000_00000_00000_0_0) >> 22 as LineNo };

    phase: Phase = Phase.Fetch;

    step(): void {
        this.drum.step();
        if (this.halt) {
            return;
        }

        switch (this.phase) {
            case Phase.Fetch:
                if (this.drum.time == this.nextTime + (this.branch ? 1 : 0)) {
                    this.branch = false;
                    this.instruction = this.drum.read(this.nextLine);
                    this.phase = (this.opType == OpType.Memory) ? Phase.Memory : Phase.Transfer;
                }
                break;
            case Phase.Memory:
                if (this.drum.time == this.memoryTime) {
                    if (this.memoryOp == MemoryOp.Load)
                        this.registers[this.dst].write(this.drum.read(this.memoryLine));
                    else
                        this.drum.write(this.memoryLine, this.registers[this.dst].read())
                    this.phase = Phase.Fetch;
                }
                break;
            case Phase.Transfer:
                this.registers[this.dst].write(this.registers[this.src].read());
                this.phase = Phase.Fetch;
                break;
        }
    }
}

let bdi = new BDI();

/*
LL:LL   OP  SS:SS   DD:DD   NNN
*/
const code = `
00:00   LD  00:23   C       00:01
00:01   LD  00:24   D       00:02


00:02   LD  00:20   A       00:03
00:03   TR  A       OUT     00:04
00:04   LD  00:21   A+      00:05
00:05   LD  00:21   B       00:06
00:06   ST  B       00:20   00:07
00:07   ST  A       00:21   00:08

00:08   TR  C+D     C       00:09
00:09   TR  C       BRA     00:10

00:10   TR  A       HLT     00:00
00:11   TR  A       A       00:02


00:20   DA  0
00:21   DA  1

00:23   DA  8
00:24   DA  -1
`;

function parse(line: string) {
    const parts = line.split(/\s+/);

    function parseAddr(text: string) {
        let s = text.split(":");
        let line: LineNo = parseInt(s[0]) as LineNo;
        let time: Time = parseInt(s[1]) as Time;
        return { line, time };
    }

    const loc = parseAddr(parts[0]);

    const op = parts[1];

    let w = 0;

    if (op == "DA") {
        w = parseInt(parts[2]);
    } else {
        const src = parts[2];
        const dst = parts[3];
        const next = parseAddr(parts[4]);

        w |= next.line << 22;
        w |= next.time << 17;

        if (op == "LD" || op == "ST") {
            let memAddress;
            let registerName;
            let memoryOp: MemoryOp;
            if (op == "LD") {
                memAddress = parseAddr(src);
                registerName = dst;
                memoryOp = MemoryOp.Load;
            } else {
                memAddress = parseAddr(dst);
                registerName = src;
                memoryOp = MemoryOp.Store;
            }
            w |= memAddress.line << 12;
            w |= memAddress.time << 7;
            w |= bdi.registerNameToAddress(registerName) << 2;
            w |= memoryOp << 1;
            w |= OpType.Memory;
        } else if (op == "TR") {
            w |= bdi.registerNameToAddress(src) << 7;
            w |= bdi.registerNameToAddress(dst) << 2;
            w |= 0 << 1;
            w |= OpType.Transfer;
        }
    }
    let word = w as Word;

    return { loc, word };
}

let lines = code.split("\n");
lines.map(s => s.trim()).filter(s => s.length).map(parse).forEach(({ loc, word }) => {
    bdi.drum.poke(loc.line, loc.time, word);
});

let count = 0;
while ( true ){
    count++;
    if ( count > 10000 ){
        console.log("Stopping after 10k times");
        break;
    } else if ( bdi.halt ){
        console.log("halted");
        break;
    }
    bdi.step();
}