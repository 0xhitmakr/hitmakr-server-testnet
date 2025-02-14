import {
    Contract,
    JsonRpcProvider,
    getAddress,
    isAddress,
    Interface,
} from 'ethers';
import abi from './abi/abi.json' with { type: 'json' };
import controlCenterAbi from "../controlcenter/abi/controlcenterabi.json" with { type: 'json' };
import creativeIDAbi from "../creativeId/abi/creativeidabi.json" with { type: 'json' };
import dotenv from 'dotenv';
import { createVerifierManager } from '../../../middleware/VerifierManager.js';

dotenv.config();

const RPC_URL = process.env.SKALE_RPC_URL;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_HITMAKR_DSRC_FACTORY_SKL;
const CONTROL_CENTER_ADDRESS = process.env.CONTROL_CENTER_ADDRESS;
const VERIFIER_PRIVATE_KEYS = process.env.NEW_VERIFIER_PRIVATE_KEYS?.split(',').map(k => k.trim()); // Use NEW_VERIFIER_PRIVATE_KEYS
const DEFAULT_GAS_LIMIT = BigInt(10000000);
const CACHE_TTL = 5 * 60 * 1000;
const MAX_URI_LENGTH = 1000;
const MAX_RECIPIENTS = 10;
const BASIS_POINTS = 10000;

const provider = new JsonRpcProvider(RPC_URL);
const readContract = new Contract(CONTRACT_ADDRESS, abi, provider);
const dsrcCache = new Map();
const contractInterface = new Interface(abi);

// Initialize VerifierManager
const verifierManager = await createVerifierManager({
    rpcUrl: RPC_URL,
    verifierKeys: VERIFIER_PRIVATE_KEYS, // Pass the array of keys
});

const validateAddress = (address) => {
    if (!address || !isAddress(address)) {
        throw new Error('Invalid address format');
    }
    return getAddress(address);
};

const handleError = (context, err) => {
    console.error(`${context}:`, err);
    return {
        success: false,
        error: err.message
    };
};

