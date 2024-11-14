import { 
    Contract, 
    JsonRpcProvider,
    getAddress,
    isAddress,
    toUtf8String
} from 'ethers';
import abi from './abi/abi.json' assert { type: 'json' };
import { createVerifierManager } from '../../../middleware/VerifierManager.js';
import dotenv from 'dotenv';

dotenv.config();


const RPC_URL = process.env.SKALE_RPC_URL;
const CONTRACT_ADDRESS = process.env.SKALE_HITMAKR_DSRC_FACTORY;
const DEFAULT_GAS_LIMIT = BigInt(41443050);
const CACHE_TTL = 5 * 60 * 1000;


const provider = new JsonRpcProvider(RPC_URL);
const readContract = new Contract(CONTRACT_ADDRESS, abi, provider);


const dsrcCache = new Map();


const verifierManager = await createVerifierManager({
    rpcUrl: RPC_URL,
    verifierKeys: process.env.NEW_VERIFIER_PRIVATE_KEYS.split(',').map(k => k.trim())
});


const validateAddress = (address) => {
    if (!address || !isAddress(address)) {
        throw new Error('Invalid address format');
    }
    return getAddress(address);
};

const formatBigIntParams = (params) => {
    try {
        return {
            tokenURI: params.tokenURI,
            price: BigInt(params.price),
            recipients: params.recipients.map(validateAddress),
            percentages: params.percentages.map(p => BigInt(p)),
            nonce: BigInt(params.nonce),
            deadline: BigInt(params.deadline),
            selectedChain: params.selectedChain
        };
    } catch (err) {
        throw new Error(`Parameter formatting failed: ${err.message}`);
    }
};

export const verifierCreateDSRC = async (dsrcData) => {
    console.log('=== DSRC Creation Started ===');
    
    try {
        const validation = validateDSRCParams(dsrcData);
        if (!validation.isValid) {
            return {
                success: false,
                error: 'Validation failed',
                errors: validation.errors
            };
        }

        const formattedParams = formatBigIntParams(dsrcData);

        return await verifierManager.executeTransaction(async (wallet) => {
            const contract = new Contract(CONTRACT_ADDRESS, abi, wallet);

            console.log('Transaction Parameters:', {
                ...formattedParams,
                price: formattedParams.price.toString(),
                percentages: formattedParams.percentages.map(p => p.toString()),
                nonce: formattedParams.nonce.toString(),
                deadline: formattedParams.deadline.toString()
            });

            let gasLimit = DEFAULT_GAS_LIMIT;
            try {
                const gasEstimate = await contract.createDSRC.estimateGas(
                    formattedParams,
                    dsrcData.signature
                );
                gasLimit = BigInt(Math.floor(Number(gasEstimate) * 1.2));
                console.log('Estimated Gas:', gasLimit.toString());
            } catch (gasError) {
                console.warn('Gas estimation failed, using default:', gasError.message);
                if (gasError.data) {
                    try {
                        const reason = toUtf8String('0x' + gasError.data.slice(138));
                        console.log('Revert Reason:', reason);
                    } catch (e) {
                        console.warn('Could not parse revert reason');
                    }
                }
            }

            const tx = await contract.createDSRC(
                formattedParams,
                dsrcData.signature,
                { gasLimit }
            );

            console.log('Transaction Sent:', tx.hash);

            const receipt = await tx.wait();
            
            if (!receipt.status) {
                throw new Error('Transaction failed');
            }

            const dsrcCreatedEvent = receipt.logs
                .map(log => {
                    try {
                        return contract.interface.parseLog({
                            topics: log.topics,
                            data: log.data
                        });
                    } catch {
                        return null;
                    }
                })
                .find(event => event?.name === 'DSRCCreated');

            if (!dsrcCreatedEvent) {
                throw new Error('DSRCCreated event not found in receipt');
            }

            dsrcCache.clear();

            return {
                success: true,
                transactionHash: tx.hash,
                dsrcAddress: dsrcCreatedEvent.args.dsrcAddress,
                dsrcId: dsrcCreatedEvent.args.dsrcId,
                receipt
            };
        });
    } catch (err) {
        console.error('=== DSRC Creation Error ===');
        return handleTransactionError(err);
    }
};

