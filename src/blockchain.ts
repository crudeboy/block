import * as CryptoJS from 'crypto-js'
import { broadcastLatest } from './p2p'
import { hexToBinary } from './util'

class Block {
  public index: number
  public hash: string
  public previousHash: string
  public timestamp: number
  public data: string
  public difficulty!: number
  public nonce!: number

  constructor(index: number, hash: string, previousHash: string, timestamp: number, data: string, difficulty: number, nonce: number) {
    this.index = index
    this.previousHash = previousHash
    this.timestamp = timestamp
    this.data = data
    this.hash = hash
  }
}

const genesisBlock: Block = new Block(0, '816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7', '', 1465154705, 'my genesis block!!', 0, 0)

let blockchain: Block[] = [genesisBlock]

const getBlockchain = (): Block[] => blockchain

const getLatestBlock = (): Block => blockchain[blockchain.length - 1]

// in seconds
const BLOCK_GENERATION_INTERVAL: number = 10;

// in blocks
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10;

//check if it's time to check ofr difficulty change
const getDifficulty = (aBlockchain: Block[]): number => {
  const latestBlock: Block = aBlockchain[blockchain.length - 1]
  if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
    return getAdjustedDifficulty(latestBlock, aBlockchain)
  } else {
    return latestBlock.difficulty
  }
}

//adjust difficulty
const getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]) => {
  const prevAdjustmentBlock: Block = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL]
  const timeExpected: number = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL
  const timeTaken: number = latestBlock.timestamp - prevAdjustmentBlock.timestamp
  if (timeTaken < timeExpected / 2) {
    return prevAdjustmentBlock.difficulty + 1
  } else if (timeTaken > timeExpected * 2) {
    return prevAdjustmentBlock.difficulty - 1
  } else {
    return prevAdjustmentBlock.difficulty
  }
}

//timestamp
const getCurrentTimestamp = (): number => Math.round(new Date().getTime() / 1000)

//create a new block
const generateNextBlock = (blockData: string) => {
  const previousBlock: Block = getLatestBlock()
  const difficulty: number = getDifficulty(getBlockchain())
  console.log('difficulty: ' + difficulty)
  const nextIndex: number = previousBlock.index + 1
  const nextTimestamp: number = getCurrentTimestamp()
  // const nextHash: string = calculateHash(nextIndex, previousBlock.hash, nextTimestamp, blockData)
  // const newBlock: Block = new Block(nextIndex, nextHash, previousBlock.hash, nextTimestamp, blockData)
  const newBlock: Block = findBlock(nextIndex, previousBlock.hash, nextTimestamp, blockData, difficulty)
  addBlock(newBlock)
  broadcastLatest()
  return newBlock
}

//the mining process
const findBlock = (index: number, previousHash: string, timestamp: number, data: string, difficulty: number): Block => {
  let nonce = 0
  while (true) {
    const hash: string = calculateHash(index, previousHash, timestamp, data, difficulty, nonce)
    if (hashMatchesDifficulty(hash, difficulty)) {
      return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce)
    }
    nonce++
  }
}

const calculateHashForBlock = (block: Block): string => {
    return calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce)
}

const calculateHash = (index: number, previousHash: string, timestamp: number, data: string, difficulty: number, nonce: number): string => {
  return CryptoJS.SHA256(index + previousHash + timestamp + data).toString()
}
    
//add new block after validation check
const addBlock = (newBlock: Block) => {
  if (isValidNewBlock(newBlock, getLatestBlock())) {
    blockchain.push(newBlock)
  }
}

// block type check validation
const isValidBlockStructure = (block: Block): boolean => {
  return typeof block.index === 'number' 
  && typeof block.hash === 'string' 
  && typeof block.previousHash === 'string' 
  && typeof block.timestamp === 'number' 
  && typeof block.data === 'string'
}

//block validation
const isValidNewBlock = (newBlock: Block, previousBlock: Block): boolean => {
  if (!isValidBlockStructure(newBlock)) {//validate types
    console.log('invalid structure')
    return false
  }
  if (previousBlock.index + 1 !== newBlock.index) { //check index
    console.log('invalid index')
    return false
  } else if (previousBlock.hash !== newBlock.previousHash) { //check if it references the previous hash
    console.log('invalid previoushash')
    return false
  } else if (calculateHashForBlock(newBlock) !== newBlock.hash) {
    console.log(typeof newBlock.hash + ' ' + typeof calculateHashForBlock(newBlock))
    console.log('invalid hash: ' + calculateHashForBlock(newBlock) + ' ' + newBlock.hash)
    return false
  }
  return true
}

//Nakamoto consensus - cummulative consensus
const getAccumulatedDifficulty = (aBlockchain: Block[]): number => {
  return aBlockchain
    .map((block) => block.difficulty)
    .map((difficulty) => Math.pow(2, difficulty))
    .reduce((a, b) => a + b)
}

//timestamp validation => atleast one minute after the prev block and has been in existence for at least one minute
const isValidTimestamp = (newBlock: Block, previousBlock: Block): boolean => {
  return previousBlock.timestamp - 60 < newBlock.timestamp && newBlock.timestamp - 60 < getCurrentTimestamp()
}

const hasValidHash = (block: Block): boolean => {
  if (!hashMatchesBlockContent(block)) {
    console.log('invalid hash, got:' + block.hash)
    return false
  }

  if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
    console.log('block difficulty not satisfied. Expected: ' + block.difficulty + 'got: ' + block.hash)
  }
  return true
}

const hashMatchesBlockContent = (block: Block): boolean => {
  const blockHash: string = calculateHashForBlock(block)
  return blockHash === block.hash
}

const hashMatchesDifficulty = (hash: string, difficulty: number): boolean => {
  const hashInBinary: string = hexToBinary(hash)
  const requiredPrefix: string = '0'.repeat(difficulty)
  return hashInBinary.startsWith(requiredPrefix)
}

//
const isValidChain = (blockchainToValidate: Block[]): boolean => {
  const isValidGenesis = (block: Block): boolean => {
    return JSON.stringify(block) === JSON.stringify(genesisBlock)
  }

  if (!isValidGenesis(blockchainToValidate[0])) {
    return false
  }

  for (let i = 1; i < blockchainToValidate.length; i++) {
    if (!isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
      return false
    }
  }
  return true
}

//
const addBlockToChain = (newBlock: Block) => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        blockchain.push(newBlock);
        return true;
    }
    return false;
};

//
const replaceChain = (newBlocks: Block[]) => {
  if (isValidChain(newBlocks) 
  && getAccumulatedDifficulty(newBlocks) > getAccumulatedDifficulty(getBlockchain())) {
    console.log('Received blockchain is valid. Replacing current blockchain with received blockchain')
    blockchain = newBlocks
    broadcastLatest()
  } else {
    console.log('Received blockchain invalid')
  }
}

//
export { Block, getBlockchain, getLatestBlock, generateNextBlock, isValidBlockStructure, replaceChain, addBlockToChain }
