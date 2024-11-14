import { verifierCreateDSRC,
    validateDSRCParams} from '../services/contracts/hitmakrdsrcfactory/hitmakrDSRCFactory.js';
import DSRC from '../models/DSRC.js';
import Song from '../models/Song.js';
import { isAddress } from 'ethers';

export async function createDSRC(req, res) {
    try {
        const userAddress = req.headers['x-user-address'];
        const dsrcData = req.body;

        if (!isAddress(userAddress)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid user address'
            });
        }

        const { tokenURI, uploadHash, price, recipients, percentages, nonce, deadline, selectedChain, signature } = dsrcData;

        if (!tokenURI || !uploadHash || !recipients?.length || !signature) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required parameters'
            });
        }

        const song = await Song.findOne({ uploadHash });
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found with the provided uploadHash'
            });
        }

        

        const validationResult = validateDSRCParams(dsrcData);
        if (!validationResult.isValid) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid parameters',
                errors: validationResult.errors
            });
        }

        const createResult = await verifierCreateDSRC(dsrcData);
        if (!createResult.success) {
            return res.status(500).json({
                success: false,
                message: createResult.error
            });
        }


        const dsrc = new DSRC({
            dsrcId: createResult.dsrcId,
            creator: userAddress,
            contractAddress: createResult.dsrcAddress,
            chain: selectedChain,
            tokenURI,
            price,
            recipients: recipients.map((address, index) => ({
                address,
                percentage: percentages[index]
            })),
            createdAt: Math.floor(Date.now() / 1000)
        });

        await dsrc.save();

        const songUpdateData = {
            dsrc: createResult.dsrcAddress,
            dsrcId: createResult.dsrcId,
            dsrcAddress: createResult.dsrcAddress,
        };

        if (!song.chainDsrcs) {
            song.chainDsrcs = new Map();
        }
        
        song.chainDsrcs.set(selectedChain, {
            dsrcId: createResult.dsrcId,
            dsrcAddress: createResult.dsrcAddress,
            transactionHash: createResult.transactionHash
        });


        await Song.findOneAndUpdate(
            { uploadHash },
            { 
                $set: {
                    ...songUpdateData,
                    chainDsrcs: song.chainDsrcs
                }
            },
            { new: true }
        );

        

        const responseData = {
            success: true,
            data: {
                dsrcId: createResult.dsrcId,
                contractAddress: createResult.dsrcAddress,
                transactionHash: createResult.transactionHash
            }
        };

        res.json(responseData);

    } catch (error) {
        console.error('CreateDSRC error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}
