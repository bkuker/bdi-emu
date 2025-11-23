# bdi-emu
Emulator for the Bill's Drum 1 Architecture in development. Total toy, total crap.

(bdi is pronounced "Beady Eye")


## Main Memory: 

32 long drum lines of 32 words each. 1024 Words. 10bit addresses.

Memory access is only load / store to from registers.

## Registers:

Up to 32 single word registers as "short lines." 5 bit addresses. Each register gets a name.

## Operations:

In Drum Computer fasion each operation includes a Next Instruction address.

### Load

Read one word from any address in memory and write to any register.

### Store

Read one word from any register and write to any memory address

### Transfer

Read one word from any register, writing to any other register


## Special Registers

The only way anything interesting happens on the BDI is via special registers.

### The Accumulator

Reading and writing to the `A` register is unremarkable. Whatever value is written is stored.

Writing to the `A+` register occurs via a serial adder who's other input is the `A` register.

Reading from the `A+` register results in the same value as the `A` register.

### The C and D registers

`C` and `D` may be read and written normally.

Reading the `C+D` reads the values of these two via a serial adder.

They may be convenient for loops. Call them Count and Decrement, put N in C and -1 in D. Each time through the loop effect a transfer of `C+D -> C` to decrement the count. A subsequent transfer of `C -> BRA` can be used to branch out of the loop when `C` is reaches zero.

### The OUT register

Writing any value to the OUT register results in the first 8 bits of the word being written to the serial terminal.

Reading the OUT register returns the value of the terminal's CTS Line

 **Is this realistic in hardware?**
### The Branch Register

Writing any non-zero value to the Branch Register causes the next instruction to be taken from N+1 instead of N.

### The Halt Register

Writing any non-zero instruction to the Halt Register halts computation.

## Next Steps

Perhaps an NCAR style approach?

Some bitwise operations?

Input?