export const verifierCreateDSRC = async (dsrcData) => {
    console.log('=== DSRC Creation Started ===');

    try {
        const { tokenURI, collectorsPrice, licensingPrice, recipients, percentages, selectedChain } = dsrcData;
        const formattedRecipients = recipients.map(addr => validateAddress(addr));

        // Validate inputs before sending
        if (!tokenURI || tokenURI.length === 0) {
            throw new Error('Invalid tokenURI');
        }
        if (!formattedRecipients || formattedRecipients.length === 0) {
            throw new Error('Invalid recipients');
        }
        if (!percentages || percentages.length === 0) {
            throw new Error('Invalid percentages');
        }
        if (!selectedChain || selectedChain.length === 0) {
            throw new Error('Invalid chain');
        }

        // Execute transaction using VerifierManager
        return await verifierManager.executeTransaction(async (wallet) => {
            const contract = new Contract(CONTRACT_ADDRESS, abi, wallet);
            const controlCenter = new Contract(CONTROL_CENTER_ADDRESS, controlCenterAbi, provider);

            const verifierRole = await controlCenter.VERIFIER_ROLE();
            const hasRole = await controlCenter.hasRole(verifierRole, wallet.address); // Use wallet from VerifierManager

            console.log('Verifier role check:', {
                address: wallet.address, // Use wallet from VerifierManager
                verifierRole,
                hasRole
            });

            if (!hasRole) {
                throw new Error('Verifier does not have required role');
            }


            console.log('Calling createDSRC with parameters:', {
                tokenURI,
                collectorsPrice: BigInt(collectorsPrice).toString(),
                licensingPrice: BigInt(licensingPrice).toString(),
                recipients: formattedRecipients,
                percentages,
                selectedChain
            });

            // Try to simulate the transaction first
            try {
                await contract.createDSRC.staticCall(
                    tokenURI,
                    BigInt(collectorsPrice),
                    BigInt(licensingPrice),
                    formattedRecipients,
                    percentages,
                    selectedChain,
                    { gasLimit: DEFAULT_GAS_LIMIT }
                );
            } catch (error) {
                console.log('Simulation failed:', {
                    error: error.message,
                    data: error.data,
                    revertData: error.revertData,
                    reason: error.reason
                });
                if (error.data) {
                    try {
                        const decodedError = contractInterface.parseError(error.data);
                        console.log('Decoded error:', decodedError);
                        throw new Error(`Contract reverted: ${decodedError.name}`);
                    } catch (e) {
                        // If we can't decode the error, throw the original
                        throw error;
                    }
                }
                throw error;
            }

            console.log('Transaction simulation successful, sending transaction...');
            const tx = await contract.createDSRC(
                tokenURI,
                BigInt(collectorsPrice),
                BigInt(licensingPrice),
                formattedRecipients,
                percentages,
                selectedChain,
                { gasLimit: DEFAULT_GAS_LIMIT }
            );

            console.log('Transaction Sent:', tx.hash);
            console.log('Transaction data:', tx.data);

            const receipt = await tx.wait();

            console.log('Transaction receipt:', {
                status: receipt.status,
                gasUsed: receipt.gasUsed.toString(),
                blockNumber: receipt.blockNumber,
                effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
                from: receipt.from,
                to: receipt.to,
                contractAddress: receipt.contractAddress,
                type: receipt.type,
                logs: receipt.logs.map(log => {
                    try {
                        const decoded = contractInterface.parseLog({
                            topics: [...log.topics],
                            data: log.data
                        });
                        return {
                            name: decoded.name,
                            args: decoded.args,
                            raw: {
                                topics: log.topics,
                                data: log.data
                            }
                        };
                    } catch (e) {
                        return {
                            error: 'Could not decode log',
                            raw: {
                                topics: log.topics,
                                data: log.data
                            }
                        };
                    }
                })
            });

            if (!receipt.status) {
                throw new Error('Transaction failed');
            }

            const dsrcCreatedEvent = receipt.logs.find(log => {
                try {
                    const event = contractInterface.parseLog({ topics: [...log.topics], data: log.data });
                    return event.name === 'DSRCCreated';
                } catch(e) {
                    return false;
                }
            });

            if (!dsrcCreatedEvent) {
                return {
                    success: false,
                    error: 'DSRCCreated event not found',
                    transactionHash: tx.hash
                };
            }

            dsrcCache.clear();

            return {
                success: true,
                transactionHash: tx.hash,
                dsrcAddress: dsrcCreatedEvent.args.dsrcAddress,
                dsrcId: dsrcCreatedEvent.args.dsrcId,
                receipt
            };
        }); // End of verifierManager.executeTransaction
    } catch (err) {
        console.error('=== DSRC Creation Error ===', err);
        return handleError('verifierCreateDSRC', err);
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
        const nonce = await readContract.yearCounts(address);
        dsrcCache.set(cacheKey, { nonce: nonce.toString(), timestamp: Date.now() });
        return { success: true, nonce: nonce.toString() };
    } catch (err) {
        return handleError('getNonce', err);
    }
};

export const getYearCount = async (userAddress) => {
    try {
        const address = validateAddress(userAddress);
        const cacheKey = `yearCount_${address}`;
        const cached = dsrcCache.get(cacheKey);
        if (cached?.timestamp > Date.now() - CACHE_TTL) {
            return cached.data;
        }

        const currentYear = Math.floor((Date.now() / 31536000000) + 1970) % 100;
        const count = await readContract.yearCounts(address, currentYear);
        const data = {
            success: true,
            year: currentYear,
            count: Number(count)
        };

        dsrcCache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });

        return data;
    } catch (err) {
        return handleError('getYearCount', err);
    }
};

export const getDSRCByChain = async (chain, dsrcId) => {
    try {
        const cacheKey = `dsrc_${chain}_${dsrcId}`;
        const cached = dsrcCache.get(cacheKey);
        if (cached?.timestamp > Date.now() - CACHE_TTL) {
            return cached.data;
        }

        const dsrcAddress = await readContract.getDSRCByChain(chain, dsrcId);
        const data = {
            success: true,
            dsrcAddress: dsrcAddress
        };

        dsrcCache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });

        return data;
    } catch (err) {
        return handleError('getDSRCByChain', err);
    }
};

export { MAX_URI_LENGTH, BASIS_POINTS, MAX_RECIPIENTS };