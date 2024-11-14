import { uploadMusic, uploadLyricsToIrys, uploadMetadata } from '../services/irysService.js';
import { uploadFile } from '../services/filebaseService.js';
import Song from '../models/Song.js';
import { calculateAudioDuration, formatDuration, safeDeleteFile } from '../utils/fileUtils.js';
import path from 'path';
import fs from 'fs';
import { processAndStoreFingerprint } from '../services/fingerprintService.js'; 
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const CHAIN_FORMAT_REGEX = /^[A-Z0-9]{2,10}$/;

const validateChain = (chain) => {
    if (!chain) {
        return { success: false, message: "Chain identifier is required" };
    }
    if (!CHAIN_FORMAT_REGEX.test(chain)) {
        return { 
            success: false, 
            message: "Chain identifier must be 2-10 uppercase characters or numbers" 
        };
    }
    return { success: true };
};


const generateUploadHash = (songId, userAddress) => {
    const secret = process.env.UPLOAD_HASH_SECRET;
    return crypto
        .createHmac('sha256', secret)
        .update(`${songId}-${userAddress}-${Date.now()}`)
        .digest('hex');
};

export async function newUpload(req, res) {
    let songFile, coverImage;
    let songFilePath, coverImagePath;

    try {
        songFile = req.files['song'] ? req.files['song'][0] : null;
        coverImage = req.files['coverImage'] ? req.files['coverImage'][0] : null;

        if (!songFile) {
            throw new Error('No song file uploaded');
        }

        songFilePath = path.join(path.dirname(songFile.path), songFile.originalname);
        fs.renameSync(songFile.path, songFilePath);

        const songId = Date.now().toString();
        const userAddress = req.headers['x-user-address'];
        const uploadHash = generateUploadHash(songId, userAddress);

        const fingerprintData = {
            songId: songId,
            filePath: songFilePath,
            walletAddress: userAddress
        };

        const fingerprintResult = await processAndStoreFingerprint(fingerprintData);
        if (!fingerprintResult.success) {
            throw new Error(fingerprintResult.message);
        }

        const chunkIds = await uploadMusic(songFilePath);
        const durationInSeconds = await calculateAudioDuration(songFilePath);
        const formattedDuration = formatDuration(durationInSeconds);

        let coverImageUrl;
        if (coverImage) {
            coverImageUrl = await uploadFile(coverImage);
        }

        const songDetails = JSON.parse(req.body.songDetails);
        const selectedCategory = req.body.selectedCategory;
        const royaltySplits = JSON.parse(req.body.royaltySplits);
        const mintPrice = parseFloat(req.body.mintPrice);

        const processedRoyaltySplits = royaltySplits.map((split) => ({
            address: split.address.toLowerCase(),
            role: split.role,
            percentage: parseFloat(split.percentage)
        }));

        let selectedChain = req.body.selectedChain || "SKL";
        const chainValidation = validateChain(selectedChain);
        if (!chainValidation.success) {
            throw new Error(chainValidation.message);
        }

        const metadata = {
            name: songDetails.title,
            description: songDetails.description,
            image: coverImageUrl,
            songId: songId,
            creator: userAddress.toLowerCase(),
            format: 'audio/mpeg',
            type: 'single',
            audio: chunkIds,
            attributes: [
                { trait_type: 'Duration', value: formattedDuration },
                { trait_type: 'Category', value: selectedCategory },
                { trait_type: 'Language', value: songDetails.language },
                { trait_type: 'Copyright', value: 'QmSt79ndUmeiux1ZsaqsJnXPrW48BG2T3BmDRdp7QcxkG4' },
                { trait_type: 'Genre', value: songDetails.genre },
                { trait_type: 'License', value: songDetails.license },
                { trait_type: 'Country', value: songDetails.country },
                { trait_type: 'Chain', value: selectedChain },
                { trait_type: 'Price', value: mintPrice },
                { trait_type: 'Royalty Splits', value: processedRoyaltySplits },
                { trait_type: 'Is Gated', value: JSON.parse(req.body.subscribersUpload || "false") },
                { trait_type: 'Is Copyright Overwritten', value: JSON.parse(req.body.copyrightChecked || "false") }
            ]
        };

        if (songDetails.lyrics?.trim()) {
            try {
                const lyricsUrl = await uploadLyricsToIrys(songDetails.lyrics);
                if (lyricsUrl) {
                    metadata.attributes.push({ trait_type: 'Lyrics', value: lyricsUrl });
                }
            } catch (error) {
                console.error('Error uploading lyrics:', error);
            }
        }

        const tokenURI = await uploadMetadata(metadata);

        const songData = {
            songId,
            uploadHash,
            walletAddress: userAddress.toLowerCase(),
            title: songDetails.title,
            description: songDetails.description,
            selectedChain,
            metadata
        };

        const song = new Song(songData);
        await song.save();

        res.json({
            success: true,
            tokenURI,
            uploadHash,
            songId
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        safeDeleteFile(songFilePath);
        safeDeleteFile(coverImagePath);
        if (songFile) safeDeleteFile(songFile.path);
        if (coverImage) safeDeleteFile(coverImage.path);
    }
}
