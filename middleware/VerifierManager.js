import { 
    Wallet, 
    JsonRpcProvider, 
    getAddress,
    isHexString
} from 'ethers';
import mongoose from 'mongoose';

const VerifierSchema = new mongoose.Schema({
    address: { 
        type: String, 
        required: true, 
        unique: true,
        index: true 
    },
    lastUsedBlock: { type: Number, default: 0 },
    isLocked: { type: Boolean, default: false },
    pendingTxCount: { type: Number, default: 0 }
}, {
    timestamps: false,
    collection: 'verifiers',
    indexes: [
        { 
            isLocked: 1, 
            pendingTxCount: 1, 
            lastUsedBlock: 1 
        }
    ]
});

const VerifierModel = mongoose.models.Verifier || mongoose.model('Verifier', VerifierSchema);

class VerifierManager {
    constructor(config) {
        if (!config.rpcUrl) throw new Error('RPC URL is required');

        try {
            this.provider = new JsonRpcProvider(config.rpcUrl);
        } catch (error) {
            throw new Error(`Failed to initialize provider: ${error.message}`);
        }

        this.maxPendingTx = config.maxPendingTx || 5;
        this.blockWindow = config.blockWindow || 1;
        this.isInitialized = false;
        this.verifierWallets = new Map();
        this.lastCheckedBlock = 0;
        this.blockCheckInterval = 5;
    }

    async init() {
        try {
            await this.provider.getBlockNumber();
            
            this.provider.on('block', this.handleNewBlock.bind(this));
            
            return true;
        } catch (error) {
            console.error('Failed to initialize provider:', error);
            throw error;
        }
    }

    async handleNewBlock(blockNumber) {
        if (!this.lastCheckedBlock || blockNumber - this.lastCheckedBlock < this.blockCheckInterval) return;
        
        try {
            await this.updateVerifierStates(blockNumber);
            this.lastCheckedBlock = blockNumber;
        } catch (error) {
            console.error('Block monitoring error:', error);
        }
    }

    validatePrivateKey(key) {
        try {
            if (!key?.startsWith('0x')) key = '0x' + key.replace(/[\s,;]+/g, '');
            if (!isHexString(key) || key.length !== 66) return null;

            const wallet = new Wallet(key);
            return { key, address: getAddress(wallet.address) };
        } catch {
            return null;
        }
    }

    async initializeVerifiers(verifierKeys) {
        if (!Array.isArray(verifierKeys) || !verifierKeys.length) {
            throw new Error('No verifier keys provided');
        }

        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGO_URI);
        }

        const operations = [];
        const validWallets = new Map();

        for (const key of verifierKeys) {
            const validated = this.validatePrivateKey(key);
            if (validated) {
                const { key: privateKey, address } = validated;
                const wallet = new Wallet(privateKey, this.provider);
                validWallets.set(address, wallet);
                
                operations.push({
                    updateOne: {
                        filter: { address },
                        update: {
                            $set: {
                                address,
                                isLocked: false,
                                pendingTxCount: 0,
                                lastUsedBlock: 0
                            }
                        },
                        upsert: true
                    }
                });
            }
        }

        if (!operations.length) throw new Error('No valid verifiers found');

        await VerifierModel.bulkWrite(operations, { ordered: false });
        this.verifierWallets = validWallets;
        this.isInitialized = true;

        return validWallets.size;
    }

    async updateVerifierStates(currentBlock) {
        if (currentBlock > this.blockWindow) {
            const updateOperation = {
                updateMany: {
                    filter: {
                        isLocked: true,
                        lastUsedBlock: { $lt: currentBlock - this.blockWindow }
                    },
                    update: {
                        $set: {
                            isLocked: false,
                            pendingTxCount: 0,
                            lastUsedBlock: currentBlock
                        }
                    }
                }
            };

            await VerifierModel.bulkWrite([updateOperation], { ordered: false });
        }
    }

    async getVerifier() {
        if (!this.isInitialized) throw new Error('VerifierManager not initialized');
        if (!this.provider) throw new Error('Provider not initialized');

        try {
            const currentBlock = await this.provider.getBlockNumber();
            
            const verifier = await VerifierModel.findOneAndUpdate(
                {
                    isLocked: false,
                    pendingTxCount: { $lt: this.maxPendingTx }
                },
                {
                    $set: {
                        isLocked: true,
                        lastUsedBlock: currentBlock
                    },
                    $inc: { pendingTxCount: 1 }
                },
                { sort: { pendingTxCount: 1 }, new: true }
            );

            if (!verifier) return null;

            const wallet = this.verifierWallets.get(verifier.address);
            if (!wallet) {
                await this.releaseVerifier(verifier.address);
                return null;
            }

            // Ensure wallet has provider
            if (!wallet.provider) {
                wallet.connect(this.provider);
            }

            return {
                wallet,
                provider: this.provider,
                release: () => this.releaseVerifier(verifier.address)
            };
        } catch (error) {
            console.error('Get verifier error:', error);
            return null;
        }
    }

    async releaseVerifier(address) {
        await VerifierModel.updateOne(
            { address },
            {
                $set: { isLocked: false },
                $inc: { pendingTxCount: -1 }
            }
        );
    }

    async executeTransaction(operation, options = { maxRetries: 3, retryDelay: 1000 }) {
        let verifier = null;
        let retries = 0;

        while (!verifier && retries < options.maxRetries) {
            verifier = await this.getVerifier();
            if (!verifier && ++retries < options.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, options.retryDelay));
            }
        }

        if (!verifier) {
            throw new Error(`No verifiers available after ${options.maxRetries} retries`);
        }

        try {
            return await operation(verifier.wallet);
        } finally {
            await verifier.release();
        }
    }

    async cleanup() {
        this.provider.removeAllListeners('block');
        this.verifierWallets.clear();
        
        if (mongoose.connection.readyState === 1) {
            await VerifierModel.updateMany(
                {},
                {
                    $set: {
                        isLocked: false,
                        pendingTxCount: 0
                    }
                }
            );
        }
    }
}

export const createVerifierManager = async (config) => {
    if (!config.rpcUrl) {
        throw new Error('RPC URL is required for VerifierManager initialization');
    }

    try {
        const manager = new VerifierManager(config);
        await manager.init(); 
        
        if (config.verifierKeys?.length) {
            await manager.initializeVerifiers(config.verifierKeys);
        }
        
        return manager;
    } catch (error) {
        console.error('Failed to create VerifierManager:', error);
        throw error;
    }
};

process.on('SIGTERM', async () => {
    if (mongoose.connection.readyState === 1) {
        await VerifierModel.updateMany(
            { isLocked: true },
            {
                $set: {
                    isLocked: false,
                    pendingTxCount: 0
                }
            }
        );
        await mongoose.connection.close();
    }
    process.exit(0);
});