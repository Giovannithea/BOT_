// newRaydiumLpService.js
const { MongoClient } = require('mongodb');
const bs58 = require('bs58');
const { struct, u8, u64 } = require('@solana/buffer-layout');
const { PublicKey } = require('@solana/web3.js');
const borsh = require('borsh');

// MongoDB connection setup
const MONGO_URI = 'mongodb+srv://joseseb400:CIeReeRiiSf74FOX@bot.2bwfk.mongodb.net/?retryWrites=true&w=majority&appName=BOT';
const client = new MongoClient(MONGO_URI);
let db;

async function connectToDatabase() {
    try {
        await client.connect();
        db = client.db('Test1');
        console.log("Connected to MongoDB.");
    } catch (error) {
        console.error("MongoDB connection error:", error.message);
    }
}

// Classes for Instructions
class AddLiquidityInstruction {
    constructor(fields) {
        this.instruction = fields.instruction;
        this.baseAmountIn = fields.baseAmountIn;
        this.quoteAmountIn = fields.quoteAmountIn;
        this.fixedSide = fields.fixedSide;
    }
}

class RemoveLiquidityInstruction {
    constructor(fields) {
        this.instruction = fields.instruction;
        this.amountIn = fields.amountIn;
    }
}

// Schema for Add Liquidity
const addLiquiditySchema = new Map([
    [
        AddLiquidityInstruction,
        {
            kind: 'struct',
            fields: [
                ['instruction', 'u8'],         // Instruction discriminator
                ['baseAmountIn', 'u64'],       // Amount of base tokens
                ['quoteAmountIn', 'u64'],      // Amount of quote tokens
                ['fixedSide', 'u8'],           // Fixed side (0 for base, 1 for quote)
            ]
        }
    ]
]);

// Schema for Remove Liquidity
const removeLiquiditySchema = new Map([
    [
        RemoveLiquidityInstruction,
        {
            kind: 'struct',
            fields: [
                ['instruction', 'u8'],   // Instruction discriminator
                ['amountIn', 'u64'],     // LP tokens being removed
            ]
        }
    ]
]);

// Decoding function for Add Liquidity
function decodeAddLiquidityInstruction(data) {
    const buffer = Buffer.from(bs58.decode(data));
    const decoded = borsh.deserialize(addLiquiditySchema, AddLiquidityInstruction, buffer);

    console.log("Decoded Add Liquidity Instruction:");
    console.log(`Instruction: ${decoded.instruction}`);
    console.log(`Base Amount In: ${decoded.baseAmountIn.toString()}`);
    console.log(`Quote Amount In: ${decoded.quoteAmountIn.toString()}`);
    console.log(`Fixed Side: ${decoded.fixedSide === 0 ? 'Base' : 'Quote'}`);

    return decoded;
}

// Decoding function for Remove Liquidity
function decodeRemoveLiquidityInstruction(data) {
    const buffer = Buffer.from(bs58.decode(data));
    const decoded = borsh.deserialize(removeLiquiditySchema, RemoveLiquidityInstruction, buffer);

    console.log("Decoded Remove Liquidity Instruction:");
    console.log(`Instruction: ${decoded.instruction}`);
    console.log(`Amount In: ${decoded.amountIn.toString()}`);

    return decoded;
}

// Process and store the transaction
async function processRaydiumLpTransaction(connection, signature) {
    try {
        const transactionDetails = await connection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
        });

        if (transactionDetails) {
            const message = transactionDetails.transaction.message;
            const accounts = message.staticAccountKeys.map(key => key.toString());

            console.log("Transaction Message:", message);
            console.log("Accounts:", accounts);

            if (Array.isArray(message.instructions)) {
                for (const ix of message.instructions) {
                    const programId = message.staticAccountKeys[ix.programIdIndex].toString();

                    if (programId === RAYDIUM_AMM_PROGRAM_ID.toString() && ix.data.length > 0) {
                        const decodedInstruction = decodeInstructionData(ix.data);

                        const eventDetails = {
                            signature,
                            instructionType: decodedInstruction.instruction, // Instruction type (e.g., add/remove liquidity)
                            timestamp: new Date(),
                            decodedInstruction: decodedInstruction // Store decoded instruction details
                        };

                        console.log("Event Details:", eventDetails);

                        await db.collection('Test1').insertOne(eventDetails);
                        console.log("Event inserted into MongoDB");
                        break;
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error fetching/processing transaction:", error.message);
    }
}

// Decoding instruction data based on instruction type
function decodeInstructionData(data) {
    const instructionId = data[0];
    if (instructionId === 3) {
        return decodeAddLiquidityInstruction(data);
    } else if (instructionId === 4) {
        return decodeRemoveLiquidityInstruction(data);
    } else {
        console.log("Unknown instruction type:", instructionId);
        return {};
    }
}

module.exports = { connectToDatabase, processRaydiumLpTransaction };