export const getNonce = async (userAddress) => {
    try {
        const address = validateAddress(userAddress);
        const cacheKey = `nonce_${address}`;
        
        const cached = dsrcCache.get(cacheKey);
        if (cached?.timestamp > Date.now() - CACHE_TTL) {
            return { success: true, nonce: cached.nonce };
        }

        const nonce = await readContract.getNonce(address);
        
        dsrcCache.set(cacheKey, {
            nonce: nonce.toString(),
            timestamp: Date.now()
        });

        return {
            success: true,
            nonce: nonce.toString()
        };
    } catch (err) {
        return handleError('Nonce fetch failed', err);
    }
};

export const getCurrentYearCount = async (userAddress) => {
    try {
        const address = validateAddress(userAddress);
        const cacheKey = `yearCount_${address}`;
        
        const cached = dsrcCache.get(cacheKey);
        if (cached?.timestamp > Date.now() - CACHE_TTL) {
            return cached.data;
        }

        const [year, count] = await readContract.getCurrentYearCount(address);
        const data = {
            success: true,
            year: Number(year),
            count: Number(count)
        };

        dsrcCache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });

        return data;
    } catch (err) {
        return handleError('Year count fetch failed', err);
    }
};

export const getDSRCByChain = async (chain, dsrcId) => {
    try {
        const cacheKey = `dsrc_${chain}_${dsrcId}`;
        
        const cached = dsrcCache.get(cacheKey);
        if (cached?.timestamp > Date.now() - CACHE_TTL) {
            return cached.data;
        }

        const address = await readContract.getDSRCByChain(chain, dsrcId);
        const data = {
            success: true,
            address
        };

        dsrcCache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });

        return data;
    } catch (err) {
        return handleError('DSRC fetch failed', err);
    }
};

// Validation Functions
export const validateDSRCParams = (dsrcData) => {
    if (!dsrcData || typeof dsrcData !== 'object') {
        return { isValid: false, errors: ['Invalid DSRC data'] };
    }

    const errors = [];
    const requiredFields = [
        'tokenURI',
        'price',
        'recipients',
        'percentages',
        'nonce',
        'deadline',
        'signature',
        'selectedChain'
    ];

    requiredFields.forEach(field => {
        if (!dsrcData[field]) errors.push(`Missing ${field}`);
    });

    if (errors.length > 0) {
        return { isValid: false, errors };
    }

    if (!Array.isArray(dsrcData.recipients) || !Array.isArray(dsrcData.percentages)) {
        errors.push('Recipients and percentages must be arrays');
    }

    if (dsrcData.recipients?.length !== dsrcData.percentages?.length) {
        errors.push('Recipients and percentages must have same length');
    }

    const totalPercentage = dsrcData.percentages?.reduce((sum, p) => sum + Number(p), 0);
    if (totalPercentage !== 10000) {
        errors.push(`Total percentage must be 10000 (100%), got: ${totalPercentage}`);
    }

    if (Number(dsrcData.deadline) < Math.floor(Date.now() / 1000)) {
        errors.push('Deadline has expired');
    }

    try {
        dsrcData.recipients?.forEach(address => validateAddress(address));
    } catch {
        errors.push('Invalid recipient address format');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

const handleTransactionError = (err) => {
    console.error('Transaction Error:', {
        message: err.message,
        code: err.code,
        data: err.data,
        transaction: err.transaction
    });

    if (err.code === 'CALL_EXCEPTION' || err.code === 'UNPREDICTABLE_GAS_LIMIT') {
        return {
            success: false,
            error: 'Transaction execution failed',
            details: {
                message: err.message,
                reason: err.reason || 'Unknown reason',
                code: err.code
            }
        };
    }

    return {
        success: false,
        error: err.message,
        details: JSON.stringify(err, Object.getOwnPropertyNames(err))
    };
};

const handleError = (context, err) => {
    console.error(`${context}:`, err);
    return {
        success: false,
        error: err.message
    };
};